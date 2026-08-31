import React, { useState } from 'react'
import { GitBranch, Radar } from 'lucide-react'
import { useLive, useTopic } from '../store/LiveContext.jsx'
import { Card, Chip, Meter } from '../components/ui.jsx'
import NetworkGraph from '../components/NetworkGraph.jsx'
import { InfluenceTable } from '../components/insight.jsx'
import { PersonaPanel } from '../components/panels.jsx'
import { ACCOUNTS, COMMUNITIES, INFLUENCE_WEIGHTS, influenceScore } from '../data/seed.js'
import { fmt } from '../data/engine.js'

export default function NetworkPage() {
  const { selectedTopic } = useLive()
  const topic = useTopic(selectedTopic)
  const [cascade, setCascade] = useState(true)

  const ranked = ACCOUNTS.map((a) => ({ ...a, score: influenceScore(a) })).sort((a, b) => b.score - a.score)
  const biggest = [...ACCOUNTS].sort((a, b) => b.followers - a.followers)[0]
  const mostInfluential = ranked[0]
  const suspicious = ACCOUNTS.filter((a) => a.suspicious)

  return (
    <div className="mx-auto max-w-[1500px] space-y-3">
      <div className="grid gap-3 xl:grid-cols-[1fr_340px]">
        <Card
          title={`Influence network · ${topic.tag}`}
          right={
            <div className="flex items-center gap-1.5">
              <Chip tone="accent"><GitBranch size={11} /> PageRank + Louvain</Chip>
              <button
                onClick={() => setCascade(!cascade)}
                className={`rounded-md border px-2 py-0.5 text-[11px] transition ${
                  cascade ? 'border-accent-dim bg-accent-dim/25 text-accent' : 'border-line bg-ink-700 text-slate-400'
                }`}
              >
                cascade {cascade ? 'on' : 'off'}
              </button>
            </div>
          }
        >
          <NetworkGraph highlight={topic.influencers} cascade={cascade} height={452} />
        </Card>

        <div className="space-y-3">
          <Card title="The follower-count trap" right={<Chip tone="pos">key insight</Chip>}>
            <div className="space-y-2.5">
              <Row
                label="Largest account"
                handle={biggest.handle}
                a={fmt(biggest.followers)}
                b={influenceScore(biggest)}
                tone="#8b95b5"
              />
              <Row
                label="Actually driving it"
                handle={mostInfluential.handle}
                a={fmt(mostInfluential.followers)}
                b={mostInfluential.score}
                tone="#2fd4a7"
              />
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-slate-400">
              {biggest.handle} has {fmt(biggest.followers)} followers and an influence score of{' '}
              {influenceScore(biggest)}. {mostInfluential.handle} has {fmt(mostInfluential.followers)} — and a
              score of {mostInfluential.score}, because it sits at the centre of the conversation rather than beside it.
            </p>
          </Card>

          <Card title="Influence score formula" right={<Chip><Radar size={11} /> weighted</Chip>}>
            <div className="space-y-2">
              {INFLUENCE_WEIGHTS.map((w) => (
                <div key={w.key} className="flex items-center gap-3">
                  <span className="w-[132px] shrink-0 text-[12px] text-slate-400">{w.label}</span>
                  <Meter value={w.weight * 3.4} color="#6ea8ff" height={4} />
                  <span className="w-8 shrink-0 text-right font-mono text-[11.5px] text-slate-300">{w.weight}%</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Coordination watch" right={<Chip tone="neg">{suspicious.length} accounts</Chip>}>
            <p className="text-[12px] leading-relaxed text-slate-400">
              A tight ring in the amplifier cluster: near-identical text, 90-second posting windows,
              engagement ratios far below their follower counts.
            </p>
            <div className="mt-2.5 space-y-1.5">
              {suspicious.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-lg border border-neg/30 bg-neg/[.07] px-2.5 py-1.5">
                  <span className="text-[12.5px] font-medium text-slate-200">{a.handle}</span>
                  <span className="ml-auto font-mono text-[11px] text-slate-500">{fmt(a.followers)} followers</span>
                  <span className="font-mono text-[11px] text-neg">amp {a.amplification}x</span>
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-slate-600">
              Labelled “potentially coordinated”, never automatically “bots”. The cluster is queued for human review.
            </p>
          </Card>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <InfluenceTable limit={8} />
        <PersonaPanel />
        <Card title="Community structure" right={<Chip>{COMMUNITIES.length} clusters</Chip>}>
          <div className="space-y-2.5">
            {COMMUNITIES.map((c) => {
              const members = ACCOUNTS.filter((a) => a.community === c.id)
              return (
                <div key={c.id} className="rounded-lg border border-line bg-ink-700/40 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                    <span className="text-[12.5px] font-medium text-slate-200">{c.label}</span>
                    <span className="ml-auto font-mono text-[11px] text-slate-500">{members.length} accounts</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {members.map((m) => (
                      <span key={m.id} className="rounded bg-ink-600 px-1.5 py-px font-mono text-[10px] text-slate-400">
                        {m.handle}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, handle, a, b, tone }) {
  return (
    <div className="rounded-lg border border-line bg-ink-700/40 px-3 py-2">
      <div className="label">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className="text-[13.5px] font-semibold text-white">{handle}</span>
        <span className="ml-auto font-mono text-[11.5px] text-slate-500">{a} followers</span>
        <span className="font-mono text-[17px] font-bold" style={{ color: tone }}>{b}</span>
      </div>
    </div>
  )
}
