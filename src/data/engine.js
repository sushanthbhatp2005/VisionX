// ---------------------------------------------------------------------------
// The simulation engine. Pure functions only -- React state lives in
// store/LiveContext.jsx. In the real system these numbers arrive over the
// WebSocket from the FastAPI insight-fusion layer; the shapes are identical.
// ---------------------------------------------------------------------------

import { STREAM_TEMPLATES, HANDLES, PLACES, PLATFORMS } from './seed.js'

// deterministic PRNG so a reload does not reshuffle the story
export function rng(seed) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >> 17
    s ^= s << 5; s >>>= 0
    return s / 4294967296
  }
}

export const hash = (str) => {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

export const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))
export const fmt = (n) => {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k'
  return String(Math.round(n))
}
export const pct = (n) => `${n > 0 ? '+' : ''}${Math.round(n)}%`

export function hhmm(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const HISTORY_POINTS = 42
export const FORECAST_POINTS = 12
export const STEP_MIN = 5 // minutes between points

// --- history ---------------------------------------------------------------
// A growth-shaped curve: flat, then an inflection scaled by the topic's growth.
export function buildHistory(topic, now = new Date()) {
  const r = rng(hash(topic.id))
  const pts = []
  const infl = 0.62 // inflection position along the window
  for (let i = 0; i < HISTORY_POINTS; i++) {
    const p = i / (HISTORY_POINTS - 1)
    const ramp = p < infl ? p * 0.55 : 0.34 + Math.pow((p - infl) / (1 - infl), 1.7) * 0.66
    const noise = 0.94 + r() * 0.12
    const base = topic.mentions / HISTORY_POINTS
    const mentions = Math.round(base * (0.45 + ramp * 2.1) * noise)

    // Sentiment starts where it was before the shift and drifts towards the
    // current mix. sentimentShift is signed from the positive side: -31 means
    // the conversation moved 31 points more negative over the window.
    const drift = Math.pow(p, 1.6)
    const startNeg = clamp(topic.sentiment.neg + topic.sentimentShift * 1.15)
    const startPos = clamp(topic.sentiment.pos - topic.sentimentShift * 0.5)
    const neg = clamp(startNeg + (topic.sentiment.neg - startNeg) * drift + (r() - 0.5) * 3)
    const pos = clamp(startPos + (topic.sentiment.pos - startPos) * drift + (r() - 0.5) * 2.5)
    const neu = clamp(100 - neg - pos)

    const t = new Date(now.getTime() - (HISTORY_POINTS - 1 - i) * STEP_MIN * 60000)
    pts.push({
      t: hhmm(t),
      ts: t.getTime(),
      mentions,
      pos: Math.round(pos),
      neu: Math.round(neu),
      neg: Math.round(neg),
      anger: Math.round(clamp(topic.emotions.anger * (0.55 + drift * 0.5) + (r() - 0.5) * 4)),
      engagement: Math.round(mentions * (1.6 + r() * 1.4)),
    })
  }
  return pts
}

// --- forecast (the Prophet-style layer, with a confidence band) -------------
export function buildForecast(topic, history) {
  const last = history[history.length - 1]
  const out = []
  const r = rng(hash(topic.id + 'fc'))
  const peakAt = Math.min(FORECAST_POINTS - 1, Math.max(2, Math.round(topic.peakEtaMin / STEP_MIN / 4)))
  for (let i = 1; i <= FORECAST_POINTS; i++) {
    const p = i / FORECAST_POINTS
    // rise to the predicted peak, then relax
    const shape = i <= peakAt ? i / peakAt : 1 - ((i - peakAt) / (FORECAST_POINTS - peakAt)) * 0.34
    // scale the current bucket by the predicted growth ratio so the forecast
    // always continues from where the live series actually is
    const target = last.mentions * Math.max(1.05, topic.predictedMentions / topic.mentions)
    const mentions = Math.round(last.mentions + (target - last.mentions) * shape)
    const spread = 0.09 + p * 0.28
    const t = new Date(last.ts + i * STEP_MIN * 60000)
    out.push({
      t: hhmm(t),
      ts: t.getTime(),
      forecast: mentions,
      lo: Math.round(mentions * (1 - spread)),
      hi: Math.round(mentions * (1 + spread)),
      band: [Math.round(mentions * (1 - spread)), Math.round(mentions * (1 + spread))],
      negForecast: Math.round(clamp(last.neg + (topic.predictedNeg - last.neg) * shape + (r() - 0.5) * 2)),
      isPeak: i === peakAt,
    })
  }
  return out
}

// history + forecast stitched for a single Recharts series
export function mergeSeries(history, forecast) {
  const h = history.map((p) => ({ ...p, forecast: null, band: null }))
  const bridge = { ...h[h.length - 1], forecast: h[h.length - 1].mentions, band: [h[h.length - 1].mentions, h[h.length - 1].mentions] }
  h[h.length - 1] = bridge
  return [...h, ...forecast.map((p) => ({ ...p, mentions: null }))]
}

// --- one live tick ---------------------------------------------------------
export function nextPoint(topic, prev, escalation) {
  const r = rng(hash(topic.id + prev.t + prev.mentions))
  const push = 1 + escalation * 0.9
  // escalation accelerates the curve but cannot outrun the predicted peak --
  // a bucket is capped relative to the forecast rather than compounding freely
  const ceiling = (topic.predictedMentions / HISTORY_POINTS) * 2.6
  const mentions = Math.min(Math.round(prev.mentions * (0.97 + r() * 0.09) * push), Math.round(ceiling))
  const negTarget = clamp(topic.sentiment.neg + escalation * 16)
  const neg = clamp(prev.neg + (negTarget - prev.neg) * 0.28 + (r() - 0.5) * 2)
  const pos = clamp(prev.pos * (1 - escalation * 0.12) + (r() - 0.5) * 1.6)
  const t = new Date(prev.ts + STEP_MIN * 60000)
  return {
    t: hhmm(t),
    ts: t.getTime(),
    mentions,
    pos: Math.round(pos),
    neu: Math.round(clamp(100 - neg - pos)),
    neg: Math.round(neg),
    anger: Math.round(clamp(prev.anger + escalation * 5 + (r() - 0.5) * 3)),
    engagement: Math.round(mentions * (1.6 + r() * 1.4)),
    forecast: null,
    band: null,
  }
}

// --- synthetic post --------------------------------------------------------
let postSeq = 0
export function synthPost(topic, escalation = 0) {
  const r = rng(hash(topic.id) + ++postSeq * 2654435761)
  const tpl = STREAM_TEMPLATES[Math.floor(r() * STREAM_TEMPLATES.length)]
  const plat = PLATFORMS[Math.floor(r() * PLATFORMS.length)]
  const handle = HANDLES[Math.floor(r() * HANDLES.length)]
  const suspicious = escalation > 0.4 && r() < 0.22
  // escalation pushes neutral/positive chatter negative
  let s = tpl.s
  if (escalation > 0.3 && s !== 'neg' && r() < 0.45 + escalation * 0.3) s = 'neg'
  return {
    id: `p${postSeq}`,
    topic: topic.id,
    tag: topic.tag,
    platform: plat.id,
    platformName: plat.name,
    author: suspicious ? '@news_alert_7788' : handle,
    lang: tpl.lang,
    text: tpl.text.replace('{t}', topic.tag),
    sentiment: s,
    surface: tpl.sar > 60 ? 'pos' : s,
    sarcasm: tpl.sar,
    emotion: escalation > 0.5 && s === 'neg' ? 'anger' : tpl.e,
    stance: s === 'neg' ? 'oppose' : s === 'pos' ? 'support' : 'neutral',
    place: PLACES[Math.floor(r() * PLACES.length)],
    bot: suspicious ? 84 + Math.floor(r() * 12) : Math.floor(r() * 18),
    at: Date.now(),
  }
}

// --- derived scores --------------------------------------------------------

// Insight Fusion Score = sentiment x emotion x topic x community x influence
// x time x spread. Each driver is reported so the score is explainable.
export function fusionScore(topic, live) {
  const neg = live?.neg ?? topic.sentiment.neg
  const growth = live?.growth ?? topic.growth
  const drivers = [
    { key: 'Negative sentiment', value: neg, weight: 0.2 },
    { key: 'Emotion intensity (anger + fear)', value: clamp((topic.emotions.anger + topic.emotions.fear) / 1.6), weight: 0.16 },
    { key: 'Mention velocity', value: clamp(growth / 2.5), weight: 0.18 },
    { key: 'Influencer amplification', value: topic.velocity, weight: 0.14 },
    { key: 'Cross-platform spread', value: (topic.propagation.length / 4) * 100, weight: 0.12 },
    { key: 'Geographic concentration', value: clamp((topic.geo[0].mentions / topic.mentions) * 100 + 10), weight: 0.1 },
    { key: 'Coordination signal', value: topic.coordination, weight: 0.1 },
  ]
  const score = Math.round(drivers.reduce((a, d) => a + clamp(d.value) * d.weight, 0))
  return { score: clamp(score), drivers }
}

export function viralityFactors(topic, live) {
  return [
    { label: 'Current mentions', display: fmt(live?.mentions ?? topic.mentions), value: clamp((live?.mentions ?? topic.mentions) / 600) },
    { label: 'Growth rate', display: pct(live?.growth ?? topic.growth), value: clamp((live?.growth ?? topic.growth) / 2.5) },
    { label: 'Engagement velocity', display: `${topic.velocity}/100`, value: topic.velocity },
    { label: 'Influencer involvement', display: topic.influencers.length >= 5 ? 'High' : topic.influencers.length >= 3 ? 'Medium' : 'Low', value: topic.influencers.length * 18 },
    { label: 'Sentiment shift', display: pct(live?.shift ?? topic.sentimentShift), value: clamp(Math.abs(live?.shift ?? topic.sentimentShift) * 2.4) },
    { label: 'Cross-platform spread', display: `${new Set(topic.propagation.flatMap((p) => [p.from, p.to])).size} platforms`, value: new Set(topic.propagation.flatMap((p) => [p.from, p.to])).size * 20 },
  ]
}

export function crisisFactors(topic, live) {
  const neg = live?.neg ?? topic.sentiment.neg
  return [
    { label: 'Mention velocity', value: clamp((live?.growth ?? topic.growth) / 2.4) },
    { label: 'Negative sentiment velocity', value: clamp(neg + Math.abs(topic.sentimentShift) * 0.5) },
    { label: 'Emotion intensity', value: clamp((topic.emotions.anger + topic.emotions.fear) / 1.7) },
    { label: 'Geographic concentration', value: clamp((topic.geo[0].mentions / topic.mentions) * 110) },
    { label: 'Influencer amplification', value: topic.velocity },
    { label: 'Cross-platform propagation', value: clamp(topic.propagation.length * 24) },
    { label: 'Anomalous account activity', value: topic.coordination },
  ]
}

export function riskBand(score) {
  if (score >= 75) return { label: 'CRITICAL', color: '#ff5d73', tone: 'neg' }
  if (score >= 55) return { label: 'HIGH', color: '#ffb02e', tone: 'warn' }
  if (score >= 35) return { label: 'ELEVATED', color: '#6ea8ff', tone: 'accent' }
  return { label: 'NORMAL', color: '#2fd4a7', tone: 'pos' }
}

// --- alerts ----------------------------------------------------------------
let alertSeq = 0
export function makeAlert(topic, kind, live) {
  alertSeq += 1
  const neg = Math.round(live?.neg ?? topic.sentiment.neg)
  const base = { id: `al${alertSeq}`, topicId: topic.id, tag: topic.tag, at: Date.now(), read: false }
  const kinds = {
    sentiment: {
      severity: 'high',
      title: 'Emerging negative sentiment',
      body: `Negative share on ${topic.tag} reached ${neg}% (${pct(topic.sentimentShift)} shift).`,
      confidence: 91,
      metrics: [['Sentiment', `${neg}% neg`], ['Velocity', 'High'], ['Window', '15 min']],
    },
    virality: {
      severity: 'medium',
      title: 'Virality threshold crossed',
      body: `${topic.tag} is predicted to peak in ~${Math.round(topic.peakEtaMin / 60)}h at ${fmt(topic.predictedMentions)} mentions.`,
      confidence: topic.virality,
      metrics: [['Virality', `${topic.virality}%`], ['Peak ETA', `${Math.round(topic.peakEtaMin / 60)}h`], ['Growth', pct(topic.growth)]],
    },
    crisis: {
      severity: 'critical',
      title: 'Crisis risk: HIGH',
      body: `Spike + negative sentiment + rapid geographic spread detected on ${topic.tag}.`,
      confidence: 93,
      metrics: [['Crisis score', `${topic.crisis}/100`], ['Spread', `${topic.propagation.length} hops`], ['Concentration', `${topic.geo[0].place}`]],
    },
    coordination: {
      severity: 'high',
      title: 'Possible coordinated activity',
      body: `37 accounts posting near-identical text on ${topic.tag} within 90-second windows.`,
      confidence: 84,
      metrics: [['Accounts', '37'], ['Narrative overlap', '82%'], ['Window', '90s']],
    },
    misinfo: {
      severity: 'high',
      title: 'Misinformation risk elevated',
      body: `${topic.misinfo}/100 on ${topic.tag}: ${topic.misinfoFactors[0].label.toLowerCase()}.`,
      confidence: 79,
      metrics: [['Risk', `${topic.misinfo}/100`], ['Top factor', `${topic.misinfoFactors[0].weight}%`], ['Sources', 'Low credibility']],
    },
  }
  return { ...base, kind, ...kinds[kind] }
}

export const SEVERITY = {
  critical: { color: '#ff5d73', label: 'Critical' },
  high: { color: '#ffb02e', label: 'High' },
  medium: { color: '#6ea8ff', label: 'Medium' },
  low: { color: '#8b95b5', label: 'Low' },
}
