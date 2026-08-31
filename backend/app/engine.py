"""Scoring and simulation, ported from src/data/engine.js.

Pure functions with no I/O, so the numbers the API serves are the same ones
the frontend computes when it runs standalone. If these two ever disagree the
demo contradicts itself on stage, so the port is deliberately literal.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any

from .corpus import influence_score, topic as get_topic

HISTORY_POINTS = 42
FORECAST_POINTS = 12
STEP_MIN = 5


# --- helpers ---------------------------------------------------------------
def clamp(v: float, lo: float = 0, hi: float = 100) -> float:
    return max(lo, min(hi, v))


def rng(seed: int):
    """xorshift32, matching the frontend's generator so curves line up."""
    s = seed & 0xFFFFFFFF or 1

    def nxt() -> float:
        nonlocal s
        s ^= (s << 13) & 0xFFFFFFFF
        s &= 0xFFFFFFFF
        s ^= s >> 17
        s ^= (s << 5) & 0xFFFFFFFF
        s &= 0xFFFFFFFF
        return s / 4294967296

    return nxt


def fnv1a(text: str) -> int:
    h = 2166136261
    for ch in text:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def hhmm(dt: datetime) -> str:
    return dt.strftime("%H:%M")


def fmt(n: float) -> str:
    if n >= 1e6:
        return f"{n / 1e6:.0f}M" if n >= 1e7 else f"{n / 1e6:.1f}M"
    if n >= 1000:
        return f"{n / 1000:.0f}k" if n >= 10000 else f"{n / 1000:.1f}k"
    return str(round(n))


# --- history ---------------------------------------------------------------
def build_history(t: dict, now: datetime | None = None) -> list[dict]:
    now = now or datetime.now()
    r = rng(fnv1a(t["id"]))
    pts: list[dict] = []
    infl = 0.62

    for i in range(HISTORY_POINTS):
        p = i / (HISTORY_POINTS - 1)
        ramp = p * 0.55 if p < infl else 0.34 + ((p - infl) / (1 - infl)) ** 1.7 * 0.66
        noise = 0.94 + r() * 0.12
        base = t["mentions"] / HISTORY_POINTS
        mentions = round(base * (0.45 + ramp * 2.1) * noise)

        drift = p ** 1.6
        start_neg = clamp(t["sentiment"]["neg"] + t["sentimentShift"] * 1.15)
        start_pos = clamp(t["sentiment"]["pos"] - t["sentimentShift"] * 0.5)
        neg = clamp(start_neg + (t["sentiment"]["neg"] - start_neg) * drift + (r() - 0.5) * 3)
        pos = clamp(start_pos + (t["sentiment"]["pos"] - start_pos) * drift + (r() - 0.5) * 2.5)
        neu = clamp(100 - neg - pos)

        ts = now - timedelta(minutes=(HISTORY_POINTS - 1 - i) * STEP_MIN)
        pts.append(
            {
                "t": hhmm(ts),
                "ts": int(ts.timestamp() * 1000),
                "mentions": mentions,
                "pos": round(pos),
                "neu": round(neu),
                "neg": round(neg),
                "anger": round(clamp(t["emotions"]["anger"] * (0.55 + drift * 0.5) + (r() - 0.5) * 4)),
                "engagement": round(mentions * (1.6 + r() * 1.4)),
            }
        )
    return pts


def build_forecast(t: dict, history: list[dict]) -> list[dict]:
    last = history[-1]
    out: list[dict] = []
    r = rng(fnv1a(t["id"] + "fc"))
    peak_at = min(FORECAST_POINTS - 1, max(2, round(t["peakEtaMin"] / STEP_MIN / 4)))

    for i in range(1, FORECAST_POINTS + 1):
        p = i / FORECAST_POINTS
        shape = i / peak_at if i <= peak_at else 1 - ((i - peak_at) / (FORECAST_POINTS - peak_at)) * 0.34
        target = last["mentions"] * max(1.05, t["predictedMentions"] / t["mentions"])
        mentions = round(last["mentions"] + (target - last["mentions"]) * shape)
        spread = 0.09 + p * 0.28
        ts = datetime.fromtimestamp(last["ts"] / 1000) + timedelta(minutes=i * STEP_MIN)
        out.append(
            {
                "t": hhmm(ts),
                "ts": int(ts.timestamp() * 1000),
                "forecast": mentions,
                "lo": round(mentions * (1 - spread)),
                "hi": round(mentions * (1 + spread)),
                "band": [round(mentions * (1 - spread)), round(mentions * (1 + spread))],
                "negForecast": round(
                    clamp(last["neg"] + (t["predictedNeg"] - last["neg"]) * shape + (r() - 0.5) * 2)
                ),
                "isPeak": i == peak_at,
            }
        )
    return out


