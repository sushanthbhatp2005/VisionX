import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { TOPICS, POSTS } from '../data/seed.js'
import { buildHistory, buildForecast, nextPoint, synthPost, makeAlert, clamp } from '../data/engine.js'
import { connectLive } from '../api/live.js'

const LiveContext = createContext(null)
export const useLive = () => useContext(LiveContext)

const TICK_MS = 2600

function initialTopics() {
  const now = new Date()
  const out = {}
  for (const t of TOPICS) {
    const history = buildHistory(t, now)
    out[t.id] = {
      history,
      forecast: buildForecast(t, history),
      mentions: t.mentions,
      neg: t.sentiment.neg,
      pos: t.sentiment.pos,
      neu: t.sentiment.neu,
      growth: t.growth,
      shift: t.sentimentShift,
      escalation: 0,
    }
  }
  return out
}

export function LiveProvider({ children }) {
  const [running, setRunning] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [tick, setTick] = useState(0)
  const [topics, setTopics] = useState(initialTopics)
  const [feed, setFeed] = useState(() =>
    POSTS.slice(0, 10).map((p, i) => ({ ...p, id: `s${i}`, at: Date.now() - i * 9000, tag: TOPICS.find((t) => t.id === p.topic)?.tag }))
  )
  const [alerts, setAlerts] = useState([])
  const [processed, setProcessed] = useState(1284392)
  const [selectedTopic, setSelectedTopic] = useState('traffic')
  const [demoStep, setDemoStep] = useState(-1) // -1 = guided demo not running
  // 'connecting' | 'live' | 'offline'. 'live' means the FastAPI backend is
  // driving; anything else means this tab is running its own simulation.
  const [connection, setConnection] = useState('connecting')
  const firedRef = useRef(new Set())
  const socketRef = useRef(null)
  const isLive = connection === 'live'

  // ---- the clock ----------------------------------------------------------
  useEffect(() => {
    if (!running || isLive) return // the backend owns the clock when connected
    const iv = setInterval(() => setTick((n) => n + 1), TICK_MS / speed)
    return () => clearInterval(iv)
  }, [running, speed, isLive])

  useEffect(() => {
    if (tick === 0 || isLive) return
    setTopics((prev) => {
      const next = { ...prev }
      for (const t of TOPICS) {
        const cur = next[t.id]
        const esc = cur.escalation
        const history = [...cur.history.slice(1), nextPoint(t, cur.history[cur.history.length - 1], esc)]
        const last = history[history.length - 1]
        const prevLast = cur.history[cur.history.length - 1]
        const growthDelta = ((last.mentions - prevLast.mentions) / Math.max(prevLast.mentions, 1)) * 100
        next[t.id] = {
          ...cur,
          history,
          forecast: buildForecast({ ...t, predictedMentions: t.predictedMentions * (1 + esc * 0.55) }, history),
          mentions: Math.round(Math.min(cur.mentions + last.mentions * (0.06 + esc * 0.14), t.predictedMentions * 1.12)),
          neg: last.neg,
          pos: last.pos,
          neu: last.neu,
          growth: clamp(cur.growth * 0.94 + growthDelta * 2.6 + esc * 8, 0, 320),
          // the shift actually observed across the window, so it tracks the live curve
          shift: Math.round(history[0].neg - last.neg),
        }
      }
      return next
    })

    // stream a post in, biased towards the hero topic
    const source = Math.random() < 0.5 ? TOPICS[0] : TOPICS[Math.floor(Math.random() * TOPICS.length)]
    setFeed((f) => [synthPost(source, 0), ...f].slice(0, 50))
    setProcessed((n) => n + 700 + Math.floor(Math.random() * 900))
  }, [tick])

  // stream posts biased to whichever topic is escalating
  useEffect(() => {
    if (tick === 0 || isLive) return
    const hot = TOPICS.find((t) => (topics[t.id]?.escalation ?? 0) > 0.2)
    if (!hot) return
    setFeed((f) => [synthPost(hot, topics[hot.id].escalation), ...f].slice(0, 50))
  }, [tick]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- the backend, when it is there --------------------------------------
  // Probe once on mount. A snapshot switches this tab to live mode; anything
  // else leaves the local simulation running and flags the backend as offline.
  useEffect(() => {
    const socket = connectLive({
      onStatus: setConnection,
      onSnapshot: (snap) => {
        setTopics(snap.topics)
        setFeed(snap.feed)
        setAlerts(snap.alerts)
        setProcessed(snap.processed)
        setTick(snap.tick)
      },
      onTick: (delta) => {
        // an out-of-band post (live ingestion) arrives without topic deltas
        if (delta.type === 'post') {
          setFeed((f) => [delta.post, ...f].slice(0, 50))
          return
        }
        setTopics((prev) => {
          const next = { ...prev }
          for (const [id, d] of Object.entries(delta.topics ?? {})) {
            const cur = next[id]
            if (!cur) continue
            next[id] = {
              ...cur,
              history: [...cur.history.slice(1), d.point],
              forecast: d.forecast,
              forecastModel: d.forecastModel ?? cur.forecastModel,
              mentions: d.mentions,
              growth: d.growth,
              shift: d.shift,
              pos: d.pos,
              neu: d.neu,
              neg: d.neg,
            }
          }
          return next
        })
        if (delta.post) setFeed((f) => [delta.post, ...f].slice(0, 50))
        if (delta.processed) setProcessed(delta.processed)
        setTick(delta.tick)
      },
      onAlert: (alert) => setAlerts((a) => [alert, ...a].slice(0, 30)),
    })
    socketRef.current = socket
    return () => socket.close()
  }, [])

  // ---- alerts: fired when thresholds are crossed ---------------------------
  const raise = useCallback((topicId, kind) => {
    if (socketRef.current?.send({ action: 'raise', topic_id: topicId, kind })) return
    const key = `${topicId}:${kind}`
    if (firedRef.current.has(key)) return
    firedRef.current.add(key)
    const t = TOPICS.find((x) => x.id === topicId)
    setAlerts((a) => [makeAlert(t, kind, { neg: t.sentiment.neg }), ...a].slice(0, 30))
  }, [])

  // seed the board with the standing alerts a real deployment would already
  // have. The backend seeds its own, so skip this when it is driving.
  useEffect(() => {
    if (connection === 'live') return
    raise('exam', 'misinfo')
    raise('exam', 'coordination')
    raise('water', 'sentiment')
    raise('metro', 'virality')
  }, [raise, connection])

  const escalate = useCallback((topicId, amount = 1) => {
    if (socketRef.current?.send({ action: 'escalate', topic_id: topicId, amount })) return
    setTopics((prev) => ({ ...prev, [topicId]: { ...prev[topicId], escalation: clamp(amount, 0, 1) } }))
  }, [])

  const reset = useCallback(() => {
    setDemoStep(-1)
    if (socketRef.current?.send({ action: 'reset' })) return
    firedRef.current = new Set()
    setTopics(initialTopics())
    setAlerts([])
    setDemoStep(-1)
    setFeed(POSTS.slice(0, 10).map((p, i) => ({ ...p, id: `r${i}`, at: Date.now() - i * 9000, tag: TOPICS.find((t) => t.id === p.topic)?.tag })))
    raise('exam', 'misinfo')
    raise('exam', 'coordination')
    raise('water', 'sentiment')
    raise('metro', 'virality')
  }, [raise, connection])

  const markAlertsRead = useCallback(() => setAlerts((a) => a.map((x) => ({ ...x, read: true }))), [])

  // ---- totals -------------------------------------------------------------
  const totals = useMemo(() => {
    const list = TOPICS.map((t) => ({ t, l: topics[t.id] }))
    const mentions = list.reduce((a, x) => a + x.l.mentions, 0)
    const wpos = list.reduce((a, x) => a + x.l.pos * x.l.mentions, 0) / mentions
    const wneg = list.reduce((a, x) => a + x.l.neg * x.l.mentions, 0) / mentions
    return {
      mentions,
      processed,
      pos: Math.round(wpos),
      neg: Math.round(wneg),
      neu: Math.round(100 - wpos - wneg),
      topics: TOPICS.length,
      influencers: 15,
      alerts: alerts.length,
      unread: alerts.filter((a) => !a.read).length,
    }
  }, [topics, alerts, processed])

  const value = {
    running, setRunning, speed, setSpeed, tick,
    topics, feed, alerts, totals,
    selectedTopic, setSelectedTopic,
    demoStep, setDemoStep,
    escalate, raise, reset, markAlertsRead,
    connection, isLive,
  }

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>
}

// convenience: merge the static topic definition with its live state
export function useTopic(id) {
  const { topics } = useLive()
  const def = TOPICS.find((t) => t.id === id) || TOPICS[0]
  return { ...def, live: topics[def.id] }
}
