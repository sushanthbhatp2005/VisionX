"""The real backends: TimescaleDB, Neo4j, Qdrant, Redis.

Each connect() returns True on success and False on any failure. A failure is
never fatal -- the registry falls back to the in-memory implementation for
that store and records why.
"""
from __future__ import annotations

import json
import time

from .base import (
    GraphStore,
    MetricStore,
    StreamStore,
    VectorStore,
    cosine,
    hash_embedding,
)


class TimescaleMetricStore(MetricStore):
    backend = "timescaledb"

    def __init__(self, dsn: str) -> None:
        self.dsn = dsn
        self.pool = None

    async def connect(self) -> bool:
        import asyncpg  # noqa: PLC0415

        self.pool = await asyncpg.create_pool(self.dsn, min_size=1, max_size=5, timeout=5)
        async with self.pool.acquire() as con:
            await con.execute(
                """
                CREATE TABLE IF NOT EXISTS topic_metrics (
                    ts          TIMESTAMPTZ NOT NULL,
                    topic_id    TEXT        NOT NULL,
                    mentions    INTEGER     NOT NULL,
                    pos         SMALLINT    NOT NULL,
                    neu         SMALLINT    NOT NULL,
                    neg         SMALLINT    NOT NULL,
                    anger       SMALLINT    NOT NULL,
                    engagement  INTEGER     NOT NULL
                );
                """
            )
            # hypertable if the extension is present; harmless otherwise
            await con.execute(
                """
                DO $$ BEGIN
                    PERFORM create_hypertable('topic_metrics', 'ts', if_not_exists => TRUE);
                EXCEPTION WHEN undefined_function THEN NULL;
                END $$;
                """
            )
            await con.execute(
                "CREATE INDEX IF NOT EXISTS topic_metrics_topic_ts ON topic_metrics (topic_id, ts DESC);"
            )
        return True

    async def record(self, topic_id: str, point: dict) -> None:
        from datetime import datetime, timezone  # noqa: PLC0415

        ts = datetime.fromtimestamp(point["ts"] / 1000, tz=timezone.utc)
        async with self.pool.acquire() as con:
            await con.execute(
                """INSERT INTO topic_metrics (ts, topic_id, mentions, pos, neu, neg, anger, engagement)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8)""",
                ts, topic_id, point["mentions"], point["pos"], point["neu"],
                point["neg"], point["anger"], point["engagement"],
            )

    async def history(self, topic_id: str, limit: int = 42) -> list[dict]:
        async with self.pool.acquire() as con:
            rows = await con.fetch(
                """SELECT ts, mentions, pos, neu, neg, anger, engagement
                   FROM topic_metrics WHERE topic_id = $1 ORDER BY ts DESC LIMIT $2""",
                topic_id, limit,
            )
        return [
            {
                "t": r["ts"].strftime("%H:%M"),
                "ts": int(r["ts"].timestamp() * 1000),
                "mentions": r["mentions"],
                "pos": r["pos"],
                "neu": r["neu"],
                "neg": r["neg"],
                "anger": r["anger"],
                "engagement": r["engagement"],
            }
            for r in reversed(rows)
        ]

    async def close(self) -> None:
        if self.pool:
            await self.pool.close()


class Neo4jGraphStore(GraphStore):
    backend = "neo4j"

    def __init__(self, uri: str, user: str, password: str) -> None:
        self.uri, self.user, self.password = uri, user, password
        self.driver = None

    async def connect(self) -> bool:
        from neo4j import AsyncGraphDatabase  # noqa: PLC0415

        self.driver = AsyncGraphDatabase.driver(self.uri, auth=(self.user, self.password))
        await self.driver.verify_connectivity()
        return True

    async def upsert_network(self, accounts: list[dict], edges: list[list]) -> None:
        async with self.driver.session() as s:
            await s.run(
                """
                UNWIND $accounts AS a
                MERGE (n:Account {id: a.id})
                SET n.handle = a.handle, n.followers = a.followers,
                    n.engagement = a.engagement, n.centrality = a.centrality,
                    n.community = a.community, n.persona = a.persona,
                    n.suspicious = coalesce(a.suspicious, false)
                """,
                accounts=accounts,
            )
            await s.run(
                """
                UNWIND $edges AS e
                MATCH (a:Account {id: e[0]}), (b:Account {id: e[1]})
                MERGE (a)-[r:INTERACTS]->(b)
                SET r.weight = e[2]
                """,
                edges=edges,
            )

    async def neighbours(self, account_id: str) -> list[dict]:
        async with self.driver.session() as s:
            res = await s.run(
                """
                MATCH (a:Account {id: $id})-[r:INTERACTS]-(b:Account)
                RETURN b.id AS id, b.handle AS handle, b.followers AS followers, r.weight AS weight
                ORDER BY r.weight DESC
                """,
                id=account_id,
            )
            return [dict(rec) async for rec in res]

    async def close(self) -> None:
        if self.driver:
            await self.driver.close()


class QdrantVectorStore(VectorStore):
    backend = "qdrant"
    COLLECTION = "visionx_posts"
    DIM = 64

    def __init__(self, url: str) -> None:
        self.url = url
        self.client = None

    async def connect(self) -> bool:
        from qdrant_client import AsyncQdrantClient  # noqa: PLC0415
        from qdrant_client.models import Distance, VectorParams  # noqa: PLC0415

        self.client = AsyncQdrantClient(url=self.url, timeout=5)
        existing = await self.client.get_collections()
        if self.COLLECTION not in {c.name for c in existing.collections}:
            await self.client.create_collection(
                collection_name=self.COLLECTION,
                vectors_config=VectorParams(size=self.DIM, distance=Distance.COSINE),
            )
        return True

    async def add(self, post_id: str, text: str, payload: dict) -> None:
        from qdrant_client.models import PointStruct  # noqa: PLC0415

        await self.client.upsert(
            collection_name=self.COLLECTION,
            points=[
                PointStruct(
                    id=abs(hash(post_id)) % (2**63),
                    vector=hash_embedding(text, self.DIM),
                    payload={**payload, "text": text},
                )
            ],
        )

    async def similar(self, text: str, limit: int = 5) -> list[dict]:
        res = await self.client.search(
            collection_name=self.COLLECTION,
            query_vector=hash_embedding(text, self.DIM),
            limit=limit,
        )
        return [
            {"id": str(p.id), "score": round(p.score, 4), "text": (p.payload or {}).get("text", ""), "payload": p.payload}
            for p in res
        ]

    async def close(self) -> None:
        if self.client:
            await self.client.close()


class RedisStreamStore(StreamStore):
    backend = "redis"
    KEY = "visionx:posts"

    def __init__(self, url: str) -> None:
        self.url = url
        self.client = None

    async def connect(self) -> bool:
        import redis.asyncio as redis  # noqa: PLC0415

        self.client = redis.from_url(self.url, decode_responses=True)
        await self.client.ping()
        return True

    async def push(self, post: dict) -> None:
        await self.client.xadd(self.KEY, {"payload": json.dumps(post)}, maxlen=500, approximate=True)

    async def recent(self, limit: int = 50) -> list[dict]:
        entries = await self.client.xrevrange(self.KEY, count=limit)
        out = []
        for _id, fields in entries:
            try:
                out.append(json.loads(fields["payload"]))
            except (KeyError, json.JSONDecodeError):
                continue
        return out

    async def close(self) -> None:
        if self.client:
            await self.client.aclose()
