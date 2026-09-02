"""REST surface. Shapes match what the frontend already consumes."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from .. import corpus as C
from ..config import get_settings
from ..coordination import detect as detect_coordination
from ..graph import enriched_accounts, metrics as graph_metrics, top_by
from ..engine import (
    crisis_factors,
    fusion_score,
    risk_band,
    top_influencers,
    virality_factors,
)
from ..ingest.service import ingest, route_to_topic
from ..nlp.pipeline import get_annotator
from ..stores import stores
from ..stream import manager, state

router = APIRouter(prefix="/api")


# --- health ----------------------------------------------------------------
@router.get("/health")
async def health():
    from ..nlp.pipeline import ModelAnnotator  # noqa: PLC0415

    ann = get_annotator()
    nlp = {"requested": get_settings().nlp_backend, "active": ann.name}
    if isinstance(ann, ModelAnnotator):
        nlp |= {
            "sentiment_model": ann.sentiment_model,
            "emotion_model": ann.emotion_model,
            "loaded": ann._sentiment is not None,
            "load_error": ann.load_error,
        }

    return {
        "status": "ok",
        "service": "visionx-backend",
        "tick": state.tick,
        "running": state.running,
        "clients": manager.count,
        "topics": len(C.topics()),
        "accounts": len(C.accounts()),
        "nlp": nlp,
        "stores": stores.status,
        "ingest": await ingest.status(),
    }


# --- corpus ----------------------------------------------------------------
@router.get("/topics")
async def list_topics():
    out = []
    for t in C.topics():
        live = state.topics.get(t["id"], {})
        fusion = fusion_score(t, live)
        out.append(
            {
                **t,
                "live": {k: v for k, v in live.items() if k not in {"history", "forecast"}},
                "fusion": fusion["score"],
                "band": risk_band(fusion["score"]),
            }
        )
    return out


@router.get("/topics/{topic_id}")
async def get_topic(topic_id: str):
    t = C.topic(topic_id)
    if not t:
        raise HTTPException(404, f"unknown topic: {topic_id}")
    live = state.topics.get(topic_id, {})
    fusion = fusion_score(t, live)
    return {
        **t,
        "live": live,
        "fusion": fusion,
        "band": risk_band(fusion["score"]),
        "crisisFactors": crisis_factors(t, live),
        "viralityFactors": virality_factors(t, live),
        "phases": C.phases(topic_id),
        "related": C.related(topic_id),
        "influencers_detail": top_influencers(t),
    }


@router.get("/topics/{topic_id}/cascade")
async def get_cascade(topic_id: str):
    if not C.topic(topic_id):
        raise HTTPException(404, f"unknown topic: {topic_id}")
    return C.cascade(topic_id)


# --- network ---------------------------------------------------------------
@router.get("/network")
async def network():
    """Accounts with computed structure: PageRank, Louvain, betweenness.

    `centrality` is PageRank normalised to the top-ranked account; the authored
    value it replaced is kept alongside as `centrality_authored` so the two can
    be compared on screen.
    """
    m = graph_metrics()
    return {
        "accounts": enriched_accounts(),
        "edges": C.edges(),
        "communities": C.communities(),          # the hand-authored labels
        "detected_communities": m["communities"],  # what Louvain actually found
        "graph": {
            "nodes": m["nodes"],
            "edges": m["edges"],
            "density": m["density"],
            "avg_degree": m["avg_degree"],
            "components": m["components"],
            "modularity": m["modularity"],
        },
        "computed_by": "networkx",
    }


@router.get("/network/ranking")
async def ranking(measure: str = Query("pagerank", pattern="^(pagerank|betweenness|degree|eigenvector)$"),
                  limit: int = Query(8, ge=1, le=24)):
    return {"measure": measure, "ranking": top_by(measure, limit)}


@router.get("/coordination")
async def coordination(topic_id: str | None = None, min_score: int = Query(40, ge=0, le=100)):
    """Detect coordinated posting, computed over the live feed plus the corpus
    sample -- rather than the fixed claim this used to be."""
    import time as _time  # noqa: PLC0415

    now = _time.time()
    sample = [
        {**p, "at": int((now - p["offsetSec"]) * 1000)}
        for p in C.corpus().get("coordinated_sample", [])
    ]
    streamed = [p for p in state.feed if p.get("text")]
    if topic_id:
        sample = [p for p in sample if p.get("topic") == topic_id]
        streamed = [p for p in streamed if p.get("topic") == topic_id]

    return detect_coordination(sample + streamed, min_score=min_score)


@router.get("/network/neighbours/{account_id}")
async def neighbours(account_id: str):
    if not C.account(account_id):
        raise HTTPException(404, f"unknown account: {account_id}")
    return await stores.graph.neighbours(account_id)


# --- feed and alerts -------------------------------------------------------
@router.get("/feed")
async def feed(limit: int = Query(50, ge=1, le=200), source: str | None = None):
    posts = state.feed
    if source:
        posts = [p for p in posts if p.get("source") == source]
    return posts[:limit]


@router.get("/alerts")
async def alerts():
    return state.alerts


class RaiseAlert(BaseModel):
    topic_id: str
    kind: str


@router.post("/alerts/raise")
async def raise_alert(body: RaiseAlert):
    alert = state.raise_alert(body.topic_id, body.kind)
    if alert:
        await manager.broadcast({"type": "alert", "alert": alert})
    return {"raised": bool(alert), "alert": alert}


# --- demo controls ---------------------------------------------------------
class Escalate(BaseModel):
    topic_id: str
    amount: float = 1.0


@router.post("/control/escalate")
async def escalate(body: Escalate):
    state.escalate(body.topic_id, body.amount)
    return {"ok": True, "topic_id": body.topic_id, "escalation": body.amount}


@router.post("/control/reset")
async def reset():
    state.reset()
    await manager.broadcast(state.snapshot())
    return {"ok": True}


@router.post("/control/running")
async def set_running(running: bool = Query(...)):
    state.running = running
    return {"ok": True, "running": running}


# --- NLP -------------------------------------------------------------------
class AnnotateIn(BaseModel):
    text: str


@router.post("/nlp/annotate")
async def annotate(body: AnnotateIn):
    """Annotate arbitrary text. Handy on stage: paste a sarcastic line in."""
    ann = get_annotator().annotate(body.text)
    topic_id, hits = route_to_topic(body.text)
    return {**ann.dict(), "routed_topic": topic_id, "topic_match": hits}


@router.get("/nlp/similar")
async def similar(text: str = Query(..., min_length=3), limit: int = 5):
    return await stores.vectors.similar(text, limit)


# --- ingestion -------------------------------------------------------------
@router.get("/ingest/status")
async def ingest_status():
    return await ingest.status()


@router.post("/ingest/run")
async def ingest_run(limit: int = Query(20, ge=1, le=100)):
    posts = await ingest.collect_once(limit_per_source=limit)
    routed = [p for p in posts if p["topic"]]
    for p in routed[:10]:
        state.feed.insert(0, p)
    del state.feed[80:]
    if routed:
        await manager.broadcast({"type": "ingest", "posts": routed[:10]})
    return {"collected": len(posts), "routed": len(routed), "posts": posts[:25]}


# --- report ----------------------------------------------------------------
@router.get("/report/{topic_id}")
async def report(topic_id: str):
    t = C.topic(topic_id)
    if not t:
        raise HTTPException(404, f"unknown topic: {topic_id}")
    live = state.topics.get(topic_id, {})
    fusion = fusion_score(t, live)
    return {
        "generated_at": __import__("datetime").datetime.now().isoformat(),
        "topic": {"id": t["id"], "tag": t["tag"], "title": t["title"], "category": t["category"]},
        "volume": {
            "mentions": round(live.get("mentions", t["mentions"])),
            "growth_pct": round(live.get("growth", t["growth"])),
            "predicted_mentions": t["predictedMentions"],
            "peak_eta_min": t["peakEtaMin"],
        },
        "sentiment": {
            "positive": round(live.get("pos", t["sentiment"]["pos"])),
            "neutral": round(live.get("neu", t["sentiment"]["neu"])),
            "negative": round(live.get("neg", t["sentiment"]["neg"])),
            "shift_pct": live.get("shift", t["sentimentShift"]),
        },
        "emotions": t["emotions"],
        "stance": t["stance"],
        "scores": {
            "virality": t["virality"],
            "crisis": t["crisis"],
            "misinformation_risk": t["misinfo"],
            "coordination": t["coordination"],
            "insight_fusion": fusion["score"],
            "sarcasm_prevalence": t["sarcasm"],
        },
        "fusion_drivers": fusion["drivers"],
        "phases": C.phases(topic_id),
        "related": C.related(topic_id),
        "platforms": t["platforms"],
        "propagation": t["propagation"],
        "geography": t["geo"],
        "influencers": [
            {"handle": a["handle"], "followers": a["followers"], "influence_score": a["influence"],
             "community": a["community"], "persona": a["persona"]}
            for a in top_influencers(t)
        ],
        "why_trending": t["drivers"],
        "misinformation_factors": t["misinfoFactors"],
        "recommended_actions": t["actions"],
        "open_alerts": [
            {"severity": a["severity"], "title": a["title"], "confidence": a["confidence"]}
            for a in state.alerts if a["topicId"] == topic_id
        ],
        "disclaimer": "Synthetic demonstration data unless source=live. Aggregated and k-anonymised; no personal identifiers.",
    }
