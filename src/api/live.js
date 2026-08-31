// ---------------------------------------------------------------------------
// WebSocket client for the FastAPI backend.
//
// The dashboard must never depend on this. It probes once; if the backend is
// not there, the caller keeps running its own simulation and the UI says so.
// That is what keeps the GitHub Pages build working with no server at all.
// ---------------------------------------------------------------------------

export const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:8000'

export const WS_URL = `${API_BASE.replace(/^http/, 'ws')}/ws/stream`

const CONNECT_TIMEOUT_MS = 2500
const RETRY_MS = 15000

/**
 * Open the live stream.
 *
 * @param {object} handlers
 *   onSnapshot(state)  full state, sent once per connection
 *   onTick(delta)      one clock tick
 *   onAlert(alert)     an alert raised out of band
 *   onStatus(status)   'connecting' | 'live' | 'offline'
 * @returns {{ send: Function, close: Function }}
 */
export function connectLive({ onSnapshot, onTick, onAlert, onStatus }) {
  let ws = null
  let closed = false
  let retryTimer = null
  let connectTimer = null

  const status = (s) => onStatus?.(s)

  const open = () => {
    if (closed) return
    status('connecting')

    try {
      ws = new WebSocket(WS_URL)
    } catch {
      status('offline')
      scheduleRetry()
      return
    }

    // A backend that is not listening can take a while to fail on some
    // platforms; do not leave the UI in "connecting" for longer than this.
    connectTimer = setTimeout(() => {
      if (ws && ws.readyState !== WebSocket.OPEN) {
        try { ws.close() } catch { /* already gone */ }
        status('offline')
      }
    }, CONNECT_TIMEOUT_MS)

    ws.onopen = () => {
      clearTimeout(connectTimer)
      status('live')
    }

    ws.onmessage = (event) => {
      let msg
      try {
        msg = JSON.parse(event.data)
      } catch {
        return
      }
      if (msg.type === 'snapshot') onSnapshot?.(msg)
      else if (msg.type === 'tick') onTick?.(msg)
      else if (msg.type === 'alert') onAlert?.(msg.alert)
      else if (msg.type === 'ingest') msg.posts?.forEach((p) => onTick?.({ type: 'post', post: p }))
    }

    ws.onerror = () => {
      clearTimeout(connectTimer)
    }

    ws.onclose = () => {
      clearTimeout(connectTimer)
      if (!closed) {
        status('offline')
        scheduleRetry()
      }
    }
  }

  const scheduleRetry = () => {
    clearTimeout(retryTimer)
    retryTimer = setTimeout(open, RETRY_MS)
  }

  open()

  return {
    send(payload) {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload))
        return true
      }
      return false
    },
    close() {
      closed = true
      clearTimeout(retryTimer)
      clearTimeout(connectTimer)
      try { ws?.close() } catch { /* already gone */ }
    },
  }
}

/** One-shot REST helper, used for health details and manual ingestion. */
export async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}
