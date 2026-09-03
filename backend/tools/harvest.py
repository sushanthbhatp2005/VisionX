"""Harvest a real corpus for topic discovery.

    python tools/harvest.py [--limit 100] [--out app/data/harvest.json]

Topic discovery needs volume. HDBSCAN on a few dozen documents assigns almost
everything to the outlier topic and tells you nothing; a few hundred is the
floor and a thousand is comfortable. The live ingest endpoint pulls ~25 posts a
call, so this widens the net and caches the result to disk.

Caching matters for the demo too: discovery then runs on a fixed corpus rather
than on whatever the network returns at showtime, so the topics on screen are
the ones you rehearsed with.

Reddit and RSS only — neither needs credentials.

Reddit note: hammering many subreddits at limit=100 gets the IP 403-blocked.
The collector now paces requests, but if Reddit returns 403 for everything,
that is what has happened and RSS carries the harvest on its own.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.ingest.collectors import RedditCollector, RSSCollector  # noqa: E402

# Wider than the runtime default: discovery wants breadth, and these are all
# public JSON endpoints with no auth.
SUBREDDITS = [
    "bangalore", "india", "karnataka", "IndiaSpeaks", "bengaluru",
    "mumbai", "delhi", "Chennai", "hyderabad", "pune",
    "IndianStreetBets", "developersIndia", "IndiaTech", "indiasocial",
]

FEEDS = [
    # Verified reachable at the time of writing. Deccan Herald's rss paths
    # 404/500, so they are left out rather than silently contributing nothing.
    "https://www.thehindu.com/news/national/feeder/default.rss",
    "https://www.thehindu.com/news/cities/bangalore/feeder/default.rss",
    "https://www.thehindu.com/news/cities/chennai/feeder/default.rss",
    "https://www.thehindu.com/news/cities/Delhi/feeder/default.rss",
    "https://www.thehindu.com/news/cities/Hyderabad/feeder/default.rss",
    "https://www.thehindu.com/news/cities/mumbai/feeder/default.rss",
    "https://www.thehindu.com/news/national/karnataka/feeder/default.rss",
    "https://www.thehindu.com/sci-tech/technology/feeder/default.rss",
    "https://www.thehindu.com/business/feeder/default.rss",
    "https://indianexpress.com/section/cities/bangalore/feed/",
    "https://indianexpress.com/section/india/feed/",
    "https://indianexpress.com/section/technology/feed/",
    "https://feeds.feedburner.com/ndtvnews-india-news",
    "https://feeds.feedburner.com/ndtvnews-cities-news",
    "https://timesofindia.indiatimes.com/rssfeeds/-2128833038.cms",
    "https://timesofindia.indiatimes.com/rssfeeds/2647163.cms",
    "https://timesofindia.indiatimes.com/rssfeeds/-2128838597.cms",
    "https://www.news18.com/commonfeeds/v1/eng/rss/india.xml",
    "https://scroll.in/feed",
]


async def harvest(limit: int) -> list[dict]:
    reddit = RedditCollector(SUBREDDITS)
    rss = RSSCollector(FEEDS)

    print(f"harvesting: {len(SUBREDDITS)} subreddits, {len(FEEDS)} feeds, limit {limit} each...")
    started = time.time()
    reddit_posts, rss_posts = await asyncio.gather(
        reddit.fetch(limit * len(SUBREDDITS)),
        rss.fetch(limit * len(FEEDS)),
        return_exceptions=True,
    )

    out: list[dict] = []
    for name, res in (("reddit", reddit_posts), ("rss", rss_posts)):
        if isinstance(res, Exception):
            print(f"  {name}: FAILED {type(res).__name__}: {res}")
            continue
        print(f"  {name}: {len(res)} posts")
        for rp in res:
            out.append({
                "platform": rp.platform,
                "author": rp.author,
                "text": rp.text,
                "url": rp.url,
                "created_at": rp.created_at,
                "place": rp.place,
            })

    # de-duplicate on text; feeds repeat headlines across sections
    seen: set[str] = set()
    deduped = []
    for p in out:
        key = p["text"][:120].lower().strip()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(p)

    print(f"  {len(out)} collected, {len(deduped)} after de-duplication "
          f"({time.time() - started:.1f}s)")
    return deduped


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=100, help="per source")
    ap.add_argument("--out", default=str(ROOT / "app" / "data" / "harvest.json"))
    ap.add_argument("--append", action="store_true",
                    help="merge into the existing file instead of replacing it")
    args = ap.parse_args()

    posts = await harvest(args.limit)
    out_path = Path(args.out)

    if args.append and out_path.exists():
        existing = json.loads(out_path.read_text(encoding="utf-8")).get("posts", [])
        seen = {p["text"][:120].lower().strip() for p in existing}
        added = [p for p in posts if p["text"][:120].lower().strip() not in seen]
        posts = existing + added
        print(f"  appended {len(added)} new, {len(posts)} total")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps({"harvested_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
                    "count": len(posts), "posts": posts}, indent=1),
        encoding="utf-8",
    )
    print(f"wrote {out_path} ({len(posts)} posts)")

    if len(posts) < 200:
        print("\nNOTE: under 200 documents. HDBSCAN will mostly produce outliers.")
        print("Run again with --append to accumulate, ideally to 500+.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
