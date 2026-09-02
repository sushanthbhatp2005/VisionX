"""Volume forecasting with a fitted model.

What this replaces: `build_forecast()` projected a shaped curve — take the last
point, scale by a growth ratio, rise to a peak, relax 34% — and drew a band
using `spread = 0.09 + p * 0.28`. The band widened because the formula said so,
not because uncertainty grew.

Here the forecast is fitted (Holt-Winters exponential smoothing, additive trend
and additive daily seasonality) and the interval comes from the residual
variance of that fit, widening with the square root of the horizon the way
forecast uncertainty actually does.

Holt-Winters rather than Prophet on purpose: real prediction intervals, no Stan
toolchain to compile, and for a few-hour-ahead social volume forecast the
changepoint and holiday machinery Prophet adds is not what limits accuracy.
"""
from __future__ import annotations

import logging
import math
import warnings
from dataclasses import dataclass
from datetime import datetime, timedelta

import numpy as np

from .engine import STEP_MIN, clamp, fnv1a, hhmm, rng

log = logging.getLogger("visionx.forecast")

# Daily seasonality at 5-minute spacing.
DAILY_PERIOD = 24 * 60 // STEP_MIN          # 288 points per day
FIT_DAYS = 3                                 # 3 cycles: enough for a seasonal fit
FIT_POINTS = DAILY_PERIOD * FIT_DAYS         # 864
Z_95 = 1.959964                              # normal quantile for a 95% interval


# ---------------------------------------------------------------------------
# History long enough to fit on
# ---------------------------------------------------------------------------
def commute_shape(minute_of_day: int) -> float:
    """Multiplier for time of day.

    Civic conversation is not flat: it peaks around the commutes and collapses
    overnight. Without this there is no seasonality to fit and Holt-Winters has
    nothing to find.
    """
    peaks = ((9 * 60, 1.00, 95), (19 * 60, 1.15, 110), (13 * 60, 0.45, 80))
    base = 0.32
    total = base
    for centre, height, width in peaks:
        d = min(abs(minute_of_day - centre), 1440 - abs(minute_of_day - centre))
        total += height * math.exp(-(d ** 2) / (2 * width ** 2))
    return total


def build_fit_history(topic: dict, now: datetime | None = None,
                      points: int = FIT_POINTS) -> list[dict]:
    """A multi-day series for the model to fit on.

    The dashboard only ever displays the last few hours, but fitting daily
    seasonality needs whole days, so this generates the longer series the
    forecaster sees.
    """
    now = now or datetime.now()
    r = rng(fnv1a(topic["id"] + "fit"))
    out: list[dict] = []

    # scale so the tail of this series lands near the topic's current volume
    per_point = topic["mentions"] / 42

    for i in range(points):
        ts = now - timedelta(minutes=(points - 1 - i) * STEP_MIN)
        minute_of_day = ts.hour * 60 + ts.minute

        seasonal = commute_shape(minute_of_day)
        # a gentle upward drift across the window, steeper for high-growth topics
        progress = i / (points - 1)
        trend = 0.72 + progress * (0.55 + topic["growth"] / 260)
        noise = 0.9 + r() * 0.2

        out.append({
            "ts": int(ts.timestamp() * 1000),
            "t": hhmm(ts),
            "mentions": max(1, round(per_point * seasonal * trend * noise)),
        })
    return out


# ---------------------------------------------------------------------------
# Fitting
# ---------------------------------------------------------------------------
@dataclass
class FitResult:
    points: list[dict]
    model: str
    sigma: float
    aic: float | None
    seasonal: bool
    fitted_on: int
    peak_index: int | None
    peak_value: float | None
    warning: str | None = None

    def as_dict(self) -> dict:
        return {
            "points": self.points,
            "model": self.model,
            "sigma": round(self.sigma, 2),
            "aic": round(self.aic, 1) if self.aic is not None else None,
            "seasonal": self.seasonal,
            "fitted_on": self.fitted_on,
            "peak_index": self.peak_index,
            "peak_value": round(self.peak_value) if self.peak_value else None,
            "warning": self.warning,
            "interval": "95% (±1.96σ√h)",
        }


def _fit(series: np.ndarray, seasonal: bool):
    """Holt-Winters, falling back to non-seasonal if the seasonal fit fails."""
    from statsmodels.tsa.holtwinters import ExponentialSmoothing  # noqa: PLC0415

    kwargs = dict(trend="add", initialization_method="estimated")
    if seasonal and len(series) >= 2 * DAILY_PERIOD:
        kwargs |= dict(seasonal="add", seasonal_periods=DAILY_PERIOD)

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return ExponentialSmoothing(series, **kwargs).fit(optimized=True)


