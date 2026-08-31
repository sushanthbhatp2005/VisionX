import React, { useMemo, useState } from 'react'
import { ACCOUNTS, COMMUNITIES, EDGES, PERSONAS, influenceScore } from '../data/seed.js'
import { rng, hash, fmt } from '../data/engine.js'

const W = 780
const H = 460

/* A tiny deterministic force layout: spring edges + charge repulsion,
   relaxed once at mount so the graph is stable across re-renders. */
function layout(nodes, edges, iterations = 420) {
  const r = rng(hash('visionx-layout'))
  const pos = {}
  nodes.forEach((n, i) => {
    const a = (i / nodes.length) * Math.PI * 2
    pos[n.id] = { x: W / 2 + Math.cos(a) * 150 + (r() - 0.5) * 40, y: H / 2 + Math.sin(a) * 110 + (r() - 0.5) * 40, vx: 0, vy: 0 }
  })

  for (let it = 0; it < iterations; it++) {
    const cool = 1 - it / iterations
    // repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const p = pos[nodes[i].id], q = pos[nodes[j].id]
        let dx = q.x - p.x, dy = q.y - p.y
        let d2 = dx * dx + dy * dy || 0.01
        const f = 7600 / d2
        const d = Math.sqrt(d2)
        const ux = dx / d, uy = dy / d
        p.vx -= ux * f; p.vy -= uy * f
        q.vx += ux * f; q.vy += uy * f
      }
    }
    // springs
    for (const [a, b, w] of edges) {
      const p = pos[a], q = pos[b]
      const dx = q.x - p.x, dy = q.y - p.y
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01
      const rest = 172 - w * 4
      const f = (d - rest) * 0.012
      const ux = dx / d, uy = dy / d
      p.vx += ux * f; p.vy += uy * f
      q.vx -= ux * f; q.vy -= uy * f
    }
    // gravity + integrate
    for (const n of nodes) {
      const p = pos[n.id]
      p.vx += (W / 2 - p.x) * 0.0019
      p.vy += (H / 2 - p.y) * 0.0028
      p.x += p.vx * cool * 0.55
      p.y += p.vy * cool * 0.55
      p.vx *= 0.82; p.vy *= 0.82
      p.x = Math.max(38, Math.min(W - 38, p.x))
      p.y = Math.max(34, Math.min(H - 34, p.y))
    }
  }
  return pos
}

export default function NetworkGraph({ highlight = [], cascade = false, height = 440 }) {
  const [hover, setHover] = useState(null)
  const [pinned, setPinned] = useState(null)
  const nodes = useMemo(() => ACCOUNTS.map((a) => ({ ...a, score: influenceScore(a) })), [])
  const pos = useMemo(() => layout(nodes, EDGES), [nodes])
  const active = pinned ?? hover
  const neighbours = useMemo(() => {
    if (!active) return null
    const s = new Set([active])
    for (const [a, b] of EDGES) {
      if (a === active) s.add(b)
      if (b === active) s.add(a)
    }
    return s
  }, [active])

  const dim = (id) => (neighbours && !neighbours.has(id) ? 0.16 : 1)
  const activeNode = nodes.find((n) => n.id === active)

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} onClick={() => setPinned(null)}>
        <defs>
          <radialGradient id="glow">
            <stop offset="0%" stopColor="#6ea8ff" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#6ea8ff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#glow)" />

        {/* edges */}
        <g>
          {EDGES.map(([a, b, w], i) => {
            const p = pos[a], q = pos[b]
            const on = !neighbours || (neighbours.has(a) && neighbours.has(b))
            const na = nodes.find((n) => n.id === a)
            const nb = nodes.find((n) => n.id === b)
            const suspect = na?.suspicious && nb?.suspicious
            return (
              <g key={i}>
                <line
                  x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                  stroke={suspect ? '#ff5d73' : '#2a3858'}
                  strokeWidth={Math.max(0.6, w / 6)}
                  strokeOpacity={on ? (suspect ? 0.75 : 0.42) : 0.06}
                />
                {cascade && highlight.includes(a) && (
                  <circle r="2.6" fill="#6ea8ff">
                    <animateMotion dur={`${2.4 + (i % 5) * 0.4}s`} repeatCount="indefinite"
                      path={`M${p.x},${p.y} L${q.x},${q.y}`} />
                  </circle>
                )}
              </g>
            )
          })}
        </g>

        {/* nodes */}
        <g>
          {nodes.map((n) => {
            const p = pos[n.id]
            const comm = COMMUNITIES.find((c) => c.id === n.community)
            const r = 7 + (n.score / 100) * 13
            const isHi = highlight.includes(n.id)
            return (
              <g
                key={n.id}
                transform={`translate(${p.x},${p.y})`}
                opacity={dim(n.id)}
                className="cursor-pointer transition-opacity duration-300"
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
                onClick={(e) => { e.stopPropagation(); setPinned(pinned === n.id ? null : n.id) }}
              >
                {isHi && <circle r={r + 7} fill="none" stroke={comm.color} strokeWidth="1" opacity="0.5" className="animate-shimmer" />}
                <circle r={r} fill={comm.color} fillOpacity={n.suspicious ? 0.35 : 0.85} stroke={comm.color} strokeWidth="1.5" />
                {n.suspicious && <text y="3.5" textAnchor="middle" fontSize="10" fill="#ff5d73">⚠</text>}
                <text
                  y={p.y > H / 2 ? -(r + 6) : r + 11}
                  textAnchor="middle" fontSize="9.5" fill="#94a3b8"
                  fontFamily="JetBrains Mono, monospace"
                  opacity={active === n.id || r > 15 ? 1 : 0.55}
                >
                  {n.handle}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {/* legend */}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5">
        {COMMUNITIES.map((c) => (
          <span key={c.id} className="flex items-center gap-1.5 text-[11.5px] text-slate-400">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
            {c.label}
          </span>
        ))}
        <span className="ml-auto text-[11px] text-slate-600">node size = influence score · click to pin</span>
      </div>

      {/* hover card */}
      {activeNode && (
        <div className="pointer-events-none absolute right-2 top-2 w-[212px] rounded-lg border border-line bg-ink-900/95 p-3 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-white">{activeNode.handle}</span>
            <span className="font-mono text-[15px] font-bold text-accent">{activeNode.score}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">{activeNode.name}</div>
          <div className="mt-2 space-y-1 text-[11.5px]">
            {[
              ['Followers', fmt(activeNode.followers)],
              ['Engagement', `${activeNode.engagement}%`],
              ['Centrality', activeNode.centrality.toFixed(2)],
              ['Amplification', `${activeNode.amplification}x`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-slate-500">{k}</span>
                <span className="font-mono text-slate-300">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1.5 border-t border-line pt-2 text-[11px]">
            <span className="h-2 w-2 rounded-full" style={{ background: PERSONAS[activeNode.persona].color }} />
            <span className="text-slate-300">{PERSONAS[activeNode.persona].label}</span>
          </div>
        </div>
      )}
    </div>
  )
}
