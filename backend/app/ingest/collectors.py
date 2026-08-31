"""Live collectors.

Reddit and RSS need no credentials and genuinely work out of the box. YouTube
and X need keys; without them they report themselves as unavailable rather
than failing the run.

Collected text goes through the same annotator as everything else, so a real
post and a synthetic one are the same shape by the time the UI sees them.
"""
from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

log = logging.getLogger("visionx.ingest")

UA = "VisionX/1.0 (SIH prototype; contact via repo)"


@dataclass
class RawPost:
    platform: str
    author: str
    text: str
    url: str
    created_at: float
    place: str = "Unknown"


class Collector:
    platform = "unknown"
    requires_key = False

    async def available(self) -> tuple[bool, str]:
        return True, ""

    async def fetch(self, limit: int = 25) -> list[RawPost]:  # pragma: no cover - interface
        raise NotImplementedError


class RedditCollector(Collector):
    """Public JSON endpoints. No OAuth needed for read-only listings."""

    platform = "reddit"

    def __init__(self, subreddits: list[str]) -> None:
        self.subreddits = subreddits

    async def fetch(self, limit: int = 25) -> list[RawPost]:
        out: list[RawPost] = []
        per = max(1, limit // max(len(self.subreddits), 1))
        async with httpx.AsyncClient(timeout=12, headers={"User-Agent": UA}) as client:
            for sub in self.subreddits:
                try:
                    r = await client.get(f"https://www.reddit.com/r/{sub}/new.json", params={"limit": per})
                    r.raise_for_status()
                    for child in r.json().get("data", {}).get("children", []):
                        d = child.get("data", {})
                        text = (d.get("title") or "").strip()
                        body = (d.get("selftext") or "").strip()
                        if body:
                            text = f"{text}. {body[:280]}"
                        if not text:
                            continue
                        out.append(
                            RawPost(
                                platform="reddit",
                                author=f"u/{d.get('author', 'unknown')}",
                                text=text,
                                url=f"https://reddit.com{d.get('permalink', '')}",
                                created_at=float(d.get("created_utc") or 0),
                                place=sub.title(),
                            )
                        )
                except Exception as exc:
                    log.warning("reddit r/%s failed: %s", sub, exc)
        return out


class RSSCollector(Collector):
    """News and blog feeds. No credentials."""

    platform = "news"

    def __init__(self, feeds: list[str]) -> None:
        self.feeds = feeds

    async def fetch(self, limit: int = 25) -> list[RawPost]:
        import feedparser  # noqa: PLC0415

        out: list[RawPost] = []
        per = max(1, limit // max(len(self.feeds), 1))
        async with httpx.AsyncClient(timeout=12, headers={"User-Agent": UA}, follow_redirects=True) as client:
            for url in self.feeds:
                try:
                    r = await client.get(url)
                    r.raise_for_status()
                    parsed = await asyncio.to_thread(feedparser.parse, r.content)
                    for entry in parsed.entries[:per]:
                        title = re.sub(r"<[^>]+>", "", getattr(entry, "title", "") or "").strip()
                        summary = re.sub(r"<[^>]+>", "", getattr(entry, "summary", "") or "").strip()
                        text = f"{title}. {summary[:280]}" if summary else title
                        if not text:
                            continue
                        out.append(
                            RawPost(
                                platform="news",
                                author=parsed.feed.get("title", "news")[:40],
                                text=text,
                                url=getattr(entry, "link", url),
                                created_at=datetime.now(timezone.utc).timestamp(),
                            )
                        )
                except Exception as exc:
                    log.warning("rss %s failed: %s", url, exc)
        return out


class YouTubeCollector(Collector):
    """Search + comment threads. Needs YOUTUBE_API_KEY."""

    platform = "youtube"
    requires_key = True

    def __init__(self, api_key: str, query: str = "Bengaluru traffic OR water OR metro") -> None:
        self.api_key = api_key
        self.query = query

    async def available(self) -> tuple[bool, str]:
        return (bool(self.api_key), "" if self.api_key else "YOUTUBE_API_KEY not set")

    async def fetch(self, limit: int = 25) -> list[RawPost]:
        ok, why = await self.available()
        if not ok:
            log.info("youtube skipped: %s", why)
            return []
        out: list[RawPost] = []
        async with httpx.AsyncClient(timeout=12, headers={"User-Agent": UA}) as client:
            r = await client.get(
                "https://www.googleapis.com/youtube/v3/search",
                params={"part": "snippet", "q": self.query, "type": "video",
                        "maxResults": min(limit, 10), "key": self.api_key, "order": "date"},
            )
            r.raise_for_status()
            for item in r.json().get("items", []):
                sn = item.get("snippet", {})
                out.append(
                    RawPost(
                        platform="youtube",
                        author=sn.get("channelTitle", "channel"),
                        text=f"{sn.get('title', '')}. {sn.get('description', '')[:240]}",
                        url=f"https://youtube.com/watch?v={item.get('id', {}).get('videoId', '')}",
                        created_at=datetime.now(timezone.utc).timestamp(),
                    )
                )
        return out


class XCollector(Collector):
    """Recent search. Needs X_BEARER_TOKEN (a paid tier on current API plans)."""

    platform = "x"
    requires_key = True

    def __init__(self, bearer: str, query: str = "(traffic OR metro OR water) place_country:IN -is:retweet") -> None:
        self.bearer = bearer
        self.query = query

    async def available(self) -> tuple[bool, str]:
        return (bool(self.bearer), "" if self.bearer else "X_BEARER_TOKEN not set")

    async def fetch(self, limit: int = 25) -> list[RawPost]:
        ok, why = await self.available()
        if not ok:
            log.info("x skipped: %s", why)
            return []
        out: list[RawPost] = []
        async with httpx.AsyncClient(
            timeout=12, headers={"Authorization": f"Bearer {self.bearer}", "User-Agent": UA}
        ) as client:
            r = await client.get(
                "https://api.twitter.com/2/tweets/search/recent",
                params={"query": self.query, "max_results": min(max(limit, 10), 100),
                        "tweet.fields": "created_at,lang,author_id"},
            )
            r.raise_for_status()
            for tw in r.json().get("data", []):
                out.append(
                    RawPost(
                        platform="x",
                        author=f"@{tw.get('author_id', 'unknown')}",
                        text=tw.get("text", ""),
                        url=f"https://x.com/i/status/{tw.get('id')}",
                        created_at=datetime.now(timezone.utc).timestamp(),
                    )
                )
        return out


def build_collectors() -> list[Collector]:
    from ..config import get_settings  # noqa: PLC0415

    s = get_settings()
    return [
        RedditCollector(s.subreddit_list),
        RSSCollector(s.rss_list),
        YouTubeCollector(s.youtube_api_key),
        XCollector(s.x_bearer_token),
    ]
