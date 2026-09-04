"""The live state machine and WebSocket fan-out.

This is the server-side counterpart of the frontend's LiveContext: it owns the
clock, advances each topic's series, streams annotated posts, and raises
alerts when thresholds are crossed. Clients get the same payload shapes the
mock engine produces, so the UI code is identical either way.
"""
from __future__ import annotations

import asyncio
import json
import logging
import random
import time
from typing import Any

from .config import get_settings
from .corpus import corpus, topics
from .engine import build_forecast, build_history, clamp, make_alert, next_point
from .forecast import cache as forecast_cache
from .nlp.pipeline import get_annotator

log = logging.getLogger("visionx.stream")


class ConnectionManager:
    def __init__(self) -> None:
        self._clients: set[Any] = set()

    async def connect(self, ws) -> None:
        await ws.accept()
        self._clients.add(ws)
        log.info("client connected (%d total)", len(self._clients))

    def disconnect(self, ws) -> None:
        self._clients.discard(ws)
        log.info("client disconnected (%d left)", len(self._clients))

    @property
    def count(self) -> int:
        return len(self._clients)

    async def broadcast(self, message: dict) -> None:
        if not self._clients:
            return
        payload = json.dumps(message, default=str)
        dead = []
        for ws in list(self._clients):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


class LiveState:
    """Per-topic live series, the post feed, and the alert board."""

    def __init__(self) -> None:
        self.topics: dict[str, dict] = {}
        self.feed: list[dict] = []
        self.alerts: list[dict] = []
        self.processed = 1_284_392
        self.tick = 0
        self.running = True
        self._alert_seq = 0
        self._fired: set[str] = set()
        self._post_seq = 0
        self.reset()

    # --- lifecycle ---------------------------------------------------------
    def reset(self) -> None:
        self.topics = {}
        for t in topics():
            history = build_history(t)
            self.topics[t["id"]] = {
                "history": history,
                "forecast": build_forecast(t, history),
                "mentions": t["mentions"],
                "pos": t["sentiment"]["pos"],
                "neu": t["sentiment"]["neu"],
                "neg": t["sentiment"]["neg"],
                "growth": t["growth"],
                "shift": t["sentimentShift"],
                "escalation": 0.0,
            }
        self.feed = [
            {**p, "id": f"s{i}", "at": int(time.time() * 1000) - i * 9000, "source": "corpus",
             "tag": next((t["tag"] for t in topics() if t["id"] == p["topic"]), None)}
            for i, p in enumerate(corpus()["posts"][:10])
        ]
        self.alerts = []
        self._fired = set()
        self.tick = 0
        for topic_id, kind in (("exam", "misinfo"), ("exam", "coordination"), ("water", "sentiment"), ("metro", "virality")):
            self.raise_alert(topic_id, kind)

    # --- mutation ----------------------------------------------------------
    def raise_alert(self, topic_id: str, kind: str) -> dict | None:
        key = f"{topic_id}:{kind}"
        if key in self._fired:
            return None
        t = next((x for x in topics() if x["id"] == topic_id), None)
        if not t:
            return None
        self._fired.add(key)
        self._alert_seq += 1
        alert = make_alert(t, kind, self._alert_seq, self.topics.get(topic_id))
        self.alerts.insert(0, alert)
        del self.alerts[30:]

        # persist without blocking the caller
        try:
            import asyncio as _asyncio  # noqa: PLC0415

            from .stores import stores  # noqa: PLC0415

            _asyncio.get_running_loop().create_task(stores.alerts.save(alert))
        except RuntimeError:
            pass  # no loop yet (called during __init__)
        return alert

    async def restore(self) -> int:
        """Reload the alert board from the store, so a restart is not an
        empty screen. Seeded alerts are only raised when nothing came back."""
        from .stores import stores  # noqa: PLC0415

        try:
            saved = await stores.alerts.recent(30)
        except Exception as exc:  # pragma: no cover
            log.warning("could not restore alerts: %s", exc)
            return 0
        if not saved:
            return 0
        self.alerts = saved
        for a in saved:
            self._fired.add(f"{a.get('topicId')}:{a.get('kind')}")
        self._alert_seq = max(self._alert_seq, len(saved))
        log.info("restored %d alerts from the store", len(saved))
        return len(saved)

    def escalate(self, topic_id: str, amount: float) -> None:
        if topic_id in self.topics:
            self.topics[topic_id]["escalation"] = max(0.0, min(1.0, amount))

    async def synth_post(self, t: dict, escalation: float) -> dict:
        """Generate a post, then annotate it with the real NLP pipeline."""
        self._post_seq += 1
        tpl = random.choice(corpus()["stream_templates"])
        platform = random.choice(corpus()["platforms"])
        text = tpl["text"].replace("{t}", t["tag"])

        # inference can take ~100ms on CPU; keep it off the event loop
        ann = await asyncio.to_thread(get_annotator().annotate, text)
        suspicious = escalation > 0.4 and random.random() < 0.22

        return {
            "id": f"p{self._post_seq}",
            "topic": t["id"],
            "tag": t["tag"],
            "platform": platform["id"],
            "platformName": platform["name"],
            "author": "@news_alert_7788" if suspicious else random.choice(corpus()["handles"]),
            "text": text,
            "lang": ann.lang,
            "sentiment": ann.sentiment,
            "surface": ann.surface,
            "sarcasm": ann.sarcasm,
            "emotion": ann.emotion,
            "stance": ann.stance,
            "place": random.choice(corpus()["places"]),
            "bot": 84 + random.randint(0, 11) if suspicious else ann.bot,
            "at": int(time.time() * 1000),
            "source": "synthetic",
            "nlp": ann.backend,
        }

    async def advance(self) -> dict:
        """One tick: move every series, stream a post, return the delta."""
        from .stores import stores  # noqa: PLC0415

        self.tick += 1
        deltas: dict[str, dict] = {}

        for t in topics():
            cur = self.topics[t["id"]]
            esc = cur["escalation"]
            point = next_point(t, cur["history"][-1], esc)
            prev_last = cur["history"][-1]
            cur["history"] = cur["history"][1:] + [point]

            growth_delta = ((point["mentions"] - prev_last["mentions"]) / max(prev_last["mentions"], 1)) * 100
            # A fitted forecast if the model has produced one, otherwise the
            # shaped curve. `forecastModel` tells the UI which it is looking at.
            fitted = forecast_cache.points(t["id"])
            if fitted:
                cur["forecast"] = fitted
                cur["forecastModel"] = forecast_cache.meta(t["id"])
            else:
                cur["forecast"] = build_forecast(
                    {**t, "predictedMentions": t["predictedMentions"] * (1 + esc * 0.55)}, cur["history"]
                )
                cur["forecastModel"] = {"model": "projected curve", "seasonal": False, "fitted_on": 0}
            cur["mentions"] = round(min(cur["mentions"] + point["mentions"] * (0.06 + esc * 0.14),
                                        t["predictedMentions"] * 1.12))
            cur["pos"], cur["neu"], cur["neg"] = point["pos"], point["neu"], point["neg"]
            cur["growth"] = clamp(cur["growth"] * 0.94 + growth_delta * 2.6 + esc * 8, 0, 320)
            cur["shift"] = round(cur["history"][0]["neg"] - point["neg"])

            deltas[t["id"]] = {
                "point": point,
                "mentions": cur["mentions"],
                "growth": round(cur["growth"], 1),
                "shift": cur["shift"],
                "pos": cur["pos"], "neu": cur["neu"], "neg": cur["neg"],
                "forecast": cur["forecast"],
                "forecastModel": cur.get("forecastModel"),
            }

            try:
                await stores.metrics.record(t["id"], point)
            except Exception as exc:  # pragma: no cover
                log.debug("metric record failed: %s", exc)

        # stream a post, biased toward whatever is escalating
        hot = next((t for t in topics() if self.topics[t["id"]]["escalation"] > 0.2), None)
        source_topic = hot or (topics()[0] if random.random() < 0.5 else random.choice(topics()))
        post = await self.synth_post(source_topic, self.topics[source_topic["id"]]["escalation"])
        self.feed.insert(0, post)
        del self.feed[50:]

        try:
            await stores.stream.push(post)
            # index it too, so near-duplicate search covers the live stream
            await stores.vectors.add(post["id"], post["text"],
                                     {"topic": post["topic"], "platform": post["platform"],
                                      "author": post["author"]})
        except Exception as exc:  # pragma: no cover
            log.debug("stream persist failed: %s", exc)

        self.processed += 700 + random.randint(0, 900)

        return {
            "type": "tick",
            "tick": self.tick,
            "processed": self.processed,
            "topics": deltas,
            "post": post,
            "alerts": self.alerts[:5],
        }

    def histories(self) -> dict[str, list[dict]]:
        """The observed windows, for the forecaster to fit against."""
        return {tid: st["history"] for tid, st in self.topics.items()}

    def snapshot(self) -> dict:
        return {
            "type": "snapshot",
            "tick": self.tick,
            "processed": self.processed,
            "running": self.running,
            "topics": {
                tid: {
                    "history": s["history"],
                    "forecast": s["forecast"],
                    "forecastModel": s.get("forecastModel"),
                    "mentions": s["mentions"],
                    "pos": s["pos"], "neu": s["neu"], "neg": s["neg"],
                    "growth": round(s["growth"], 1),
                    "shift": s["shift"],
                    "escalation": s["escalation"],
                }
                for tid, s in self.topics.items()
            },
            "feed": self.feed,
            "alerts": self.alerts,
        }


state = LiveState()
manager = ConnectionManager()


async def clock() -> None:
    """The tick loop. Runs for the life of the process."""
    interval = get_settings().tick_seconds
    while True:
        try:
            if state.running:
                delta = await state.advance()
                await manager.broadcast(delta)
        except asyncio.CancelledError:
            raise
        except Exception:  # pragma: no cover
            log.exception("clock tick failed")
        await asyncio.sleep(interval)