def next_point(t: dict, prev: dict, escalation: float) -> dict:
    r = rng(fnv1a(t["id"] + prev["t"] + str(prev["mentions"])))
    push = 1 + escalation * 0.9
    ceiling = (t["predictedMentions"] / HISTORY_POINTS) * 2.6
    mentions = min(round(prev["mentions"] * (0.97 + r() * 0.09) * push), round(ceiling))

    neg_target = clamp(t["sentiment"]["neg"] + escalation * 16)
    neg = clamp(prev["neg"] + (neg_target - prev["neg"]) * 0.28 + (r() - 0.5) * 2)
    pos = clamp(prev["pos"] * (1 - escalation * 0.12) + (r() - 0.5) * 1.6)
    ts = datetime.fromtimestamp(prev["ts"] / 1000) + timedelta(minutes=STEP_MIN)

    return {
        "t": hhmm(ts),
        "ts": int(ts.timestamp() * 1000),
        "mentions": mentions,
        "pos": round(pos),
        "neu": round(clamp(100 - neg - pos)),
        "neg": round(neg),
        "anger": round(clamp(prev["anger"] + escalation * 5 + (r() - 0.5) * 3)),
        "engagement": round(mentions * (1.6 + r() * 1.4)),
    }


# --- derived scores --------------------------------------------------------
def fusion_score(t: dict, live: dict | None = None) -> dict:
    neg = (live or {}).get("neg", t["sentiment"]["neg"])
    growth = (live or {}).get("growth", t["growth"])
    spread = len({p["from"] for p in t["propagation"]} | {p["to"] for p in t["propagation"]})

    drivers = [
        {"key": "Negative sentiment", "value": neg, "weight": 0.20},
        {
            "key": "Emotion intensity (anger + fear)",
            "value": clamp((t["emotions"]["anger"] + t["emotions"]["fear"]) / 1.6),
            "weight": 0.16,
        },
        {"key": "Mention velocity", "value": clamp(growth / 2.5), "weight": 0.18},
        {"key": "Influencer amplification", "value": t["velocity"], "weight": 0.14},
        {"key": "Cross-platform spread", "value": (len(t["propagation"]) / 4) * 100, "weight": 0.12},
        {
            "key": "Geographic concentration",
            "value": clamp((t["geo"][0]["mentions"] / t["mentions"]) * 100 + 10),
            "weight": 0.10,
        },
        {"key": "Coordination signal", "value": t["coordination"], "weight": 0.10},
    ]
    score = round(sum(clamp(d["value"]) * d["weight"] for d in drivers))
    return {"score": int(clamp(score)), "drivers": drivers, "spread": spread}


def crisis_factors(t: dict, live: dict | None = None) -> list[dict]:
    neg = (live or {}).get("neg", t["sentiment"]["neg"])
    growth = (live or {}).get("growth", t["growth"])
    return [
        {"label": "Mention velocity", "value": clamp(growth / 2.4)},
        {"label": "Negative sentiment velocity", "value": clamp(neg + abs(t["sentimentShift"]) * 0.5)},
        {
            "label": "Emotion intensity",
            "value": clamp((t["emotions"]["anger"] + t["emotions"]["fear"]) / 1.7),
        },
        {
            "label": "Geographic concentration",
            "value": clamp((t["geo"][0]["mentions"] / t["mentions"]) * 110),
        },
        {"label": "Influencer amplification", "value": t["velocity"]},
        {"label": "Cross-platform propagation", "value": clamp(len(t["propagation"]) * 24)},
        {"label": "Anomalous account activity", "value": t["coordination"]},
    ]


