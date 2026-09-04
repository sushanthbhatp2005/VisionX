"""SQLite-backed stores: persistence with nothing to install.

Before this, metrics and alerts lived in in-process deques and vanished on
restart — the dashboard could only ever show "since I pressed start". The
TimescaleDB path existed but needs Docker running, which is a lot to ask of a
laptop five minutes before a demo.

SQLite sits between the two: a single file, no service, survives a reboot. The
external backends still take over when their DSNs are configured; this is the
default rather than the ceiling.

Writes go through a lock and a single connection opened with
`check_same_thread=False`, because the tick loop and request handlers touch it
from different threads.
"""
from __future__ import annotations

import json
import logging
import sqlite3
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

from .base import AlertStore, MetricStore, StreamStore, VectorStore, cosine

log = logging.getLogger("visionx.stores.sqlite")

DEFAULT_PATH = Path(__file__).resolve().parents[1] / "data" / "visionx.db"


class SqliteDB:
    """One connection, shared by the stores below."""

    def __init__(self, path: Path | str = DEFAULT_PATH) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.lock = threading.Lock()
        self._migrate()

    def _migrate(self) -> None:
        with self.lock:
            self.conn.executescript(
                """
                PRAGMA journal_mode=WAL;

                CREATE TABLE IF NOT EXISTS topic_metrics (
                    ts         INTEGER NOT NULL,
                    topic_id   TEXT    NOT NULL,
                    mentions   INTEGER NOT NULL,
                    pos        INTEGER NOT NULL,
                    neu        INTEGER NOT NULL,
                    neg        INTEGER NOT NULL,
                    anger      INTEGER NOT NULL,
                    engagement INTEGER NOT NULL,
                    PRIMARY KEY (topic_id, ts)
                );
                CREATE INDEX IF NOT EXISTS ix_metrics_topic_ts
                    ON topic_metrics (topic_id, ts DESC);

                CREATE TABLE IF NOT EXISTS alerts (
                    id       TEXT PRIMARY KEY,
                    topic_id TEXT    NOT NULL,
                    at       INTEGER NOT NULL,
                    kind     TEXT    NOT NULL,
                    severity TEXT    NOT NULL,
                    payload  TEXT    NOT NULL
                );
                CREATE INDEX IF NOT EXISTS ix_alerts_at ON alerts (at DESC);

                CREATE TABLE IF NOT EXISTS posts (
                    id       TEXT PRIMARY KEY,
                    at       INTEGER NOT NULL,
                    topic_id TEXT,
                    source   TEXT,
                    payload  TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS ix_posts_at ON posts (at DESC);

                CREATE TABLE IF NOT EXISTS vectors (
                    id      TEXT PRIMARY KEY,
                    at      INTEGER NOT NULL,
                    text    TEXT NOT NULL,
                    dim     INTEGER NOT NULL,
                    vec     TEXT NOT NULL,
                    payload TEXT NOT NULL
                );
                """
            )
            self.conn.commit()

    def close(self) -> None:
        try:
            self.conn.close()
        except Exception:  # pragma: no cover
            pass

    def stats(self) -> dict:
        with self.lock:
            cur = self.conn.cursor()
            out = {}
            for table in ("topic_metrics", "alerts", "posts", "vectors"):
                out[table] = cur.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        size = self.path.stat().st_size if self.path.exists() else 0
        return {**out, "file": str(self.path), "size_kb": round(size / 1024, 1)}


