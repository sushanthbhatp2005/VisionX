"""Store interfaces and their in-process implementations.

Every store has a memory implementation that satisfies the same interface, so
the service runs with nothing installed. Point the DSNs in .env at the
containers in docker-compose.yml and the real backends take over; if one of
them is unreachable at startup, that store alone falls back and says so on
/api/health rather than taking the service down.
"""
from __future__ import annotations

import time
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from typing import Any


class MetricStore(ABC):
    """Time series of per-topic metrics. TimescaleDB in production."""

    name = "metrics"

    @abstractmethod
    async def record(self, topic_id: str, point: dict) -> None: ...

    @abstractmethod
    async def history(self, topic_id: str, limit: int = 42) -> list[dict]: ...

    async def close(self) -> None:  # pragma: no cover - trivial
        return None


class GraphStore(ABC):
    """Accounts, edges, communities. Neo4j in production."""

    name = "graph"

    @abstractmethod
    async def upsert_network(self, accounts: list[dict], edges: list[list]) -> None: ...

    @abstractmethod
    async def neighbours(self, account_id: str) -> list[dict]: ...

    async def close(self) -> None:  # pragma: no cover
        return None


class VectorStore(ABC):
    """Post embeddings for near-duplicate detection. Qdrant in production."""

    name = "vectors"

    @abstractmethod
    async def add(self, post_id: str, text: str, payload: dict) -> None: ...

    @abstractmethod
    async def similar(self, text: str, limit: int = 5) -> list[dict]: ...

    async def close(self) -> None:  # pragma: no cover
        return None


class AlertStore(ABC):
    """The alert board. Persisted so a restart does not empty it."""

    name = "alerts"

    @abstractmethod
    async def save(self, alert: dict) -> None: ...

    @abstractmethod
    async def recent(self, limit: int = 30) -> list[dict]: ...

    async def clear(self) -> None:  # pragma: no cover
        return None

    async def close(self) -> None:  # pragma: no cover
        return None


class StreamStore(ABC):
    """Recent posts and fan-out. Redis Streams in production."""

    name = "stream"

    @abstractmethod
    async def push(self, post: dict) -> None: ...

    @abstractmethod
    async def recent(self, limit: int = 50) -> list[dict]: ...

    async def close(self) -> None:  # pragma: no cover
        return None


# ---------------------------------------------------------------------------
# In-process implementations
# ---------------------------------------------------------------------------
def hash_embedding(text: str, dim: int = 64) -> list[float]:
    """Deterministic bag-of-words vector.

    The fallback when sentence-transformers is not installed. Lexical only: it
    finds reused wording, and scores a Hindi post against its English
    equivalent at zero. See app/embeddings.py for the semantic path.
    """
    import math
    import re

    vec = [0.0] * dim
    for tok in re.findall(r"[a-z0-9]+", text.lower()):
        vec[hash(tok) % dim] += 1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


class MemoryMetricStore(MetricStore):
    backend = "memory"

    def __init__(self) -> None:
        self._series: dict[str, deque] = defaultdict(lambda: deque(maxlen=500))

    async def record(self, topic_id: str, point: dict) -> None:
        self._series[topic_id].append(point)

    async def history(self, topic_id: str, limit: int = 42) -> list[dict]:
        return list(self._series[topic_id])[-limit:]


class MemoryGraphStore(GraphStore):
    backend = "memory"

    def __init__(self) -> None:
        self._accounts: dict[str, dict] = {}
        self._edges: list[list] = []

    async def upsert_network(self, accounts: list[dict], edges: list[list]) -> None:
        self._accounts = {a["id"]: a for a in accounts}
        self._edges = edges

    async def neighbours(self, account_id: str) -> list[dict]:
        out = []
        for a, b, w in self._edges:
            other = b if a == account_id else a if b == account_id else None
            if other and other in self._accounts:
                out.append({**self._accounts[other], "weight": w})
        return sorted(out, key=lambda x: -x["weight"])


class MemoryVectorStore(VectorStore):
    backend = "memory"

    def __init__(self) -> None:
        self._items: deque = deque(maxlen=2000)

    async def add(self, post_id: str, text: str, payload: dict) -> None:
        import asyncio  # noqa: PLC0415

        from ..embeddings import embedder  # noqa: PLC0415

        # encoding is ~10-30ms on CPU; keep it off the event loop
        vec = await asyncio.to_thread(embedder.encode, text)
        self._items.append({"id": post_id, "vec": vec, "text": text, "payload": payload})

    async def similar(self, text: str, limit: int = 5) -> list[dict]:
        import asyncio  # noqa: PLC0415

        from ..embeddings import embedder  # noqa: PLC0415

        q = await asyncio.to_thread(embedder.encode, text)
        scored = [
            {"id": it["id"], "score": round(cosine(q, it["vec"]), 4), "text": it["text"], "payload": it["payload"]}
            for it in self._items
            if len(it["vec"]) == len(q)   # the encoder may warm mid-run
        ]
        scored.sort(key=lambda x: -x["score"])
        return scored[:limit]


class MemoryAlertStore(AlertStore):
    backend = "memory"

    def __init__(self) -> None:
        self._alerts: deque = deque(maxlen=100)

    async def save(self, alert: dict) -> None:
        self._alerts.appendleft(alert)

    async def recent(self, limit: int = 30) -> list[dict]:
        return list(self._alerts)[:limit]

    async def clear(self) -> None:
        self._alerts.clear()


class MemoryStreamStore(StreamStore):
    backend = "memory"

    def __init__(self) -> None:
        self._posts: deque = deque(maxlen=200)

    async def push(self, post: dict) -> None:
        self._posts.appendleft({**post, "_at": time.time()})

    async def recent(self, limit: int = 50) -> list[dict]:
        return list(self._posts)[:limit]