def virality_factors(t: dict, live: dict | None = None) -> list[dict]:
    mentions = (live or {}).get("mentions", t["mentions"])
    growth = (live or {}).get("growth", t["growth"])
    platforms = len({p["from"] for p in t["propagation"]} | {p["to"] for p in t["propagation"]})
    return [
        {"label": "Current mentions", "display": fmt(mentions), "value": clamp(mentions / 600)},
        {"label": "Growth rate", "display": f"{growth:+.0f}%", "value": clamp(growth / 2.5)},
        {"label": "Engagement velocity", "display": f"{t['velocity']}/100", "value": t["velocity"]},
        {
            "label": "Influencer involvement",
            "display": "High" if len(t["influencers"]) >= 5 else "Medium" if len(t["influencers"]) >= 3 else "Low",
            "value": len(t["influencers"]) * 18,
        },
        {"label": "Sentiment shift", "display": f"{t['sentimentShift']:+d}%", "value": clamp(abs(t["sentimentShift"]) * 2.4)},
        {"label": "Cross-platform spread", "display": f"{platforms} platforms", "value": platforms * 20},
    ]


def risk_band(score: float) -> dict:
    if score >= 75:
        return {"label": "CRITICAL", "color": "#ff5d73", "tone": "neg"}
    if score >= 55:
        return {"label": "HIGH", "color": "#ffb02e", "tone": "warn"}
    if score >= 35:
        return {"label": "ELEVATED", "color": "#6ea8ff", "tone": "accent"}
    return {"label": "NORMAL", "color": "#2fd4a7", "tone": "pos"}


# --- alerts ----------------------------------------------------------------
def make_alert(t: dict, kind: str, seq: int, live: dict | None = None) -> dict:
    neg = round((live or {}).get("neg", t["sentiment"]["neg"]))
    peak_h = round(t["peakEtaMin"] / 60)
    kinds = {
        "sentiment": {
            "severity": "high",
            "title": "Emerging negative sentiment",
            "body": f"Negative share on {t['tag']} reached {neg}% ({t['sentimentShift']:+d}% shift).",
            "confidence": 91,
            "metrics": [["Sentiment", f"{neg}% neg"], ["Velocity", "High"], ["Window", "15 min"]],
        },
        "virality": {
            "severity": "medium",
            "title": "Virality threshold crossed",
            "body": f"{t['tag']} is predicted to peak in ~{peak_h}h at {fmt(t['predictedMentions'])} mentions.",
            "confidence": t["virality"],
            "metrics": [["Virality", f"{t['virality']}%"], ["Peak ETA", f"{peak_h}h"], ["Growth", f"{t['growth']:+d}%"]],
        },
        "crisis": {
            "severity": "critical",
            "title": "Crisis risk: HIGH",
            "body": f"Spike + negative sentiment + rapid geographic spread detected on {t['tag']}.",
            "confidence": 93,
            "metrics": [
                ["Crisis score", f"{t['crisis']}/100"],
                ["Spread", f"{len(t['propagation'])} hops"],
                ["Concentration", t["geo"][0]["place"]],
            ],
        },
        "coordination": {
            "severity": "high",
            "title": "Possible coordinated activity",
            "body": f"37 accounts posting near-identical text on {t['tag']} within 90-second windows.",
            "confidence": 84,
            "metrics": [["Accounts", "37"], ["Narrative overlap", "82%"], ["Window", "90s"]],
        },
        "misinfo": {
            "severity": "high",
            "title": "Misinformation risk elevated",
            "body": f"{t['misinfo']}/100 on {t['tag']}: {t['misinfoFactors'][0]['label'].lower()}.",
            "confidence": 79,
            "metrics": [
                ["Risk", f"{t['misinfo']}/100"],
                ["Top factor", f"{t['misinfoFactors'][0]['weight']}%"],
                ["Sources", "Low credibility"],
            ],
        },
    }
    base = {
        "id": f"al{seq}",
        "topicId": t["id"],
        "tag": t["tag"],
        "at": int(datetime.now().timestamp() * 1000),
        "read": False,
        "kind": kind,
    }
    return {**base, **kinds[kind]}


def top_influencers(t: dict) -> list[dict]:
    from .corpus import account

    out = []
    for aid in t["influencers"]:
        a = account(aid)
        if a:
            out.append({**a, "influence": influence_score(a)})
    return sorted(out, key=lambda x: -x["influence"])
