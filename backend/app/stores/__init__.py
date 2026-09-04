"""Store registry: three tiers, and it reports which one it actually got.

    configured external  ->  SQLite  ->  in-memory

SQLite is the default rather than the ceiling: it persists across restarts with
nothing to install, which is what makes "here is the last 24 hours" possible on
a laptop. Point the DSNs in .env at docker-compose and the external backends
take over per store. If a configured backend is unreachable, only that store
falls back, and the reason lands on /api/health.
"""
from __future__ import annotations

import logging

from ..config import get_settings
from .base import (
    MemoryAlertStore,
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
from .sqlite import (
    SqliteAlertStore,
    SqliteDB,
    SqliteMetricStore,
    SqliteStreamStore,
    SqliteVectorStore,
)

log = logging.getLogger("visionx.stores")


class Stores:
    def __init__(self) -> None:
        self.metrics = MemoryMetricStore()
        self.graph = MemoryGraphStore()
        self.vectors = MemoryVectorStore()
        self.stream = MemoryStreamStore()
        self.alerts = MemoryAlertStore()
        self.db: SqliteDB | None = None
        self.status: dict[str, dict] = {}

    async def _try(self, key: str, candidate, fallback):
        """Attempt a backend; keep the fallback if it will not connect."""
        if candidate is None:
            self.status[key] = {
                "backend": getattr(fallback, "backend", "memory"),
                "configured": False,
                "persistent": getattr(fallback, "backend", "") == "sqlite",
                "reason": "not configured",
            }
            return fallback
        try:
            await candidate.connect()
            self.status[key] = {
                "backend": candidate.backend,
                "configured": True,
                "persistent": True,
                "reason": None,
            }
            log.info("store %-8s %s", key, candidate.backend)
            return candidate
        except Exception as exc:
            self.status[key] = {
                "backend": getattr(fallback, "backend", "memory"),
                "configured": True,
                "persistent": getattr(fallback, "backend", "") == "sqlite",
                "reason": f"{type(exc).__name__}: {exc}"[:200],
            }
            log.warning("store %s configured but unreachable, falling back: %s", key, exc)
            return fallback

    async def startup(self) -> None:
        s = get_settings()

        # SQLite is the default fallback tier unless explicitly disabled.
        if s.sqlite_enabled:
            try:
                self.db = SqliteDB(s.sqlite_path) if s.sqlite_path else SqliteDB()
                log.info("sqlite at %s", self.db.path)
            except Exception as exc:
                log.warning("sqlite unavailable, using memory: %s", exc)
                self.db = None

        def default(sqlite_cls, memory_cls):
            return sqlite_cls(self.db) if self.db else memory_cls()

        self.metrics = await self._try(
            "metrics",
            TimescaleMetricStore(s.timescale_dsn) if s.timescale_dsn else None,
            default(SqliteMetricStore, MemoryMetricStore),
        )
        self.graph = await self._try(
            "graph",
            Neo4jGraphStore(s.neo4j_uri, s.neo4j_user, s.neo4j_password) if s.neo4j_uri else None,
            MemoryGraphStore(),   # the graph is derived from the corpus; nothing to persist
        )
        self.vectors = await self._try(
            "vectors",
            QdrantVectorStore(s.qdrant_url) if s.qdrant_url else None,
            default(SqliteVectorStore, MemoryVectorStore),
        )
        self.stream = await self._try(
            "stream",
            RedisStreamStore(s.redis_url) if s.redis_url else None,
            default(SqliteStreamStore, MemoryStreamStore),
        )
        self.alerts = await self._try(
            "alerts",
            None,   # no external alert backend yet
            default(SqliteAlertStore, MemoryAlertStore),
        )

        # seed the graph either way, so /api/network/neighbours works immediately
        from ..corpus import accounts, edges  # noqa: PLC0415

        try:
            await self.graph.upsert_network(accounts(), edges())
        except Exception as exc:  # pragma: no cover
            log.warning("graph seed failed: %s", exc)

    def db_stats(self) -> dict | None:
        return self.db.stats() if self.db else None

    async def shutdown(self) -> None:
        for store in (self.metrics, self.graph, self.vectors, self.stream, self.alerts):
            try:
                await store.close()
            except Exception:  # pragma: no cover
                pass
        if self.db:
            self.db.close()


stores = Stores()
