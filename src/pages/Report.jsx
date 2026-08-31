import React, { useMemo } from 'react'
import { Download, FileJson, FileSpreadsheet, Printer } from 'lucide-react'
import { useLive, useTopic } from '../store/LiveContext.jsx'
import { Card, Chip, ScoreRing, SentimentBar } from '../components/ui.jsx'
import { ActionEngine, ConversationDNA } from '../components/insight.jsx'
import { Propagation } from '../components/panels.jsx'
import { SentimentTimeline } from '../components/charts.jsx'
import { TOPICS, ACCOUNTS, influenceScore } from '../data/seed.js'
import { fmt, fusionScore, pct, riskBand } from '../data/engine.js'

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function Report() {
  const { selectedTopic, setSelectedTopic, alerts } = useLive()
  const topic = useTopic(selectedTopic)
  const fusion = fusionScore(topic, topic.live)
  const band = riskBand(fusion.score)

  const payload = useMemo(() => ({
    generated_at: new Date().toISOString(),
    topic: { id: topic.id, tag: topic.tag, title: topic.title, category: topic.category },
    volume: { mentions: Math.round(topic.live.mentions), growth_pct: Math.round(topic.live.growth), predicted_mentions: topic.predictedMentions, peak_eta_min: topic.peakEtaMin },
    sentiment: { positive: Math.round(topic.live.pos), neutral: Math.round(topic.live.neu), negative: Math.round(topic.live.neg), shift_pct: topic.live.shift },
    emotions: topic.emotions,
    stance: topic.stance,
    scores: { virality: topic.virality, crisis: topic.crisis, misinformation_risk: topic.misinfo, coordination: topic.coordination, insight_fusion: fusion.score, sarcasm_prevalence: topic.sarcasm },
    fusion_drivers: fusion.drivers,
    platforms: topic.platforms,
    propagation: topic.propagation,
    geography: topic.geo,
    influencers: topic.influencers.map((id) => {
      const a = ACCOUNTS.find((x) => x.id === id)
      return { handle: a.handle, followers: a.followers, influence_score: influenceScore(a), community: a.community, persona: a.persona }
    }),
    why_trending: topic.drivers,
    misinformation_factors: topic.misinfoFactors,
    recommended_actions: topic.actions,
    open_alerts: alerts.filter((a) => a.topicId === topic.id).map((a) => ({ severity: a.severity, title: a.title, confidence: a.confidence })),
    disclaimer: 'Synthetic demonstration data. Aggregated and k-anonymised; no personal identifiers included.',
  }), [topic, fusion, alerts])

  const csv = useMemo(() => {
    const rows = [
      ['metric', 'value'],
      ['topic', topic.tag],
      ['mentions', Math.round(topic.live.mentions)],
      ['growth_pct', Math.round(topic.live.growth)],
      ['sentiment_positive', Math.round(topic.live.pos)],
      ['sentiment_neutral', Math.round(topic.live.neu)],
      ['sentiment_negative', Math.round(topic.live.neg)],
      ['virality', topic.virality],
      ['crisis_score', topic.crisis],
      ['misinformation_risk', topic.misinfo],
      ['coordination_score', topic.coordination],
      ['insight_fusion', fusion.score],
      ['predicted_mentions', topic.predictedMentions],
      ['peak_eta_minutes', topic.peakEtaMin],
      ...Object.entries(topic.emotions).map(([k, v]) => [`emotion_${k}`, v]),
      ...Object.entries(topic.stance).map(([k, v]) => [`stance_${k}`, v]),
      ...Object.entries(topic.platforms).map(([k, v]) => [`platform_${k}`, v]),
      ...topic.geo.map((g) => [`geo_${g.place.replace(/\s+/g, '_')}_negative_pct`, g.neg]),
    ]
    return rows.map((r) => r.join(',')).join('\n')
  }, [topic, fusion])

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')

  return (
    <div className="mx-auto max-w-[1100px] space-y-3">
      {/* controls — hidden when printing */}
      <div className="flex flex-wrap items-center gap-1.5 print:hidden">
        {TOPICS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedTopic(t.id)}
            className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition ${
              selectedTopic === t.id ? 'border-accent-dim bg-accent-dim/25 text-accent' : 'border-line bg-ink-800/70 text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.tag}
          </button>
        ))}
        <div className="ml-auto flex gap-1.5">
          <button className="btn" onClick={() => download(`visionx-${topic.id}-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json')}>
            <FileJson size={14} /> JSON
          </button>
          <button className="btn" onClick={() => download(`visionx-${topic.id}-${stamp}.csv`, csv, 'text/csv')}>
            <FileSpreadsheet size={14} /> CSV
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={14} /> PDF
          </button>
        </div>
      </div>

      {/* the report itself */}
      <article className="card px-6 py-6">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-accent to-[#c77dff] text-[13px] font-bold text-ink-900">V</span>
              <span className="text-[13px] font-semibold tracking-tight text-white">VisionX intelligence brief</span>
            </div>
            <h2 className="mt-2 text-[22px] font-bold tracking-tight text-white">{topic.tag} — {topic.title}</h2>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              {topic.category} · generated {new Date().toLocaleString()} · synthetic corpus
            </p>
          </div>
          <div className="text-center">
            <ScoreRing value={fusion.score} color={band.color} label={band.label} size={104} />
            <div className="mt-1 text-[10.5px] text-slate-500">insight fusion score</div>
          </div>
        </header>

        {/* executive summary */}
        <section className="mt-4">
          <h3 className="card-t mb-1.5">Executive summary</h3>
          <p className="text-[13.5px] leading-relaxed text-slate-300">
            {topic.tag} is running at <b className="text-white">{fmt(topic.live.mentions)}</b> mentions,
            growing <b className="text-white">{pct(topic.live.growth)}</b> against the previous window, with{' '}
            <b style={{ color: '#ff5d73' }}>{Math.round(topic.live.neg)}% negative</b> sentiment
            ({pct(topic.live.shift)} shift). The dominant emotion is{' '}
            <b className="text-white">{Object.entries(topic.emotions).sort((a, b) => b[1] - a[1])[0][0]}</b>, and{' '}
            <b className="text-white">{topic.stance.oppose}%</b> of classified posts oppose the position at issue.
            The conversation originated on <b className="text-white">{topic.propagation[0].from}</b> and has
            crossed <b className="text-white">{new Set(topic.propagation.flatMap((p) => [p.from, p.to])).size}</b> platforms.
            Virality probability is <b className="text-white">{topic.virality}%</b> with a predicted peak of{' '}
            <b className="text-white">{fmt(topic.predictedMentions)}</b> mentions in roughly{' '}
            <b className="text-white">{Math.round(topic.peakEtaMin / 60)} hours</b>. Crisis risk is{' '}
            <b style={{ color: riskBand(topic.crisis).color }}>{riskBand(topic.crisis).label}</b> and
            misinformation risk sits at <b className="text-white">{topic.misinfo}/100</b>.
          </p>
        </section>

        {/* metric grid */}
        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Mentions', fmt(topic.live.mentions)],
            ['Growth', pct(topic.live.growth)],
            ['Virality', `${topic.virality}%`],
            ['Crisis', `${topic.crisis}/100`],
            ['Misinformation', `${topic.misinfo}/100`],
            ['Coordination', `${topic.coordination}/100`],
            ['Sarcasm', `${topic.sarcasm}%`],
            ['Predicted peak', fmt(topic.predictedMentions)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-line bg-ink-700/40 px-3 py-2">
              <div className="label">{k}</div>
              <div className="font-mono text-[18px] font-bold text-white">{v}</div>
            </div>
          ))}
        </section>

        <section className="mt-4">
          <h3 className="card-t mb-1.5">Sentiment</h3>
          <SentimentBar pos={Math.round(topic.live.pos)} neu={Math.round(topic.live.neu)} neg={Math.round(topic.live.neg)} showLabels />
          <div className="mt-2 rounded-lg border border-line bg-ink-900/40">
            <SentimentTimeline topic={topic} height={180} />
          </div>
        </section>

        <section className="mt-4">
          <h3 className="card-t mb-1.5">Why it is trending</h3>
          <ol className="space-y-1.5">
            {topic.drivers.map((d, i) => (
              <li key={i} className="flex gap-2.5 text-[13px] text-slate-300">
                <span className="font-mono text-slate-500">{d.at}</span>
                <span className="flex-1">{d.text}</span>
                <span className="font-mono text-slate-500">{d.weight}%</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-4">
          <h3 className="card-t mb-1.5">Fusion score drivers</h3>
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {fusion.drivers.map((d) => (
              <div key={d.key} className="flex items-baseline justify-between text-[12.5px]">
                <span className="text-slate-400">{d.key}</span>
                <span className="font-mono text-slate-200">{Math.round(d.value)} <span className="text-slate-600">× {d.weight.toFixed(2)}</span></span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4">
          <h3 className="card-t mb-1.5">Accounts driving the conversation</h3>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wider text-slate-500">
                <th className="pb-1 font-medium">Account</th>
                <th className="pb-1 text-right font-medium">Followers</th>
                <th className="pb-1 text-right font-medium">Influence</th>
                <th className="pb-1 pl-4 text-left font-medium">Persona</th>
              </tr>
            </thead>
            <tbody>
              {topic.influencers.map((id) => {
                const a = ACCOUNTS.find((x) => x.id === id)
                return (
                  <tr key={id} className="border-t border-line/70">
                    <td className="py-1 text-slate-200">{a.handle}</td>
                    <td className="py-1 text-right font-mono text-slate-500">{fmt(a.followers)}</td>
                    <td className="py-1 text-right font-mono font-semibold text-accent">{influenceScore(a)}</td>
                    <td className="py-1 pl-4 text-slate-400">{a.persona}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <ConversationDNA topic={topic} />
          <Propagation topic={topic} />
        </div>

        <div className="mt-3">
          <ActionEngine topic={topic} />
        </div>

        <footer className="mt-5 border-t border-line pt-3 text-[11px] leading-relaxed text-slate-600">
          Prepared by VisionX. Figures are model estimates on a synthetic corpus, not verified facts.
          Misinformation and coordination scores are risk indicators for human review, not determinations.
          Personal identifiers are stripped; location data is aggregated with k ≥ 20.
        </footer>
      </article>

      <div className="print:hidden">
        <Card title="Export formats">
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ['JSON', 'Full structured payload — every score, driver and factor.', () => download(`visionx-${topic.id}-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json')],
              ['CSV', 'Flat metric table for spreadsheets and BI tools.', () => download(`visionx-${topic.id}-${stamp}.csv`, csv, 'text/csv')],
              ['PDF', 'Print-ready brief via the browser print dialog.', () => window.print()],
            ].map(([k, d, fn]) => (
              <button key={k} onClick={fn} className="rounded-lg border border-line bg-ink-700/40 p-3 text-left transition hover:border-accent-dim/60">
                <div className="flex items-center gap-2">
                  <Download size={13} className="text-accent" />
                  <span className="text-[13px] font-semibold text-white">{k}</span>
                </div>
                <p className="mt-1 text-[11.5px] leading-snug text-slate-500">{d}</p>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
