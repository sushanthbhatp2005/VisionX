import React, { useState } from 'react'
import { GitBranch, Radar, ShieldAlert } from 'lucide-react'
import { useLive, useTopic } from '../store/LiveContext.jsx'
import { Card, Chip, Meter } from '../components/ui.jsx'
import NetworkGraph from '../components/NetworkGraph.jsx'
import { InfluenceTable } from '../components/insight.jsx'
import { PersonaPanel } from '../components/panels.jsx'
import { CascadeReplay } from '../components/narrative.jsx'
import { ACCOUNTS, INFLUENCE_WEIGHTS } from '../data/seed.js'
import {
  COMPUTED_ACCOUNTS, COORDINATION, DETECTED_COMMUNITIES, GRAPH_STATS,
  communityAgreement, followerTrap, rankBy,
} from '../data/analysis.js'
import { fmt } from '../data/engine.js'

export default function NetworkPage() {
  const { selectedTopic } = useLive()
  const topic = useTopic(selectedTopic)
  const [cascade, setCascade] = useState(true)
  const [measure, setMeasure] = useState('pagerank')

  const { biggest, central } = followerTrap()
  const cluster = COORDINATION.top_cluster

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
          <Card title="The follower-count trap" right={<Chip tone="pos">computed</Chip>}>
            <div className="space-y-2.5">
              <Row
                label="Largest account"
                handle={biggest.handle}
                a={fmt(biggest.followers)}
                b={biggest.influence}
                tone="#8b95b5"
              />
              <Row
                label="Highest PageRank"
                handle={central.handle}
                a={fmt(central.followers)}
                b={central.influence}
                tone="#2fd4a7"
              />
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-slate-400">
              {biggest.handle} has {fmt(biggest.followers)} followers and a PageRank of{' '}
              {biggest.pagerank?.toFixed(4)}. {central.handle} has {fmt(central.followers)} — and the
              highest PageRank in the graph at {central.pagerank?.toFixed(4)}, because it sits at the
              centre of the conversation rather than beside it. Nobody told the algorithm that.
            </p>
          </Card>

          <Card
            title="Coordination watch"
            right={<Chip tone="neg"><ShieldAlert size={11} /> score {cluster?.score ?? 0}/100</Chip>}
          >
            {cluster ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['Accounts', cluster.account_count],
                    ['Overlap', `${cluster.narrative_overlap}%`],
                    ['Window', `${cluster.window_seconds}s`],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg border border-line bg-ink-700/40 px-2.5 py-1.5">
                      <div className="label">{k}</div>
                      <div className="font-mono text-[16px] font-bold text-white">{v}</div>
                    </div>
                  ))}
                </div>

                <p className="mt-2.5 text-[11.5px] leading-relaxed text-slate-400">
                  Clustered from {COORDINATION.posts_examined} posts by shingle similarity, then
                  scored on distinct accounts, narrative overlap and timing.
                </p>

                <div className="mt-2 space-y-1.5">
                  {cluster.accounts.map((handle) => (
                    <div
                      key={handle}
                      className="flex items-center gap-2 rounded-lg border border-neg/30 bg-neg/[.07] px-2.5 py-1.5"
                    >
                      <span className="text-[12.5px] font-medium text-slate-200">{handle}</span>
                      <span className="ml-auto font-mono text-[11px] text-slate-500">
                        {cluster.posts_per_account[handle]} posts
                      </span>
                    </div>
                  ))}
                </div>

                <p className="mt-2 rounded-lg border border-line bg-ink-700/30 px-2.5 py-1.5 font-mono text-[10.5px] leading-snug text-slate-500">
                  “{cluster.sample}”
                </p>
              </>
            ) : (
              <p className="text-[12px] text-slate-400">No cluster above threshold in this window.</p>
            )}

            <p className="mt-2.5 text-[11px] leading-relaxed text-slate-600">{COORDINATION.note}</p>
          </Card>

          <Card title="Graph structure" right={<Chip tone="accent">networkx</Chip>}>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Nodes', GRAPH_STATS.nodes],
                ['Edges', GRAPH_STATS.edges],
                ['Density', GRAPH_STATS.density],
                ['Modularity', GRAPH_STATS.modularity],
                ['Avg degree', GRAPH_STATS.avg_degree],
                ['Components', GRAPH_STATS.components],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-baseline justify-between rounded-lg border border-line bg-ink-700/40 px-2.5 py-1.5"
                >
                  <span className="text-[11.5px] text-slate-400">{k}</span>
                  <span className="font-mono text-[13px] font-semibold text-white">{v}</span>
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-slate-600">
              Modularity {GRAPH_STATS.modularity} means the Louvain split is real structure in the
              graph, not an arbitrary partition.
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
            <p className="mt-2.5 text-[11px] leading-relaxed text-slate-600">
              Network centrality is PageRank, normalised against the top-ranked account.
            </p>
          </Card>
        </div>
      </div>

      <CascadeReplay topic={topic} />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card
          title="Centrality ranking"
          right={
            <div className="flex gap-1">
              {['pagerank', 'betweenness', 'degree'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMeasure(m)}
                  className={`rounded-md border px-1.5 py-0.5 text-[10.5px] transition ${
                    measure === m
                      ? 'border-accent-dim bg-accent-dim/25 text-accent'
                      : 'border-line bg-ink-700 text-slate-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          }
        >
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wider text-slate-500">
                <th className="pb-1.5 font-medium">Account</th>
                <th className="pb-1.5 text-right font-medium">Followers</th>
                <th className="pb-1.5 pl-3 text-right font-medium">{measure}</th>
              </tr>
            </thead>
            <tbody>
              {rankBy(measure, 8).map((a) => (
                <tr key={a.id} className="border-t border-line/70">
                  <td className="py-1.5 text-slate-200">{a.handle}</td>
                  <td className="py-1.5 text-right font-mono text-slate-500">{fmt(a.followers)}</td>
                  <td className="py-1.5 pl-3 text-right font-mono font-semibold text-accent">
                    {a[measure]?.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2.5 text-[11px] leading-relaxed text-slate-600">
            Betweenness finds bridges between communities — the accounts that carry a topic from
            one cluster into another. They are rarely the loudest.
          </p>
        </Card>

        <PersonaPanel />

        <Card
          title="Louvain communities"
          right={<Chip tone="accent">{DETECTED_COMMUNITIES.length} detected</Chip>}
        >
          <div className="space-y-2.5">
            {communityAgreement().map((c) => (
              <div key={c.id} className="rounded-lg border border-line bg-ink-700/40 p-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                  <span className="text-[12.5px] font-medium text-slate-200">{c.label}</span>
                  <span className="ml-auto font-mono text-[11px] text-slate-500">
                    {c.members.length} accounts
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  closest authored label: {c.handLabel ?? '—'}
                  <span className={c.purityPct === 100 ? 'text-pos' : ''}> ({c.purityPct}% match)</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {c.members.map((id) => {
                    const a = COMPUTED_ACCOUNTS.find((x) => x.id === id)
                    return (
                      <span
                        key={id}
                        className="rounded bg-ink-600 px-1.5 py-px font-mono text-[10px] text-slate-400"
                      >
                        {a?.handle ?? id}
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2.5 text-[11px] leading-relaxed text-slate-600">
            Louvain found these from edge weights alone. It was never told which accounts were
            suspicious — the amplifier ring falls out on its own at 100% match.
          </p>
        </Card>
      </div>

      <InfluenceTable limit={10} />
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
