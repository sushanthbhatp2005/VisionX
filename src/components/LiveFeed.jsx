import React, { useMemo, useState } from 'react'
import { Bot, Filter } from 'lucide-react'
import { Card, Chip, Dot } from './ui.jsx'
import { useLive } from '../store/LiveContext.jsx'
import { PLATFORMS } from '../data/seed.js'

const SENT = { pos: { c: '#2fd4a7', l: 'positive' }, neu: { c: '#8b95b5', l: 'neutral' }, neg: { c: '#ff5d73', l: 'negative' } }
const platName = (id) => PLATFORMS.find((p) => p.id === id)?.name ?? id
const platColor = (id) => PLATFORMS.find((p) => p.id === id)?.color ?? '#8b95b5'

export default function LiveFeed({ topicId, height = 420, title = 'Live annotated stream' }) {
  const { feed, running } = useLive()
  const [filter, setFilter] = useState('all')

  const rows = useMemo(() => {
    let r = topicId ? feed.filter((p) => p.topic === topicId) : feed
    if (filter === 'sarcasm') r = r.filter((p) => p.sarcasm > 35)
    if (filter === 'suspicious') r = r.filter((p) => p.bot > 60)
    if (filter === 'codemix') r = r.filter((p) => p.lang !== 'English')
    return r.slice(0, 30)
  }, [feed, topicId, filter])

  const FILTERS = [
    ['all', 'All'],
    ['codemix', 'Code-mixed'],
    ['sarcasm', 'Sarcasm'],
    ['suspicious', 'Suspicious'],
  ]

  return (
    <Card
      title={title}
      bodyClass="px-4 pb-3"
      right={
        <div className="flex items-center gap-1.5">
          <Dot color={running ? '#2fd4a7' : '#8b95b5'} pulse={running} />
          <span className="font-mono text-[11px] text-slate-500">{rows.length} shown</span>
        </div>
      }
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Filter size={12} className="text-slate-600" />
        {FILTERS.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-md border px-2 py-0.5 text-[11px] transition ${
              filter === k ? 'border-accent-dim bg-accent-dim/25 text-accent' : 'border-line bg-ink-700/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="space-y-1.5 overflow-y-auto pr-1" style={{ height }}>
        {rows.length === 0 && (
          <div className="flex h-full items-center justify-center text-[12.5px] text-slate-600">
            No posts match this filter yet — the stream is still arriving.
          </div>
        )}
        {rows.map((p) => {
          const s = SENT[p.sentiment]
          return (
            <article
              key={p.id}
              className="animate-slideIn rounded-lg border border-line bg-ink-700/40 px-3 py-2 transition hover:border-accent-dim/50"
            >
              <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                <span className="font-mono font-medium text-slate-300">{p.author}</span>
                <span
                  className="rounded px-1.5 py-px text-[10px] font-medium"
                  style={{ color: platColor(p.platform), background: `${platColor(p.platform)}18` }}
                >
                  {platName(p.platform)}
                </span>
                <span className="text-slate-600">{p.lang}</span>
                {p.bot > 60 && (
                  <span className="flex items-center gap-1 rounded bg-neg/15 px-1.5 py-px text-[10px] text-neg">
                    <Bot size={9} /> anomalous {p.bot}%
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.c }} />
                  <span style={{ color: s.c }}>{s.l}</span>
                </span>
              </div>

              <p className="text-[12.5px] leading-snug text-slate-200">{p.text}</p>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-slate-500">
                <span>emotion: <span className="text-slate-400">{p.emotion}</span></span>
                <span>stance: <span className="text-slate-400">{p.stance}</span></span>
                {p.sarcasm > 35 && <span className="text-warn">sarcasm {p.sarcasm}%</span>}
                <span className="ml-auto">{p.place}</span>
              </div>
            </article>
          )
        })}
      </div>
    </Card>
  )
}

