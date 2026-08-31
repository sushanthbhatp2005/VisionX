"""VisionX backend.

    uvicorn app.main:app --reload --port 8000

Starts with no configuration: stores fall back to memory, NLP falls back to
the rule annotator, ingestion stays off. Every one of those is reported on
/api/health so the demo never has to guess what it is actually running.
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .ingest.service import ingest
from .routers.api import router as api_router
from .stores import stores
from .stream import clock, manager, state

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("visionx")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    log.info("starting VisionX backend")

    await stores.startup()
    for key, st in stores.status.items():
        log.info("  store %-8s %-12s %s", key, st["backend"], st.get("reason") or "")

    task = asyncio.create_task(clock())

    # Load NLP models in a thread so startup returns immediately. Until they
    # are ready the rule annotator answers, and /api/health says which is live.
    from .nlp.pipeline import ModelAnnotator, get_annotator  # noqa: PLC0415

    annotator = get_annotator()
    if isinstance(annotator, ModelAnnotator):
        async def _warm():
            ok = await asyncio.to_thread(annotator.warm)
            log.info("  nlp models %s", "loaded" if ok else f"unavailable: {annotator.load_error}")
        warm_task = asyncio.create_task(_warm())
        log.info("  nlp warming in background (rule annotator serving meanwhile)")
    else:
        warm_task = None
        log.info("  nlp backend: rules")

    if settings.ingest_enabled:
        ingest.start(settings.ingest_interval_seconds)
    else:
        log.info("  ingestion disabled (INGEST_ENABLED=false) — POST /api/ingest/run to pull once")

    log.info("ready on :%d", settings.port)
    try:
        yield
    finally:
        task.cancel()
        if warm_task:
            warm_task.cancel()
        await ingest.stop()
        await stores.shutdown()
        log.info("stopped")


settings = get_settings()

app = FastAPI(
    title="VisionX",
    description=(
        "Social media intelligence backend. Collect → Analyse → Predict → Alert → Act. "
        "Serves the same payload shapes the frontend's simulation produces, so the "
        "dashboard runs against either one unchanged."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/")
async def root():
    return {
        "service": "visionx-backend",
        "docs": "/docs",
        "health": "/api/health",
        "stream": "/ws/stream",
    }


@app.websocket("/ws/stream")
async def ws_stream(ws: WebSocket):
    """Snapshot on connect, then a delta every tick."""
    await manager.connect(ws)
    try:
        await ws.send_json(state.snapshot())
        while True:
            # the client may send control messages; ignore malformed ones
            try:
                msg = await ws.receive_json()
            except (ValueError, TypeError):
                continue

            action = msg.get("action")
            if action == "snapshot":
                await ws.send_json(state.snapshot())
            elif action == "escalate":
                state.escalate(msg.get("topic_id", ""), float(msg.get("amount", 1)))
            elif action == "raise":
                alert = state.raise_alert(msg.get("topic_id", ""), msg.get("kind", "sentiment"))
                if alert:
                    await manager.broadcast({"type": "alert", "alert": alert})
            elif action == "reset":
                state.reset()
                await manager.broadcast(state.snapshot())
            elif action == "running":
                state.running = bool(msg.get("value", True))
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        manager.disconnect(ws)