def forecast(history: list[dict], steps: int = 12, seasonal: bool = True) -> FitResult:
    """Fit and project `steps` ahead with a 95% prediction interval."""
    values = np.asarray([float(p["mentions"]) for p in history], dtype=float)
    last_ts = history[-1]["ts"]

    used_seasonal = seasonal
    warning = None
    try:
        res = _fit(values, seasonal)
    except Exception as exc:
        log.warning("seasonal fit failed (%s), retrying without seasonality", exc)
        warning = f"seasonal fit failed: {type(exc).__name__}"
        used_seasonal = False
        res = _fit(values, False)

    mean = np.asarray(res.forecast(steps), dtype=float)
    resid = np.asarray(res.resid, dtype=float)
    resid = resid[np.isfinite(resid)]
    sigma = float(np.std(resid)) if resid.size else float(values.std() * 0.1)

    points = []
    for h in range(1, steps + 1):
        yhat = float(mean[h - 1])
        # forecast error accumulates with the horizon
        halfwidth = Z_95 * sigma * math.sqrt(h)
        ts = datetime.fromtimestamp(last_ts / 1000) + timedelta(minutes=h * STEP_MIN)
        points.append({
            "t": hhmm(ts),
            "ts": int(ts.timestamp() * 1000),
            "forecast": max(0, round(yhat)),
            "lo": max(0, round(yhat - halfwidth)),
            "hi": max(0, round(yhat + halfwidth)),
            "band": [max(0, round(yhat - halfwidth)), max(0, round(yhat + halfwidth))],
            "isPeak": False,
        })

    peak_i = int(np.argmax(mean)) if mean.size else None
    if peak_i is not None:
        points[peak_i]["isPeak"] = True

    return FitResult(
        points=points,
        model="Holt-Winters" + (" (add trend + daily seasonal)" if used_seasonal else " (add trend)"),
        sigma=sigma,
        aic=float(res.aic) if hasattr(res, "aic") and np.isfinite(res.aic) else None,
        seasonal=used_seasonal,
        fitted_on=len(values),
        peak_index=peak_i,
        peak_value=float(mean[peak_i]) if peak_i is not None else None,
        warning=warning,
    )


def forecast_topic(topic: dict, live_history: list[dict] | None = None,
                   steps: int = 12) -> dict:
    """Fit a topic's series and return a forecast the UI can render directly.

    `live_history` is the recent window the dashboard is showing. It is appended
    to the generated multi-day history so the fit sees both the seasonal shape
    and whatever has just happened.
    """
    base = build_fit_history(topic)

    if live_history:
        # The generated prior and the observed window are on different scales
        # (the prior is shaped by time of day, the window by the demo clock).
        # Rescale the prior so the two are continuous, otherwise the forecast
        # starts at a different level from the line it is meant to continue.
        live_last = float(live_history[-1]["mentions"])
        base_last = float(base[-1]["mentions"]) or 1.0
        ratio = live_last / base_last
        if 0 < ratio < 1e4:
            base = [{**p, "mentions": max(1, round(p["mentions"] * ratio))} for p in base]

        cutoff = base[-1]["ts"]
        tail = [p for p in live_history if p.get("ts", 0) > cutoff]
        series = base + [{"ts": p["ts"], "t": p["t"], "mentions": p["mentions"]} for p in tail]
    else:
        series = base

    result = forecast(series, steps=steps)
    out = result.as_dict()
    out["topic_id"] = topic["id"]
    return out


# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------
# A seasonal fit over 864 points takes roughly a second per topic, so it can
# never run inside the tick loop. Fits happen in a worker thread and the tick
# serves whatever the cache last produced.
class ForecastCache:
    def __init__(self) -> None:
        self._forecasts: dict[str, dict] = {}
        self.last_fit: float | None = None
        self.last_error: str | None = None
        self.fitting = False
        self.fit_count = 0
        self.duration_ms: float | None = None

    def get(self, topic_id: str) -> dict | None:
        return self._forecasts.get(topic_id)

    def points(self, topic_id: str) -> list[dict] | None:
        f = self._forecasts.get(topic_id)
        return f["points"] if f else None

    def meta(self, topic_id: str) -> dict | None:
        f = self._forecasts.get(topic_id)
        if not f:
            return None
        return {k: v for k, v in f.items() if k != "points"}

    def refresh_all(self, topics: list[dict], histories: dict[str, list[dict]] | None = None,
                    steps: int = 12) -> None:
        """Blocking. Call from a thread."""
        import time as _time  # noqa: PLC0415

        self.fitting = True
        started = _time.time()
        try:
            for t in topics:
                hist = (histories or {}).get(t["id"])
                try:
                    self._forecasts[t["id"]] = forecast_topic(t, live_history=hist, steps=steps)
                except Exception as exc:  # one bad topic must not kill the rest
                    log.warning("forecast failed for %s: %s", t["id"], exc)
                    self.last_error = f"{t['id']}: {type(exc).__name__}: {exc}"
            self.last_fit = _time.time()
            self.fit_count += 1
            self.duration_ms = round((_time.time() - started) * 1000, 1)
            log.info("forecasts refitted for %d topics in %.0fms", len(topics), self.duration_ms)
        finally:
            self.fitting = False

    def status(self) -> dict:
        sample = next(iter(self._forecasts.values()), None)
        return {
            "topics_fitted": len(self._forecasts),
            "last_fit": self.last_fit,
            "fit_count": self.fit_count,
            "duration_ms": self.duration_ms,
            "fitting": self.fitting,
            "last_error": self.last_error,
            "model": sample["model"] if sample else None,
            "interval": sample["interval"] if sample else None,
        }


cache = ForecastCache()
