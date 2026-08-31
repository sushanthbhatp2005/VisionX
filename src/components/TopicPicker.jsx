import React from 'react'
import { Flame } from 'lucide-react'
import { TOPICS } from '../data/seed.js'
import { useLive } from '../store/LiveContext.jsx'
import { fmt, pct, riskBand } from '../data/engine.js'
import { Card, Chip, SentimentBar } from './ui.jsx'
import { Spark } from './charts.jsx'

export default function TopicPicker({ title = 'Trending topics', height, onPick }) {
  const { topics, selectedTopic, setSelectedTopic } = useLive()
  const rows = TOPICS.map((t) => ({ t, l: topics[t.id] })).sort((a, b) => b.l.growth - a.l.growth)

  return (
    <Card title={title} right={<Chip><Flame size={11} /> ranked by velocity</Chip>} bodyClass="px-3 pb-3">
      <div className="space-y-1.5 overflow-y-auto pr-1" style={height ? { height } : undefined}>
        {rows.map(({ t, l }) => {
          const active = selectedTopic === t.id
          const band = riskBand(t.crisis)
          return (
            <button
              key={t.id}
              onClick={() => { setSelectedTopic(t.id); onPick?.(t.id) }}
              className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                active ? 'border-accent-dim bg-accent-dim/15' : 'border-line bg-ink-700/40 hover:border-accent-dim/50 hover:bg-ink-700/70'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-semibold text-white">{t.tag}</span>
                <span
                  className="rounded px-1.5 py-px font-mono text-[9.5px] font-bold"
                  style={{ color: band.color, background: `${band.color}1c` }}
                >
                  {band.label}
                </span>
                <span className="ml-auto font-mono text-[12px] text-slate-300">{fmt(l.mentions)}</span>
                <span className={`font-mono text-[11.5px] ${l.growth > 90 ? 'text-neg' : 'text-slate-500'}`}>
                  {pct(l.growth)}
                </span>
              </div>

              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                <span>{t.title}</span>
                <span className="ml-auto">virality {t.virality}%</span>
              </div>

              <div className="mt-2 flex items-center gap-3">
                <div className="w-[86px] shrink-0">
                  <Spark data={l.history.slice(-20)} color={l.neg > 55 ? '#ff5d73' : '#6ea8ff'} height={24} />
                </div>
                <div className="flex-1">
                  <SentimentBar pos={Math.round(l.pos)} neu={Math.round(l.neu)} neg={Math.round(l.neg)} height={5} />
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
