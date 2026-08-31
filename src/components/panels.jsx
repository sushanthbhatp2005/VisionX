import React from 'react'
import { Languages, MapPin, Radio, Repeat2, Users2 } from 'lucide-react'
import { Card, Chip, Meter } from './ui.jsx'
import { CITY_COORDS, COMMUNITIES, LANGUAGES, PERSONAS, PLATFORMS, POSTS, ACCOUNTS } from '../data/seed.js'
import { fmt } from '../data/engine.js'

const plat = (id) => PLATFORMS.find((p) => p.id === id)

/* ================================================================== *
 * Cross-platform propagation: where it started and how it travelled.
 * ================================================================== */
export function Propagation({ topic }) {
  const chain = topic.propagation
  const origin = chain[0].from
  return (
    <Card
      title="Cross-platform propagation"
      right={<Chip tone="accent"><Repeat2 size={11} /> origin: {plat(origin).name}</Chip>}
    >
      <div className="space-y-0">
        <Hop platform={origin} first />
        {chain.map((h, i) => (
          <React.Fragment key={i}>
            <div className="flex items-stretch gap-3 pl-[18px]">
              <div className="relative w-px bg-line">
                <span
                  className="absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-accent"
                  style={{ animation: `slideDown 2.6s ${i * 0.5}s ease-in-out infinite` }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2 text-[11.5px]">
                <span className="font-mono text-slate-400">+{h.delayMin} min</span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-400">{fmt(h.volume)} posts carried</span>
                <span className="text-slate-500">·</span>
                <span className={h.sentimentDelta < 0 ? 'text-neg' : 'text-pos'}>
                  sentiment {h.sentimentDelta > 0 ? '+' : ''}{h.sentimentDelta}
                </span>
              </div>
            </div>
            <Hop platform={h.to} />
          </React.Fragment>
        ))}
      </div>
      <style>{`@keyframes slideDown { 0% { top: 0; opacity: 0 } 15% { opacity: 1 } 85% { opacity: 1 } 100% { top: 100%; opacity: 0 } }`}</style>
      <p className="mt-3 text-[11.5px] leading-relaxed text-slate-500">
        Total travel time {chain.reduce((a, h) => a + h.delayMin, 0)} minutes across{' '}
        {new Set(chain.flatMap((h) => [h.from, h.to])).size} platforms. Sentiment degrades{' '}
        {Math.abs(chain.reduce((a, h) => a + Math.min(0, h.sentimentDelta), 0))} points along the chain.
      </p>
    </Card>
  )
}

function Hop({ platform, first }) {
  const p = plat(platform)
  return (
    <div className="flex items-center gap-3">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border text-[11px] font-bold"
        style={{ borderColor: `${p.color}66`, background: `${p.color}14`, color: p.color }}
      >
        {p.name.slice(0, 2).toUpperCase()}
      </span>
      <div>
        <div className="text-[13px] font-medium text-slate-200">{p.name}</div>
        {first && <div className="text-[11px] text-slate-500">first detected here</div>}
      </div>
    </div>
  )
}

/* ================================================================== *
 * Geographic intelligence (aggregated, k-anonymised).
 * ================================================================== */
const LNG0 = 67, LNG1 = 98, LAT0 = 37, LAT1 = 6
const px = (lng) => ((lng - LNG0) / (LNG1 - LNG0)) * 100
const py = (lat) => ((LAT0 - lat) / (LAT0 - LAT1)) * 100

// Simplified national outline, projected with the same transform as the cities.
const OUTLINE = [
  [74.0, 34.5], [77.5, 35.5], [79.5, 33.0], [81.0, 30.3], [84.0, 27.5], [88.2, 27.9],
  [89.5, 26.0], [92.0, 27.5], [95.5, 28.5], [97.3, 28.2], [96.5, 27.0], [94.5, 25.0],
  [93.3, 23.0], [92.0, 21.5], [89.0, 21.8], [87.0, 21.5], [85.0, 19.5], [82.0, 17.0],
  [80.3, 15.8], [80.3, 13.1], [79.8, 10.3], [77.5, 8.1], [76.0, 9.5], [74.9, 12.9],
  [73.5, 15.9], [72.8, 19.0], [72.6, 21.5], [69.0, 22.3], [68.2, 23.8], [70.5, 24.5],
  [71.0, 27.0], [73.9, 30.0],
]
const OUTLINE_PATH = OUTLINE.map(([lng, lat], i) => `${i ? 'L' : 'M'}${px(lng).toFixed(1)},${py(lat).toFixed(1)}`).join(' ') + ' Z'

export function GeoPanel({ topic, height = 300 }) {
  const max = Math.max(...topic.geo.map((g) => g.mentions))
  return (
    <Card title="Geographic intelligence" right={<Chip><MapPin size={11} /> aggregated, k ≥ 20</Chip>}>
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <div className="relative rounded-lg border border-line bg-ink-900/60 grid-lines" style={{ height }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="h-full w-full">
            <path d={OUTLINE_PATH} fill="rgba(110,168,255,.07)" stroke="#2a3858" strokeWidth="0.5" strokeLinejoin="round" />
            {topic.geo.map((g) => {
              const c = CITY_COORDS[g.place]
              if (!c) return null
              const r = 1.4 + (g.mentions / max) * 4.4
              const color = g.neg > 60 ? '#ff5d73' : g.neg > 40 ? '#ffb02e' : '#2fd4a7'
              return (
                <g key={g.place}>
                  <circle cx={px(c[0])} cy={py(c[1])} r={r * 2.4} fill={color} opacity="0.13" />
                  <circle cx={px(c[0])} cy={py(c[1])} r={r} fill={color} opacity="0.9">
                    <animate attributeName="opacity" values="0.9;0.45;0.9" dur="3s" repeatCount="indefinite" />
                  </circle>
                  <text x={px(c[0]) + r + 1.4} y={py(c[1]) + 1} fontSize="2.6" fill="#94a3b8" fontFamily="JetBrains Mono, monospace">
                    {g.place}
                  </text>
                </g>
              )
            })}
          </svg>
          <span className="absolute bottom-1.5 right-2 text-[10px] text-slate-600">bubble = volume · colour = negative share</span>
        </div>

        <div className="space-y-2">
          {topic.geo.map((g) => (
            <div key={g.place}>
              <div className="flex items-baseline justify-between text-[12px]">
                <span className="text-slate-300">{g.place}</span>
                <span className="font-mono text-[11px] text-slate-500">{fmt(g.mentions)}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <Meter value={g.neg} color={g.neg > 60 ? '#ff5d73' : g.neg > 40 ? '#ffb02e' : '#2fd4a7'} height={4} />
                <span className="w-8 shrink-0 text-right font-mono text-[10.5px] text-slate-500">{g.neg}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

/* ================================================================== *
 * Language / code-mix intelligence.
 * ================================================================== */
export function LanguagePanel() {
  const max = Math.max(...LANGUAGES.map((l) => l.share))
  return (
    <Card title="Language coverage" right={<Chip tone="accent"><Languages size={11} /> IndicBERT + code-mix</Chip>}>
      <div className="space-y-2">
        {LANGUAGES.map((l) => (
          <div key={l.id} className="flex items-center gap-3">
            <span className="w-[142px] shrink-0 text-[12px] text-slate-400">{l.name}</span>
            <Meter value={(l.share / max) * 100} color={l.id.includes('-') || l.id === 'hinglish' ? '#c77dff' : '#6ea8ff'} height={5} />
            <span className="w-8 shrink-0 text-right font-mono text-[11.5px] text-slate-300">{l.share}%</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-slate-500">
        23% of the corpus is code-mixed. A monolingual model scores those posts as neutral;
        the code-mix path recovers sentiment, emotion and stance from them.
      </p>
    </Card>
  )
}

/* ================================================================== *
 * Sarcasm / context detection — the classic failure case, handled.
 * ================================================================== */
export function SarcasmPanel({ topicId = 'traffic' }) {
  const samples = POSTS.filter((p) => p.sarcasm > 35).slice(0, 3)
  return (
    <Card title="Sarcasm & context detection" right={<Chip tone="warn"><Radio size={11} /> surface vs. intent</Chip>}>
      <div className="space-y-2.5">
        {samples.map((p, i) => (
          <div key={i} className="rounded-lg border border-line bg-ink-700/40 p-3">
            <div className="mb-1.5 flex items-center gap-2 text-[11px]">
              <span className="font-mono text-slate-400">{p.author}</span>
              <Chip>{p.lang}</Chip>
              <span className="ml-auto font-mono text-warn">sarcasm {p.sarcasm}%</span>
            </div>
            <p className="text-[13px] leading-snug text-slate-200">“{p.text}”</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded bg-pos/10 px-1.5 py-0.5 text-pos">surface: {p.surface}</span>
              <span className="text-slate-600">→</span>
              <span className="rounded bg-neg/15 px-1.5 py-0.5 font-semibold text-neg">resolved: {p.sentiment}</span>
              <span className="ml-auto text-slate-500">emotion: {p.emotion}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

/* ================================================================== *
 * Behavioural communities.
 * ================================================================== */
export function PersonaPanel() {
  const counts = Object.keys(PERSONAS).map((k) => ({
    key: k,
    ...PERSONAS[k],
    n: ACCOUNTS.filter((a) => a.persona === k).length,
  }))
  const total = ACCOUNTS.length
  return (
    <Card title="Behavioural communities" right={<Chip><Users2 size={11} /> Louvain clusters</Chip>}>
      <div className="space-y-2.5">
        {counts.map((c) => (
          <div key={c.key}>
            <div className="flex items-baseline justify-between">
              <span className="flex items-center gap-2 text-[12.5px] text-slate-200">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                {c.label}
              </span>
              <span className="font-mono text-[11.5px] text-slate-400">{Math.round((c.n / total) * 100)}%</span>
            </div>
            <p className="ml-[18px] text-[11px] text-slate-500">{c.blurb}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t border-line pt-2.5">
        <div className="label mb-1.5">Network communities</div>
        <div className="flex h-2 overflow-hidden rounded-full">
          {COMMUNITIES.map((c) => (
            <div key={c.id} style={{ width: `${c.size * 100}%`, background: c.color }} />
          ))}
        </div>
      </div>
    </Card>
  )
}
