"""The synthetic corpus, loaded from the JSON exported out of the frontend.

Regenerate with:  node backend/tools/export_corpus.mjs

Keeping one source of truth means the Python service and the React app cannot
drift apart on topic ids, account handles or scoring inputs.
"""
from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Any

DATA_FILE = Path(__file__).parent / "data" / "corpus.json"


@lru_cache
def corpus() -> dict[str, Any]:
    with DATA_FILE.open(encoding="utf-8") as fh:
        return json.load(fh)


def topics() -> list[dict]:
    return corpus()["topics"]


def topic(topic_id: str) -> dict | None:
    return next((t for t in topics() if t["id"] == topic_id), None)


def accounts() -> list[dict]:
    return corpus()["accounts"]


def account(account_id: str) -> dict | None:
    return next((a for a in accounts() if a["id"] == account_id), None)


def edges() -> list[list]:
    return corpus()["edges"]


def communities() -> list[dict]:
    return corpus()["communities"]


def posts() -> list[dict]:
    return corpus()["posts"]


def phases(topic_id: str) -> dict | None:
    return corpus()["phases"].get(topic_id)


def related(topic_id: str) -> list[dict]:
    return corpus()["related"].get(topic_id, [])


def cascade(topic_id: str) -> list[dict]:
    return corpus()["cascades"].get(topic_id, [])


def influence_score(acc: dict) -> int:
    """Deliberately not follower count. Mirrors influenceScore() in seed.js."""
    reach = min(math.log10(acc["followers"]) / 7, 1)
    eng = min(acc["engagement"] / 15, 1)
    amp = min(acc["amplification"] / 6, 1)
    raw = (
        0.22 * reach
        + 0.26 * eng
        + 0.24 * acc["centrality"]
        + 0.18 * acc["relevance"]
        + 0.10 * amp
    )
    return min(99, round(raw * 118))
