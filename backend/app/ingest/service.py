"""Ingestion service: collect, annotate, route to a topic, persist.

Real posts and synthetic ones end up in the same shape, so the dashboard does
not need to know which it is looking at -- only the `source` field differs.
"""
from __future__ import annotations

import asyncio
import logging
import re
import time
from typing import Any

from ..corpus import topics
from ..nlp.pipeline import get_annotator
from .collectors import Collector, RawPost, build_collectors

log = logging.getLogger("visionx.ingest")

# Extra routing vocabulary per topic, on top of the tag and title words.
TOPIC_KEYWORDS: dict[str, set[str]] = {
    "traffic": {"traffic", "jam", "orr", "road", "commute", "signal", "bmtc", "gridlock", "bus", "ಟ್ರಾಫಿಕ್", "ट्रैफिक"},
    "water": {"water", "cauvery", "tanker", "supply", "borewell", "pumping", "neeru", "ನೀರು", "पानी"},
    "exam": {"exam", "result", "portal", "answer key", "marks", "score", "board"},
    "nep": {"education", "policy", "curriculum", "assessment", "school", "syllabus", "nep"},
    "metro": {"metro", "corridor", "phase", "namma metro", "rail", "station"},
    "lang": {"language", "kannada", "hindi", "mother tongue", "three-language", "bhasha"},
    "power": {"power", "electricity", "outage", "load shedding", "bescom", "current", "feeder", "ವಿದ್ಯುತ್", "बिजली"},
    "flood": {"flood", "rain", "alert", "monsoon", "coastal", "cyclone", "imd", "landslide"},
    "health": {"dengue", "health", "hospital", "fever", "outbreak", "cases", "mosquito", "vaccine"},
}


# A term has to match as a whole word, not a substring: "bus" inside
# "businessman" and "road" inside "broad" both routed real news to the wrong
# topic before this was tightened.
MIN_HITS = 2


def _topic_vocab() -> dict[str, tuple[re.Pattern | None, list[str]]]:
    """Per topic: a word-boundary regex for Latin terms, plus native-script
    terms matched by containment (word boundaries do not apply to Indic scripts)."""
    vocab: dict[str, tuple[re.Pattern | None, list[str]]] = {}
    for t in topics():
        terms = set(TOPIC_KEYWORDS.get(t["id"], set()))
        terms |= {w.lower() for w in re.findall(r"[A-Za-z]{4,}", t["tag"] + " " + t["title"])}

        latin = sorted({w for w in terms if w.isascii()}, key=len, reverse=True)
        native = [w for w in terms if not w.isascii()]
        pattern = (
            re.compile(r"\b(?:" + "|".join(re.escape(w) for w in latin) + r")\b", re.I)
            if latin else None
        )
        vocab[t["id"]] = (pattern, native)
    return vocab


VOCAB = _topic_vocab()


def route_to_topic(text: str) -> tuple[str | None, int]:
    """Pick the best-matching tracked topic.

    Returns (topic_id, hits). Below MIN_HITS the post is left unrouted rather
    than forced into the nearest topic -- an unrouted real post is honest,
    a mis-routed one corrupts the numbers on screen.
    """
    best, best_hits = None, 0
    for topic_id, (pattern, native) in VOCAB.items():
        hits = len({m.group(0).lower() for m in pattern.finditer(text)}) if pattern else 0
        hits += sum(1 for w in native if w in text)
        if hits > best_hits:
            best, best_hits = topic_id, hits
    if best_hits < MIN_HITS:
        return None, best_hits
    return best, best_hits


class IngestService:
    def __init__(self) -> None:
        self.collectors: list[Collector] = build_collectors()
        self.last_run: float | None = None
        self.last_error: str | None = None
        self.total_collected = 0
        self.total_routed = 0
        self._task: asyncio.Task | None = None

    async def status(self) -> dict[str, Any]:
        cols = []
        for c in self.collectors:
            ok, why = await c.available()
            cols.append(
                {
                    "platform": c.platform,
                    "available": ok,
                    "requires_key": c.requires_key,
                    "reason": why or None,
                }
            )
        return {
            "collectors": cols,
            "last_run": self.last_run,
            "last_error": self.last_error,
            "total_collected": self.total_collected,
            "total_routed": self.total_routed,
            "running": self._task is not None and not self._task.done(),
        }

    async def collect_once(self, limit_per_source: int = 20, persist: bool = True) -> list[dict]:
        """Run every available collector once and return annotated posts."""
        from ..stores import stores  # noqa: PLC0415

        annotator = get_annotator()
        raw: list[RawPost] = []

        results = await asyncio.gather(
            *(c.fetch(limit_per_source) for c in self.collectors), return_exceptions=True
        )
        for c, res in zip(self.collectors, results):
            if isinstance(res, Exception):
                self.last_error = f"{c.platform}: {type(res).__name__}: {res}"
                log.warning("collector %s failed: %s", c.platform, res)
                continue
            raw.extend(res)

        out: list[dict] = []
        for i, rp in enumerate(raw):
            ann = annotator.annotate(rp.text)
            topic_id, hits = route_to_topic(rp.text)
            post = {
                "id": f"ing{int(time.time() * 1000)}_{i}",
                "topic": topic_id,
                "tag": next((t["tag"] for t in topics() if t["id"] == topic_id), None),
                "platform": rp.platform,
                "platformName": rp.platform.title(),
                "author": rp.author,
                "text": rp.text[:400],
                "url": rp.url,
                "lang": ann.lang,
                "sentiment": ann.sentiment,
                "surface": ann.surface,
                "sarcasm": ann.sarcasm,
                "emotion": ann.emotion,
                "stance": ann.stance,
                "place": rp.place,
                "bot": ann.bot,
                "at": int((rp.created_at or time.time()) * 1000),
                "source": "live",
                "nlp": ann.backend,
                "topic_match": hits,
            }
            out.append(post)

            if persist:
                try:
                    await stores.stream.push(post)
                    await stores.vectors.add(post["id"], post["text"], {"platform": rp.platform, "topic": topic_id})
                except Exception as exc:  # pragma: no cover
                    log.warning("persist failed: %s", exc)

        self.last_run = time.time()
        self.total_collected += len(raw)
        self.total_routed += sum(1 for p in out if p["topic"])
        log.info("ingest: %d collected, %d routed to a tracked topic", len(raw), self.total_routed)
        return out

    async def _loop(self, interval: int) -> None:
        while True:
            try:
                await self.collect_once()
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # pragma: no cover
                self.last_error = str(exc)
                log.exception("ingest loop error")
            await asyncio.sleep(interval)

    def start(self, interval: int) -> None:
        if self._task and not self._task.done():
            return
        self._task = asyncio.create_task(self._loop(interval))
        log.info("ingest loop started, every %ss", interval)

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
            self._task = None


ingest = IngestService()
