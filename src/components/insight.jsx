import React from 'react'
import {
  AlertTriangle, ArrowRight, Braces, Flame, GitMerge, Megaphone, MoveRight,
  ShieldAlert, Sparkles, TrendingUp, Users, Zap,
} from 'lucide-react'
import { Card, Chip, Meter, ScoreRing, PRIORITY } from './ui.jsx'
import { crisisFactors, fusionScore, viralityFactors, riskBand, fmt, pct } from '../data/engine.js'
import { ACCOUNTS, influenceScore } from '../data/seed.js'
import { COMPUTED_ACCOUNTS, COORDINATION } from '../data/analysis.js'

/* ================================================================== *
 * 1. "Why is this trending?" — the causal chain, not just the number.
 * ================================================================== */
const DRIVER_ICON = { seed: Sparkles, migration: MoveRight, sentiment: TrendingUp, merge: GitMerge, amplify: Megaphone }
const DRIVER_COLOR = { seed: '#c77dff', migration: '#6ea8ff', sentiment: '#ff5d73', merge: '#ffb02e', amplify: '#2fd4a7' }

export function WhyTrending({ topic }) {
  return (
    <Card
      title={`Why is ${topic.tag} trending?`}
      right={<Chip tone="accent"><Braces size={11} /> causal chain</Chip>}
    >
      <ol className="relative space-y-3 pl-5">
        <span className="absolute left-[7px] top-2 bottom-2 w-px bg-line" />
        {topic.drivers.map((d, i) => {
          const Icon = DRIVER_ICON[d.kind] ?? Sparkles
          const color = DRIVER_COLOR[d.kind] ?? '#6ea8ff'
          return (
            <li key={i} className="relative animate-slideIn" style={{ animationDelay: `${i * 70}ms` }}>
              <span
                className="absolute -left-5 top-1 grid h-[15px] w-[15px] place-items-center rounded-full border"
                style={{ borderColor: color, background: '#0b1020' }}
              >
                <Icon size={8.5} style={{ color }} />
              </span>
              <div className="flex items-start gap-2">
                <span className="mt-px font-mono text-[11px] text-slate-500">{d.at}</span>
                <p className="flex-1 text-[13px] leading-snug text-slate-300">{d.text}</p>
                <span className="font-mono text-[11px] font-semibold" style={{ color }}>{d.weight}%</span>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-ink-700/40 px-3 py-2.5 text-[12px] text-slate-400">
        {['Event', 'Influencer', 'Community', 'Platform', 'Viral trend'].map((s, i, arr) => (
          <React.Fragment key={s}>
            <span className="font-medium text-slate-300">{s}</span>
            {i < arr.length - 1 && <ArrowRight size={12} className="text-slate-600" />}
          </React.Fragment>
        ))}
      </div>
    </Card>
  )
}

/* ================================================================== *
 * 2. Virality prediction.
 * ================================================================== */
export function ViralityPanel({ topic }) {
  const factors = viralityFactors(topic, topic.live)
  const eta = topic.peakEtaMin
  const etaText = eta >= 60 ? `${Math.floor(eta / 60)}h ${eta % 60}m` : `${eta}m`
  return (
    <Card title="Virality prediction" right={<Chip tone={topic.virality >= 75 ? 'neg' : 'warn'}><Flame size={11} /> {topic.virality}% probability</Chip>}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-col items-center gap-1.5">
          <ScoreRing value={topic.virality} color={topic.virality >= 75 ? '#ff5d73' : '#ffb02e'} label="virality" />
          <div className="text-center">
            <div className="font-mono text-[13px] font-semibold text-white">peak in ~{etaText}</div>
            <div className="text-[11px] text-slate-500">at {fmt(topic.predictedMentions)} mentions</div>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {factors.map((f) => (
            <div key={f.label}>
              <div className="mb-1 flex items-baseline justify-between text-[12px]">
                <span className="text-slate-400">{f.label}</span>
                <span className="font-mono font-semibold text-white">{f.display}</span>
              </div>
              <Meter value={f.value} color="#ffb02e" height={4} />
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

/* ================================================================== *
 * 3. Crisis detection — combination logic, spelled out.
 * ================================================================== */
export function CrisisPanel({ topic }) {
  const factors = crisisFactors(topic, topic.live)
  const band = riskBand(topic.crisis)
  return (
    <Card
      title="Early crisis detection"
      right={<Chip tone={band.tone}><ShieldAlert size={11} /> risk {band.label}</Chip>}
    >
      <div className="mb-3 rounded-lg border px-3 py-2 text-[12.5px] leading-relaxed"
        style={{ borderColor: `${band.color}44`, background: `${band.color}11`, color: '#cbd5e1' }}>
        <span className="font-semibold" style={{ color: band.color }}>Pattern matched: </span>
        sudden mention spike + negative sentiment velocity + high engagement + rapid geographic spread.
      </div>
      <div className="space-y-2">
        {factors.map((f) => (
          <div key={f.label} className="flex items-center gap-3">
            <span className="w-[184px] shrink-0 text-[12px] text-slate-400">{f.label}</span>
            <Meter value={f.value} color={f.value > 70 ? '#ff5d73' : f.value > 45 ? '#ffb02e' : '#6ea8ff'} height={5} />
            <span className="w-8 shrink-0 text-right font-mono text-[11.5px] text-slate-300">{Math.round(f.value)}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

/* ================================================================== *
 * 4. Misinformation risk — a score with its reasons attached.
 * ================================================================== */
export function MisinfoPanel({ topic }) {
  const band = riskBand(topic.misinfo)
  return (
    <Card title="Misinformation risk" right={<Chip tone={band.tone}>{topic.misinfo}/100 · {band.label}</Chip>}>
      <div className="mb-3 text-[12px] text-slate-500">
        A risk indicator, not a verdict. Each factor below is a contributing signal, weighted.
      </div>
      <div className="space-y-2.5">
        {topic.misinfoFactors.map((f) => (
          <div key={f.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="text-slate-300">{f.label}</span>
              <span className="font-mono text-[11.5px] text-slate-400">{f.weight}%</span>
            </div>
            <Meter value={f.weight * 2} color="#c77dff" height={4} />
          </div>
        ))}
      </div>
      {topic.coordination > 40 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-neg/40 bg-neg/10 px-3 py-2">
          <AlertTriangle size={14} className="mt-px shrink-0 text-neg" />
          <p className="text-[12px] leading-snug text-slate-300">
            <span className="font-semibold text-neg">Potentially coordinated: </span>
            {COORDINATION.top_cluster
              ? `${COORDINATION.top_cluster.account_count} accounts, ` +
                `${COORDINATION.top_cluster.narrative_overlap}% narrative overlap, ` +
                `posting inside a ${COORDINATION.top_cluster.window_seconds}-second window.`
              : 'no cluster above threshold in the current window.'}{' '}
            Flagged for human review — not automatically labelled as bots.
          </p>
        </div>
      )}
    </Card>
  )
}

/* ================================================================== *
 * 5. Insight Fusion Score — the signature composite.
 * ================================================================== */
export function FusionPanel({ topic }) {
  const { score, drivers } = fusionScore(topic, topic.live)
  const band = riskBand(score)
  return (
    <Card title="Insight fusion score" right={<Chip tone={band.tone}><Zap size={11} /> {band.label}</Chip>}>
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <ScoreRing value={score} color={band.color} label="fusion" size={124} />
        <div className="flex-1 space-y-1.5">
          <p className="mb-2 text-[12px] leading-snug text-slate-500">
            sentiment × emotion × topic × community × influence × time × spread
          </p>
          {drivers.map((d) => (
            <div key={d.key} className="flex items-center gap-2.5">
              <span className="w-[168px] shrink-0 truncate text-[12px] text-slate-400" title={d.key}>{d.key}</span>
              <Meter value={d.value} color={band.color} height={4} />
              <span className="w-11 shrink-0 text-right font-mono text-[11px] text-slate-500">×{d.weight.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

/* ================================================================== *
 * 6. Conversation DNA — the whole story on one strip.
 * ================================================================== */
function DnaRow({ label, value, display, color }) {
  const blocks = 10
  const filled = Math.round((value / 100) * blocks)
  return (
    <div className="flex items-center gap-3">
      <span className="w-[104px] shrink-0 text-[11.5px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className="flex gap-[3px]">
        {Array.from({ length: blocks }).map((_, i) => (
          <span
            key={i}
            className="h-3 w-[9px] rounded-[2px] transition-all duration-500"
            style={{ background: i < filled ? color : 'rgba(255,255,255,.07)', boxShadow: i < filled ? `0 0 6px ${color}55` : 'none' }}
          />
        ))}
      </span>
      <span className="ml-auto font-mono text-[12px] font-semibold text-white">{display}</span>
    </div>
  )
}

export function ConversationDNA({ topic }) {
  const topEmotion = Object.entries(topic.emotions).sort((a, b) => b[1] - a[1])[0]
  const platforms = new Set(topic.propagation.flatMap((p) => [p.from, p.to])).size
  const topInfluencer = topic.influencers
    .map((id) => ACCOUNTS.find((a) => a.id === id))
    .filter(Boolean)
    .sort((a, b) => influenceScore(b) - influenceScore(a))[0]

  const rows = [
    { label: 'Sentiment', value: topic.live.neg, display: `${Math.round(topic.live.neg)}% negative`, color: '#ff5d73' },
    { label: 'Emotion', value: topEmotion[1], display: `${topEmotion[0]} ${topEmotion[1]}`, color: '#ffb02e' },
    { label: 'Stance', value: topic.stance.oppose, display: `${topic.stance.oppose}% oppose`, color: '#c77dff' },
    { label: 'Sarcasm', value: topic.sarcasm, display: `${topic.sarcasm}%`, color: '#6ea8ff' },
    { label: 'Virality', value: topic.virality, display: `${topic.virality}%`, color: '#ff8a5b' },
    { label: 'Influence', value: topInfluencer ? influenceScore(topInfluencer) : 0, display: topInfluencer?.handle ?? '—', color: '#2fd4a7' },
    { label: 'Spread', value: (platforms / 5) * 100, display: `${platforms}/5 platforms`, color: '#9db4ff' },
    { label: 'Geography', value: (topic.geo[0].mentions / topic.mentions) * 100, display: `${topic.geo[0].place}-heavy`, color: '#2fd4a7' },
  ]

  return (
    <Card title="Conversation DNA" right={<Chip>{topic.tag}</Chip>}>
      <div className="space-y-2">
        {rows.map((r) => <DnaRow key={r.label} {...r} />)}
      </div>
    </Card>
  )
}

/* ================================================================== *
 * 7. Recommended action engine — analysis becomes a decision.
 * ================================================================== */
export function ActionEngine({ topic, compact = false }) {
  return (
    <Card
      title="Recommended actions"
      right={<Chip tone="pos">decision support</Chip>}
    >
      <div className="space-y-2">
        {topic.actions.slice(0, compact ? 2 : 99).map((a, i) => {
          const p = PRIORITY[a.p]
          return (
            <div key={i} className="rounded-lg border border-line bg-ink-700/40 p-3 transition hover:border-accent-dim/60">
              <div className="flex items-start gap-2.5">
                <span
                  className="mt-[3px] shrink-0 rounded px-1.5 py-px font-mono text-[9.5px] font-bold tracking-wider"
                  style={{ color: p.color, background: `${p.color}1e`, border: `1px solid ${p.color}44` }}
                >
                  {p.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium leading-snug text-slate-100">{a.text}</p>
                  <p className="mt-1 text-[11.5px] leading-snug text-slate-500">
                    <span className="text-slate-400">Why: </span>{a.why}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
        Recommendations are generated from the fusion score drivers. A human decides; the system explains.
      </p>
    </Card>
  )
}

/* ================================================================== *
 * 8. Forecast summary strip.
 * ================================================================== */
export function ForecastStrip({ topic }) {
  const eta = topic.peakEtaMin
  const items = [
    { k: 'Current', v: fmt(topic.live.mentions), s: 'mentions' },
    { k: 'Predicted', v: fmt(topic.predictedMentions), s: `in ${Math.round(eta / 60)}h` },
    { k: 'Expected sentiment', v: `${Math.round(Math.max(topic.predictedNeg, topic.live.neg + 3))}%`, s: 'negative' },
    { k: 'Growth', v: pct(topic.live.growth), s: 'vs. previous window' },
  ]
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.k} className="rounded-lg border border-line bg-ink-700/40 px-3 py-2">
          <div className="label">{i.k}</div>
          <div className="font-mono text-[17px] font-bold text-white">{i.v}</div>
          <div className="text-[10.5px] text-slate-500">{i.s}</div>
        </div>
      ))}
    </div>
  )
}

/* ================================================================== *
 * 9. Influence leaderboard — deliberately not sorted by followers.
 * ================================================================== */
export function InfluenceTable({ ids, limit = 6 }) {
  const rows = (ids ? COMPUTED_ACCOUNTS.filter((a) => ids.includes(a.id)) : COMPUTED_ACCOUNTS)
    .map((a) => ({ ...a, score: a.influence }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
  const maxFollowers = Math.max(...rows.map((r) => r.followers))

  return (
    <Card title="Influence score" right={<Chip><Users size={11} /> not follower count</Chip>}>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[10.5px] uppercase tracking-wider text-slate-500">
            <th className="pb-1.5 font-medium">Account</th>
            <th className="pb-1.5 text-right font-medium">Followers</th>
            <th className="pb-1.5 pl-3 text-right font-medium">Influence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line/70">
              <td className="py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-slate-200">{r.handle}</span>
                  {r.suspicious && <span title="Anomalous behaviour" className="text-neg">⚠</span>}
                </div>
              </td>
              <td className="py-1.5 text-right font-mono text-slate-500">
                {fmt(r.followers)}
                <span className="ml-1.5 inline-block h-1 w-6 rounded-full align-middle"
                  style={{ background: `linear-gradient(90deg,#38455f ${(r.followers / maxFollowers) * 100}%, transparent 0)` }} />
              </td>
              <td className="py-1.5 pl-3 text-right">
                <span className="font-mono font-bold" style={{ color: r.score > 80 ? '#2fd4a7' : r.score > 60 ? '#6ea8ff' : '#8b95b5' }}>
                  {r.score}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2.5 text-[11px] leading-relaxed text-slate-600">
        Influence is PageRank-weighted, computed by networkx over the interaction graph.
        The account with the most followers is rarely the one driving the conversation.
      </p>
    </Card>
  )
}
