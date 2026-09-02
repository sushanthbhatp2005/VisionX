"""Coordinated-behaviour detection, computed rather than asserted.

The UI used to state "37 accounts, 82% identical narratives, 90-second
windows" as a fixed string. This computes it: cluster near-identical posts,
require several distinct accounts inside a tight time window, and score the
cluster on how anomalous that combination is.

Deliberately conservative, and deliberately called "potentially coordinated".
Several accounts quoting the same press release inside a minute is a normal
thing that happens; the output is a queue item for a human, not a verdict.
"""
from __future__ import annotations

import math
import re
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Iterable

# --- thresholds ------------------------------------------------------------
# Calibrated against the corpus rather than guessed. Measured Jaccard over
# 3-word shingles: reworded reposts of one narrative score 0.32-0.91, while a
# fact-check on the same topic in the same minute scores 0.000 against every
# one of them. The gap is wide, so the threshold sits well inside it.
MIN_ACCOUNTS = 3            # below this it is a coincidence, not a pattern
SIMILARITY_THRESHOLD = 0.30
WINDOW_SECONDS = 900        # 15 min ceiling; the reported window is the real spread
SHINGLE_SIZE = 3


def _tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def shingles(text: str, n: int = SHINGLE_SIZE) -> set[str]:
    """Word n-grams. Catches reworded reposts that a bag of words would miss."""
    toks = _tokens(text)
    if len(toks) < n:
        return {" ".join(toks)} if toks else set()
    return {" ".join(toks[i : i + n]) for i in range(len(toks) - n + 1)}


def jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


@dataclass
class Cluster:
    posts: list[dict] = field(default_factory=list)
    _shingles: list[set[str]] = field(default_factory=list, repr=False)

    @property
    def accounts(self) -> set[str]:
        return {p.get("author", "?") for p in self.posts}

    @property
    def window_seconds(self) -> int:
        times = [p.get("at", 0) / 1000 for p in self.posts if p.get("at")]
        return int(max(times) - min(times)) if len(times) > 1 else 0

    @property
    def overlap(self) -> float:
        """Mean pairwise similarity inside the cluster."""
        if len(self._shingles) < 2:
            return 0.0
        pairs = [
            jaccard(self._shingles[i], self._shingles[j])
            for i in range(len(self._shingles))
            for j in range(i + 1, len(self._shingles))
        ]
        return sum(pairs) / len(pairs) if pairs else 0.0

    def score(self) -> int:
        """0-100. Rewards many distinct accounts, tight timing, high overlap."""
        n = len(self.accounts)
        if n < MIN_ACCOUNTS:
            return 0

        # more accounts is more suspicious, with diminishing returns
        account_factor = min(1.0, math.log(n, 2) / math.log(12, 2))
        # reworded reposts of one narrative measure ~0.5 mean pairwise, not
        # ~1.0, so the scale starts where real near-duplicates actually sit
        overlap_factor = min(1.0, max(0.0, (self.overlap - 0.25) / 0.5))
        # a tight window is suspicious; an hour apart is not
        w = self.window_seconds
        timing_factor = 1.0 if w <= 120 else max(0.0, 1 - (w - 120) / (WINDOW_SECONDS - 120))

        raw = 0.38 * account_factor + 0.38 * overlap_factor + 0.24 * timing_factor
        return int(round(raw * 100))

    def as_dict(self) -> dict[str, Any]:
        by_account: dict[str, int] = defaultdict(int)
        for p in self.posts:
            by_account[p.get("author", "?")] += 1
        return {
            "accounts": sorted(self.accounts),
            "account_count": len(self.accounts),
            "post_count": len(self.posts),
            "window_seconds": self.window_seconds,
            "narrative_overlap": round(self.overlap * 100),
            "score": self.score(),
            "posts_per_account": dict(by_account),
            "sample": self.posts[0].get("text", "")[:180] if self.posts else "",
            "platforms": sorted({p.get("platform", "?") for p in self.posts}),
        }


def find_clusters(posts: Iterable[dict]) -> list[Cluster]:
    """Greedy single-pass clustering on shingle similarity within a window."""
    ordered = sorted(
        [p for p in posts if p.get("text")],
        key=lambda p: p.get("at", 0),
    )

    clusters: list[Cluster] = []
    for post in ordered:
        sh = shingles(post["text"])
        if not sh:
            continue

        placed = False
        for c in clusters:
            # only compare against a cluster still inside the time window
            last_at = c.posts[-1].get("at", 0) / 1000
            this_at = post.get("at", 0) / 1000
            if last_at and this_at and abs(this_at - last_at) > WINDOW_SECONDS:
                continue
            if any(jaccard(sh, other) >= SIMILARITY_THRESHOLD for other in c._shingles):
                c.posts.append(post)
                c._shingles.append(sh)
                placed = True
                break

        if not placed:
            clusters.append(Cluster(posts=[post], _shingles=[sh]))

    return clusters


def detect(posts: Iterable[dict], min_score: int = 40) -> dict[str, Any]:
    """Run detection over a post set and summarise what was found."""
    posts = list(posts)
    clusters = [c for c in find_clusters(posts) if len(c.accounts) >= MIN_ACCOUNTS]
    scored = sorted(
        (c for c in clusters if c.score() >= min_score),
        key=lambda c: -c.score(),
    )

    flagged_accounts = sorted({a for c in scored for a in c.accounts})
    top = scored[0].as_dict() if scored else None

    return {
        "posts_examined": len(posts),
        "clusters_found": len(clusters),
        "clusters_flagged": len(scored),
        "flagged_accounts": flagged_accounts,
        "top_cluster": top,
        "clusters": [c.as_dict() for c in scored[:5]],
        "thresholds": {
            "min_accounts": MIN_ACCOUNTS,
            "similarity": SIMILARITY_THRESHOLD,
            "window_seconds": WINDOW_SECONDS,
        },
        "note": (
            "Potentially coordinated. Several accounts quoting one source inside a "
            "minute is ordinary; this is a queue item for human review, not a finding."
        ),
    }
