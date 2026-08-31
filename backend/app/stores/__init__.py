"""Store registry: try the configured backend, fall back to memory, report both."""
from __future__ import annotations

import logging

from ..config import get_settings
from .base import (
    MemoryGraphStore,
    MemoryMetricStore,
    MemoryStreamStore,
    MemoryVectorStore,
)
from .external import (
    Neo4jGraphStore,
    QdrantVectorStore,
    RedisStreamStore,
    TimescaleMetricStore,
)

log = logging.getLogger("visionx.stores")


class Stores:
    def __init__(self) -> None:
        self.metrics = MemoryMetricStore()
        self.graph = MemoryGraphStore()
        self.vectors = MemoryVectorStore()
        self.stream = MemoryStreamStore()
        self.status: dict[str, dict] = {}

    async def _try(self, key: str, candidate, fallback):
        """Attempt the real backend; keep the memory one if it will not connect."""
        if candidate is None:
            self.status[key] = {"backend": fallback.backend, "configured": False, "reason": "not configured"}
            return fallback
        try:
            await candidate.connect()
            self.status[key] = {"backend": candidate.backend, "configured": True, "reason": None}
            log.info("store %s -> %s", key, candidate.backend)
            return candidate
        except Exception as exc:
            self.status[key] = {
                "backend": fallback.backend,
                "configured": True,
                "reason": f"{type(exc).__name__}: {exc}"[:200],
            }
            log.warning("store %s configured but unreachable, using memory: %s", key, exc)
            return fallback

    async def startup(self) -> None:
        s = get_settings()

        self.metrics = await self._try(
            "metrics",
            TimescaleMetricStore(s.timescale_dsn) if s.timescale_dsn else None,
            MemoryMetricStore(),
        )
        self.graph = await self._try(
            "graph",
            Neo4jGraphStore(s.neo4j_uri, s.neo4j_user, s.neo4j_password) if s.neo4j_uri else None,
            MemoryGraphStore(),
        )
        self.vectors = await self._try(
            "vectors",
            QdrantVectorStore(s.qdrant_url) if s.qdrant_url else None,
            MemoryVectorStore(),
        )
        self.stream = await self._try(
            "stream",
            RedisStreamStore(s.redis_url) if s.redis_url else None,
            MemoryStreamStore(),
        )

        # seed the graph either way, so /api/network/neighbours works immediately
        from ..corpus import accounts, edges  # noqa: PLC0415

        try:
            await self.graph.upsert_network(accounts(), edges())
        except Exception as exc:  # pragma: no cover
            log.warning("graph seed failed: %s", exc)

    async def shutdown(self) -> None:
        for store in (self.metrics, self.graph, self.vectors, self.stream):
            try:
                await store.close()
            except Exception:  # pragma: no cover
                pass


stores = Stores()
