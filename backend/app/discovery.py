"""Topic discovery with BERTopic.

The nine tracked topics in the corpus are *defined* — someone wrote them down.
That is fine for the narrative panels (phases, drivers, recommended actions all
hang off them), but it left "how do you find topics in the first place?" with no
answer at all. Ingested posts were only ever *routed* to a topic that already
existed by keyword.

This discovers them instead: embed → reduce → cluster → extract the terms that
distinguish each cluster. Nothing is named in advance.

  embeddings   paraphrase-multilingual-MiniLM-L12-v2, because a monolingual
               model buries code-mixed text in the outlier cluster
  reduction    UMAP
  clustering   HDBSCAN, which is allowed to say "this is noise" rather than
               forcing every document into a topic
  labelling    c-TF-IDF over each cluster

Discovery runs over the harvested corpus (`tools/harvest.py`), not the
synthetic one — clustering generated text would only rediscover the templates
it was generated from, which proves nothing.
"""
from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

log = logging.getLogger("visionx.discovery")

HARVEST_FILE = Path(__file__).parent / "data" / "harvest.json"
CACHE_FILE = Path(__file__).parent / "data" / "discovery.json"

# Multilingual on purpose: the whole differentiator is not dropping code-mix.
EMBED_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

MIN_DOCS = 100          # below this HDBSCAN produces noise and nothing else
MIN_TOPIC_SIZE = 8      # a "topic" of three headlines is not a topic


def load_harvest() -> list[dict]:
    if not HARVEST_FILE.exists():
        return []
    try:
        return json.loads(HARVEST_FILE.read_text(encoding="utf-8")).get("posts", [])
    except Exception as exc:  # pragma: no cover
        log.warning("could not read harvest: %s", exc)
        return []


def clean(text: str) -> str:
    """Strip boilerplate that would otherwise dominate the c-TF-IDF terms."""
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"\s+", " ", text)
    # feed furniture: "Read more", bylines, section tags
    text = re.sub(r"\b(read more|click here|also read|subscribe)\b", " ", text, flags=re.I)
    return text.strip()


@dataclass
class DiscoveredTopic:
    id: int
    label: str
    keywords: list[str]
    scores: list[float]
    size: int
    share: float
    samples: list[str] = field(default_factory=list)
    platforms: list[str] = field(default_factory=list)
    nearest_tracked: str | None = None
    nearest_score: float = 0.0

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "label": self.label,
            "keywords": self.keywords,
            "scores": [round(s, 4) for s in self.scores],
            "size": self.size,
            "share": round(self.share, 3),
            "samples": self.samples,
            "platforms": self.platforms,
            "nearest_tracked": self.nearest_tracked,
            "nearest_score": round(self.nearest_score, 2),
        }


def _match_tracked(keywords: list[str]) -> tuple[str | None, float]:
    """Does a discovered topic line up with one we already track?

    Reported rather than used: the interesting result is a discovered topic
    that matches *nothing*, because that is a conversation nobody thought to
    watch for.
    """
    from .ingest.service import VOCAB  # noqa: PLC0415

    best, best_hits = None, 0
    kw = {k.lower() for k in keywords}
    for topic_id, (pattern, native) in VOCAB.items():
        hits = sum(1 for k in kw if pattern and pattern.search(k))
        if hits > best_hits:
            best, best_hits = topic_id, hits
    return best, (best_hits / max(len(kw), 1))