class SqliteMetricStore(MetricStore):
    backend = "sqlite"

    def __init__(self, db: SqliteDB, retain_hours: int = 48) -> None:
        self.db = db
        self.retain_hours = retain_hours
        self._writes = 0

    async def connect(self) -> bool:
        return True

    async def record(self, topic_id: str, point: dict) -> None:
        with self.db.lock:
            self.db.conn.execute(
                """INSERT OR REPLACE INTO topic_metrics
                   (ts, topic_id, mentions, pos, neu, neg, anger, engagement)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (point["ts"], topic_id, point["mentions"], point["pos"], point["neu"],
                 point["neg"], point["anger"], point["engagement"]),
            )
            self._writes += 1
            # prune occasionally rather than on every write
            if self._writes % 500 == 0:
                cutoff = int((time.time() - self.retain_hours * 3600) * 1000)
                self.db.conn.execute("DELETE FROM topic_metrics WHERE ts < ?", (cutoff,))
            self.db.conn.commit()

    async def history(self, topic_id: str, limit: int = 42) -> list[dict]:
        with self.db.lock:
            rows = self.db.conn.execute(
                """SELECT ts, mentions, pos, neu, neg, anger, engagement
                   FROM topic_metrics WHERE topic_id = ? ORDER BY ts DESC LIMIT ?""",
                (topic_id, limit),
            ).fetchall()
        return [
            {
                "t": datetime.fromtimestamp(r["ts"] / 1000).strftime("%H:%M"),
                "ts": r["ts"],
                "mentions": r["mentions"],
                "pos": r["pos"], "neu": r["neu"], "neg": r["neg"],
                "anger": r["anger"], "engagement": r["engagement"],
            }
            for r in reversed(rows)
        ]

    async def since(self, topic_id: str, hours: float = 24) -> list[dict]:
        cutoff = int((time.time() - hours * 3600) * 1000)
        with self.db.lock:
            rows = self.db.conn.execute(
                """SELECT ts, mentions, pos, neu, neg, anger, engagement
                   FROM topic_metrics WHERE topic_id = ? AND ts >= ? ORDER BY ts ASC""",
                (topic_id, cutoff),
            ).fetchall()
        return [dict(r) for r in rows]


class SqliteAlertStore(AlertStore):
    backend = "sqlite"

    def __init__(self, db: SqliteDB) -> None:
        self.db = db

    async def connect(self) -> bool:
        return True

    async def save(self, alert: dict) -> None:
        with self.db.lock:
            self.db.conn.execute(
                """INSERT OR REPLACE INTO alerts (id, topic_id, at, kind, severity, payload)
                   VALUES (?,?,?,?,?,?)""",
                (alert["id"], alert["topicId"], alert["at"], alert.get("kind", "?"),
                 alert.get("severity", "?"), json.dumps(alert)),
            )
            self.db.conn.commit()

    async def recent(self, limit: int = 30) -> list[dict]:
        with self.db.lock:
            rows = self.db.conn.execute(
                "SELECT payload FROM alerts ORDER BY at DESC LIMIT ?", (limit,)
            ).fetchall()
        out = []
        for r in rows:
            try:
                out.append(json.loads(r["payload"]))
            except json.JSONDecodeError:
                continue
        return out

    async def clear(self) -> None:
        with self.db.lock:
            self.db.conn.execute("DELETE FROM alerts")
            self.db.conn.commit()


class SqliteStreamStore(StreamStore):
    backend = "sqlite"

    def __init__(self, db: SqliteDB, keep: int = 2000) -> None:
        self.db = db
        self.keep = keep
        self._writes = 0

    async def connect(self) -> bool:
        return True

    async def push(self, post: dict) -> None:
        with self.db.lock:
            self.db.conn.execute(
                "INSERT OR REPLACE INTO posts (id, at, topic_id, source, payload) VALUES (?,?,?,?,?)",
                (post.get("id", f"p{time.time_ns()}"), post.get("at", int(time.time() * 1000)),
                 post.get("topic"), post.get("source", "?"), json.dumps(post)),
            )
            self._writes += 1
            if self._writes % 200 == 0:
                self.db.conn.execute(
                    "DELETE FROM posts WHERE id NOT IN "
                    "(SELECT id FROM posts ORDER BY at DESC LIMIT ?)", (self.keep,)
                )
            self.db.conn.commit()

    async def recent(self, limit: int = 50) -> list[dict]:
        with self.db.lock:
            rows = self.db.conn.execute(
                "SELECT payload FROM posts ORDER BY at DESC LIMIT ?", (limit,)
            ).fetchall()
        out = []
        for r in rows:
            try:
                out.append(json.loads(r["payload"]))
            except json.JSONDecodeError:
                continue
        return out


class SqliteVectorStore(VectorStore):
    """Persisted vectors with an in-Python cosine scan.

    A brute-force scan over a few thousand rows is well under a millisecond and
    needs no extra service. Qdrant takes over when it is configured; this is
    what makes similarity survive a restart without one.
    """

    backend = "sqlite"

    def __init__(self, db: SqliteDB, keep: int = 5000) -> None:
        self.db = db
        self.keep = keep
        self._writes = 0

    async def connect(self) -> bool:
        return True

    async def add(self, post_id: str, text: str, payload: dict) -> None:
        import asyncio  # noqa: PLC0415

        from ..embeddings import embedder  # noqa: PLC0415

        # encoding is ~10-30ms on CPU; keep it off the event loop
        vec = await asyncio.to_thread(embedder.encode, text)
        with self.db.lock:
            self.db.conn.execute(
                "INSERT OR REPLACE INTO vectors (id, at, text, dim, vec, payload) VALUES (?,?,?,?,?,?)",
                (post_id, int(time.time() * 1000), text[:400], len(vec),
                 json.dumps(vec), json.dumps(payload)),
            )
            self._writes += 1
            if self._writes % 200 == 0:
                self.db.conn.execute(
                    "DELETE FROM vectors WHERE id NOT IN "
                    "(SELECT id FROM vectors ORDER BY at DESC LIMIT ?)", (self.keep,)
                )
            self.db.conn.commit()

    async def similar(self, text: str, limit: int = 5) -> list[dict]:
        """Hybrid dense + lexical retrieval.

        Measured on this corpus: the encoder handles native scripts well
        (a Kannada-script complaint scores 0.63 against an English query) but
        *romanised* Hindi is out of its training distribution and scored 0.09
        against the same query. A purely dense store therefore drops exactly
        the code-mix this project exists to handle.

        So each hit carries both scores and ranks on the larger, letting a
        strong lexical match rescue text the encoder cannot place.
        """
        import asyncio  # noqa: PLC0415

        from .base import hash_embedding  # noqa: PLC0415
        from ..embeddings import embedder  # noqa: PLC0415

        q = await asyncio.to_thread(embedder.encode, text)
        q_lex = hash_embedding(text)

        with self.db.lock:
            rows = self.db.conn.execute(
                "SELECT id, text, dim, vec, payload FROM vectors WHERE dim = ?", (len(q),)
            ).fetchall()

        scored = []
        for r in rows:
            try:
                v = json.loads(r["vec"])
            except json.JSONDecodeError:
                continue
            semantic = cosine(q, v)
            lexical = cosine(q_lex, hash_embedding(r["text"]))
            scored.append({
                "id": r["id"],
                "score": round(max(semantic, lexical * 0.9), 4),
                "semantic": round(semantic, 4),
                "lexical": round(lexical, 4),
                "text": r["text"],
                "payload": json.loads(r["payload"]) if r["payload"] else {},
            })
        scored.sort(key=lambda x: -x["score"])
        return scored[:limit]
