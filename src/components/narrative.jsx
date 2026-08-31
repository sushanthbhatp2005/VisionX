import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, GitCompare, Pause, Play, RotateCcw, Share2, Waves } from 'lucide-react'
import { Card, Chip, Meter } from './ui.jsx'
import NetworkGraph from './NetworkGraph.jsx'
import { PHASES, PHASE_META, RELATION_META, cascadeFor, cascadeReach, relatedFor } from '../data/narrative.js'
import { ACCOUNTS, TOPICS, influenceScore } from '../data/seed.js'
import { fmt } from '../data/engine.js'

/* ================================================================== *
 * Emotion transitions: where the conversation has been, and what the
 * model expects it to do next.
 * ================================================================== */
export function EmotionTransitions({ topic }) {
  const p = PHASES[topic.id]
  if (!p) return null
  const current = PHASE_META[p.current]
  const next = PHASE_META[p.next.phase]
  const holding = p.next.phase === p.current

  return (
    <Card
      title="Emotion transitions"
      right={<Chip tone="warn"><Waves size={11} /> phase model</Chip>}
    >
      {/* the ladder */}
      <div className="flex flex-wrap items-center gap-1.5">
        {p.timeline.map((step, i) => {
          const meta = PHASE_META[step.phase]
          const isCurrent = step.phase === p.current
          return (
            <React.Fragment key={step.phase}>
              <div
                className="rounded-lg border px-2.5 py-1.5 transition"
                style={{
                  borderColor: isCurrent ? meta.color : '#1e2949',
                  background: isCurrent ? `${meta.color}1c` : 'rgba(255,255,255,.02)',
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
                  <span className="text-[12.5px] font-medium" style={{ color: isCurrent ? meta.color : '#cbd5e1' }}>
                    {meta.label}
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-[10.5px] text-slate-500">{step.at}</div>
              </div>
              {i < p.timeline.length - 1 && <ArrowRight size={12} className="shrink-0 text-slate-600" />}
            </React.Fragment>
          )
        })}
      </div>

      {/* how the conversation splits across phases right now */}
      <div className="mt-3.5">
        <div className="label mb-1.5">Conversation now sits in</div>
        <div className="flex h-2.5 overflow-hidden rounded-full">
          {p.timeline.map((step) => (
            <div
              key={step.phase}
              style={{ width: `${step.share}%`, background: PHASE_META[step.phase].color }}
              className="transition-all duration-700"
              title={`${PHASE_META[step.phase].label} ${step.share}%`}
            />
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
          {p.timeline.map((step) => (
            <span key={step.phase} className="text-[11px] text-slate-500">
              <span style={{ color: PHASE_META[step.phase].color }}>■</span> {PHASE_META[step.phase].label} {step.share}%
            </span>
          ))}
        </div>
      </div>

      {/* prediction */}
      <div
        className="mt-3.5 rounded-lg border px-3 py-2.5"
        style={{ borderColor: `${next.color}44`, background: `${next.color}0f` }}
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-[12px] text-slate-400">{holding ? 'Expected to hold at' : 'Next likely phase'}</span>
          <span className="text-[14px] font-semibold" style={{ color: next.color }}>{next.label}</span>
          <span className="font-mono text-[12px] text-white">{p.next.probability}%</span>
          <span className="text-[11.5px] text-slate-500">
            within ~{p.next.etaMin >= 60 ? `${Math.round(p.next.etaMin / 60)}h` : `${p.next.etaMin}m`}
          </span>
        </div>
        <p className="mt-1 text-[11.5px] leading-snug text-slate-400">{next.blurb}</p>
      </div>

      <p className="mt-2.5 text-[11.5px] leading-relaxed text-slate-500">{p.note}</p>
    </Card>
  )
}

/* ================================================================== *
 * Related topics: conversations do not stay in their own lane.
 * ================================================================== */
export function RelatedTopics({ topic, onPick }) {
  const related = useMemo(() => relatedFor(topic.id), [topic.id])
  if (!related.length) return null

  return (
    <Card title="Related conversations" right={<Chip><Share2 size={11} /> {related.length} linked</Chip>}>
      <div className="space-y-1.5">
        {related.map((r) => {
          const meta = RELATION_META[r.relation]
          return (
            <button
              key={r.id}
              onClick={() => onPick?.(r.id)}
              className="w-full rounded-lg border border-line bg-ink-700/40 px-3 py-2 text-left transition hover:border-accent-dim/60"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold text-white">{r.tag}</span>
                <span
                  className="rounded px-1.5 py-px text-[10px] font-medium"
                  style={{ color: meta.color, background: `${meta.color}18` }}
                >
                  {meta.label}
                </span>
                <span className="ml-auto font-mono text-[11.5px] text-slate-400">{r.strength}%</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Meter value={r.strength} color={meta.color} height={3} />
              </div>
              <p className="mt-1 text-[11px] leading-snug text-slate-500">{meta.blurb}</p>
            </button>
          )
        })}
      </div>
      <p className="mt-2.5 text-[11px] leading-relaxed text-slate-600">
        A merging pair should be briefed as one conversation. Treating them separately is how a
        response ends up contradicting itself.
      </p>
    </Card>
  )
}

/* ================================================================== *
 * Cascade replay: watch one post travel through the network.
 * ================================================================== */
export function CascadeReplay({ topic, height = 420 }) {
  const hops = useMemo(() => cascadeFor(topic.id), [topic.id])
  const maxAt = hops[hops.length - 1]?.at ?? 60
  const [t, setT] = useState(maxAt)
  const [playing, setPlaying] = useState(false)
  const raf = useRef(null)

  // restart the scrub whenever the topic changes
  useEffect(() => { setT(maxAt); setPlaying(false) }, [topic.id, maxAt])

  useEffect(() => {
    if (!playing) return
    const iv = setInterval(() => {
      setT((v) => {
        if (v >= maxAt) { setPlaying(false); return maxAt }
        return Math.min(maxAt, v + Math.max(1, Math.round(maxAt / 60)))
      })
    }, 90)
    raf.current = iv
    return () => clearInterval(iv)
  }, [playing, maxAt])

  const reach = useMemo(() => cascadeReach(hops, t), [hops, t])
  const seed = ACCOUNTS.find((a) => a.id === hops[0]?.id)
  const newest = [...hops].filter((h) => h.at <= t).slice(-3).reverse()

  const play = () => {
    if (t >= maxAt) setT(0)
    setPlaying(true)
  }

  return (
    <Card
      title="Cascade replay"
      right={<Chip tone="accent">seeded by {seed?.handle}</Chip>}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button className="btn" onClick={() => (playing ? setPlaying(false) : play())}>
          {playing ? <Pause size={13} /> : <Play size={13} />}
          {playing ? 'Pause' : 'Replay'}
        </button>
        <button className="btn" onClick={() => { setPlaying(false); setT(0) }} title="Back to the seed post">
          <RotateCcw size={13} />
        </button>
        <input
          type="range"
          min={0}
          max={maxAt}
          value={t}
          onChange={(e) => { setPlaying(false); setT(Number(e.target.value)) }}
          className="h-1 min-w-[120px] flex-1 cursor-pointer appearance-none rounded-full bg-ink-600 accent-[#6ea8ff]"
        />
        <span className="w-[62px] shrink-0 text-right font-mono text-[12px] text-slate-300">T+{t} min</span>
      </div>

      <div className="mb-2 grid grid-cols-3 gap-2">
        {[
          ['Accounts reached', `${reach.accounts}/${hops.length}`],
          ['Follower reach', fmt(reach.followers)],
          ['Hops deep', String(Math.max(0, ...hops.filter((h) => h.at <= t).map((h) => h.depth)))],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-line bg-ink-700/40 px-2.5 py-1.5">
            <div className="label">{k}</div>
            <div className="font-mono text-[15px] font-bold text-white">{v}</div>
          </div>
        ))}
      </div>

      <NetworkGraph reached={reach.ids} height={height} />

      {newest.length > 0 && (
        <div className="mt-1 space-y-1">
          {newest.map((h) => {
            const a = ACCOUNTS.find((x) => x.id === h.id)
            const parent = ACCOUNTS.find((x) => x.id === h.parent)
            return (
              <div key={h.id} className="flex items-center gap-2 text-[11.5px]">
                <span className="font-mono text-slate-500">T+{h.at}</span>
                <span className="text-slate-300">{a?.handle}</span>
                {parent && <span className="text-slate-600">via {parent.handle}</span>}
                <span className="ml-auto font-mono text-accent">influence {a ? influenceScore(a) : '—'}</span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

/* ================================================================== *
 * Side-by-side topic comparison.
 * ================================================================== */
const METRICS = [
  { key: 'mentions', label: 'Mentions', get: (t) => t.live.mentions, fmt: fmt, higherIsWorse: true },
  { key: 'growth', label: 'Growth %', get: (t) => Math.round(t.live.growth), fmt: (v) => `${v}%`, higherIsWorse: true },
  { key: 'neg', label: 'Negative %', get: (t) => Math.round(t.live.neg), fmt: (v) => `${v}%`, higherIsWorse: true },
  { key: 'virality', label: 'Virality', get: (t) => t.virality, fmt: (v) => `${v}%`, higherIsWorse: true },
  { key: 'crisis', label: 'Crisis', get: (t) => t.crisis, fmt: (v) => `${v}/100`, higherIsWorse: true },
  { key: 'misinfo', label: 'Misinformation', get: (t) => t.misinfo, fmt: (v) => `${v}/100`, higherIsWorse: true },
  { key: 'coordination', label: 'Coordination', get: (t) => t.coordination, fmt: (v) => `${v}/100`, higherIsWorse: true },
  { key: 'sarcasm', label: 'Sarcasm', get: (t) => t.sarcasm, fmt: (v) => `${v}%`, higherIsWorse: false },
  { key: 'oppose', label: 'Oppose %', get: (t) => t.stance.oppose, fmt: (v) => `${v}%`, higherIsWorse: true },
  { key: 'platforms', label: 'Platforms', get: (t) => new Set(t.propagation.flatMap((p) => [p.from, p.to])).size, fmt: (v) => `${v}/5`, higherIsWorse: true },
]

export function CompareTable({ a, b }) {
  return (
    <Card title="Metric comparison" right={<Chip tone="accent"><GitCompare size={11} /> side by side</Chip>}>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-[10.5px] uppercase tracking-wider text-slate-500">
            <th className="pb-2 text-left font-medium">Metric</th>
            <th className="pb-2 text-right font-medium">{a.tag}</th>
            <th className="pb-2 text-center font-medium"> </th>
            <th className="pb-2 text-left font-medium">{b.tag}</th>
          </tr>
        </thead>
        <tbody>
          {METRICS.map((m) => {
            const va = m.get(a)
            const vb = m.get(b)
            const max = Math.max(va, vb) || 1
            const aWorse = m.higherIsWorse ? va > vb : va < vb
            const equal = va === vb
            return (
              <tr key={m.key} className="border-t border-line/70">
                <td className="py-1.5 text-slate-400">{m.label}</td>
                <td className="py-1.5 pr-2 text-right">
                  <span className={`font-mono font-semibold ${equal ? 'text-slate-300' : aWorse ? 'text-neg' : 'text-slate-300'}`}>
                    {m.fmt(va)}
                  </span>
                </td>
                <td className="w-[92px] py-1.5">
                  <div className="flex items-center gap-[3px]">
                    <div className="flex h-1.5 flex-1 justify-end overflow-hidden rounded-l-full bg-white/5">
                      <div style={{ width: `${(va / max) * 100}%`, background: '#6ea8ff' }} />
                    </div>
                    <div className="flex h-1.5 flex-1 overflow-hidden rounded-r-full bg-white/5">
                      <div style={{ width: `${(vb / max) * 100}%`, background: '#c77dff' }} />
                    </div>
                  </div>
                </td>
                <td className="py-1.5 pl-2">
                  <span className={`font-mono font-semibold ${equal ? 'text-slate-300' : !aWorse ? 'text-neg' : 'text-slate-300'}`}>
                    {m.fmt(vb)}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2.5 text-[11px] leading-relaxed text-slate-600">
        Red marks the worse side on each row. Sarcasm is not scored as good or bad — it is a
        signal that surface sentiment is unreliable for that topic.
      </p>
    </Card>
  )
}

export function TopicSelect({ value, onChange, exclude, accent = '#6ea8ff', label }) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {TOPICS.filter((t) => t.id !== exclude).map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className="rounded-lg border px-2.5 py-1 text-[12px] font-medium transition"
            style={
              value === t.id
                ? { borderColor: accent, background: `${accent}22`, color: accent }
                : { borderColor: '#1e2949', background: 'rgba(255,255,255,.02)', color: '#94a3b8' }
            }
          >
            {t.tag}
          </button>
        ))}
      </div>
    </div>
  )
}