def discover(docs: list[dict] | None = None, min_topic_size: int = MIN_TOPIC_SIZE,
             max_docs: int = 2000) -> dict[str, Any]:
    """Run BERTopic. Blocking and slow — call it from a thread."""
    posts = docs if docs is not None else load_harvest()
    posts = posts[:max_docs]

    texts = [clean(p.get("text", "")) for p in posts]
    keep = [i for i, t in enumerate(texts) if len(t.split()) >= 5]
    texts = [texts[i] for i in keep]
    posts = [posts[i] for i in keep]

    if len(texts) < MIN_DOCS:
        return {
            "ok": False,
            "reason": f"only {len(texts)} usable documents; need at least {MIN_DOCS}. "
                      f"Run tools/harvest.py --append to accumulate more.",
            "documents": len(texts),
            "topics": [],
        }

    started = time.time()
    from bertopic import BERTopic  # noqa: PLC0415
    from bertopic.vectorizers import ClassTfidfTransformer  # noqa: PLC0415
    from sentence_transformers import SentenceTransformer  # noqa: PLC0415
    from sklearn.feature_extraction.text import CountVectorizer  # noqa: PLC0415

    embedder = SentenceTransformer(EMBED_MODEL)

    # English stop words plus the words every Indian news headline contains,
    # which would otherwise be the top term of every single cluster.
    boilerplate = ["said", "says", "new", "india", "indian", "year", "years",
                   "day", "days", "time", "people", "state", "government",
                   "news", "report", "reports", "told", "according"]
    vectorizer = CountVectorizer(stop_words="english", ngram_range=(1, 2),
                                 min_df=2, max_df=0.5)

    model = BERTopic(
        embedding_model=embedder,
        vectorizer_model=vectorizer,
        ctfidf_model=ClassTfidfTransformer(reduce_frequent_words=True),
        min_topic_size=min_topic_size,
        calculate_probabilities=False,
        verbose=False,
    )

    topics, _ = model.fit_transform(texts)
    info = model.get_topic_info()

    total = len(texts)
    outliers = int(sum(1 for t in topics if t == -1))

    discovered: list[DiscoveredTopic] = []
    for _, row in info.iterrows():
        tid = int(row["Topic"])
        if tid == -1:                      # HDBSCAN's noise bucket
            continue
        terms = model.get_topic(tid) or []
        terms = [(w, s) for w, s in terms if w.lower() not in boilerplate][:8]
        if not terms:
            continue

        members = [i for i, t in enumerate(topics) if t == tid]
        keywords = [w for w, _ in terms]
        nearest, score = _match_tracked(keywords)

        discovered.append(DiscoveredTopic(
            id=tid,
            label=", ".join(keywords[:3]),
            keywords=keywords,
            scores=[float(s) for _, s in terms],
            size=len(members),
            share=len(members) / total,
            samples=[posts[i].get("text", "")[:160] for i in members[:3]],
            platforms=sorted({posts[i].get("platform", "?") for i in members}),
            nearest_tracked=nearest,
            nearest_score=score,
        ))

    discovered.sort(key=lambda d: -d.size)
    elapsed = round(time.time() - started, 1)
    log.info("discovery: %d topics from %d docs in %ss", len(discovered), total, elapsed)

    return {
        "ok": True,
        "documents": total,
        "topics_found": len(discovered),
        "outliers": outliers,
        "outlier_share": round(outliers / total, 3),
        "min_topic_size": min_topic_size,
        "embedding_model": EMBED_MODEL,
        "elapsed_seconds": elapsed,
        "topics": [d.as_dict() for d in discovered],
        "note": (
            "Discovered from the harvested news corpus, not the synthetic one — "
            "clustering generated text would only rediscover its templates. "
            "Topics matching nothing we already track are the interesting ones."
        ),
    }


# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------
class DiscoveryCache:
    """Discovery takes tens of seconds, so it runs once and is served from here."""

    def __init__(self) -> None:
        self.result: dict | None = None
        self.running = False
        self.last_run: float | None = None
        self.last_error: str | None = None
        self.load_cached()

    def load_cached(self) -> bool:
        """Serve the last exported run immediately, rather than making the
        first caller wait a minute for a fit."""
        if not CACHE_FILE.exists():
            return False
        try:
            self.result = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
            self.last_run = CACHE_FILE.stat().st_mtime
            log.info("discovery: loaded cached run (%s topics)",
                     self.result.get("topics_found"))
            return True
        except Exception as exc:  # pragma: no cover
            log.warning("could not read cached discovery: %s", exc)
            return False

    def run(self, **kwargs) -> dict:
        self.running = True
        try:
            self.result = discover(**kwargs)
            self.last_run = time.time()
            self.last_error = None if self.result.get("ok") else self.result.get("reason")
        except Exception as exc:
            self.last_error = f"{type(exc).__name__}: {exc}"
            log.exception("discovery failed")
            self.result = {"ok": False, "reason": self.last_error, "topics": []}
        finally:
            self.running = False
        return self.result

    def status(self) -> dict:
        r = self.result or {}
        return {
            "has_result": bool(self.result),
            "running": self.running,
            "last_run": self.last_run,
            "last_error": self.last_error,
            "documents": r.get("documents"),
            "topics_found": r.get("topics_found"),
            "outlier_share": r.get("outlier_share"),
            "generated_at": r.get("generated_at"),
            "from_cache": bool(self.result and self.last_run and not self.running),
        }


cache = DiscoveryCache()
