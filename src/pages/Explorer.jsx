import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, FileText } from 'lucide-react'
import { useLive, useTopic } from '../store/LiveContext.jsx'
import { Card, Chip, SentimentBar } from '../components/ui.jsx'
import { EmotionRadar, SentimentTimeline, StanceSplit, VolumeForecast } from '../components/charts.jsx'
import {
  ActionEngine, ConversationDNA, CrisisPanel, ForecastStrip, FusionPanel,
  InfluenceTable, MisinfoPanel, ViralityPanel, WhyTrending,
} from '../components/insight.jsx'
import { GeoPanel, Propagation, SarcasmPanel } from '../components/panels.jsx'
import { EmotionTransitions, RelatedTopics } from '../components/narrative.jsx'
import TopicPicker from '../components/TopicPicker.jsx'
import LiveFeed from '../components/LiveFeed.jsx'
import { TOPICS } from '../data/seed.js'
import { fmt, pct } from '../data/engine.js'

export default function Explorer() {
  const { selectedTopic, setSelectedTopic } = useLive()
  const topic = useTopic(selectedTopic)
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-[1500px] space-y-3">
      {/* topic tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {TOPICS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedTopic(t.id)}
            className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition ${
              selectedTopic === t.id
                ? 'border-accent-dim bg-accent-dim/25 text-accent'
                : 'border-line bg-ink-800/70 text-slate-400 hover:border-accent-dim/50 hover:text-slate-200'
            }`}
          >
            {t.tag}
          </button>
        ))}
        <button className="btn ml-auto" onClick={() => navigate('/report')}>
          <FileText size={14} /> Generate report
        </button>
      </div>

      {/* topic header */}
      <Card>
        <div className="flex flex-wrap items-start gap-4 pt-3">
          <div className="min-w-[240px] flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-[21px] font-bold tracking-tight text-white">{topic.tag}</h2>
              <Chip>{topic.category}</Chip>
            </div>
            <p className="mt-0.5 text-[13px] text-slate-400">{topic.title}</p>
            <div className="mt-3 max-w-md">
              <SentimentBar
                pos={Math.round(topic.live.pos)}
                neu={Math.round(topic.live.neu)}
                neg={Math.round(topic.live.neg)}
                showLabels
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            {[
              ['Mentions', fmt(topic.live.mentions), '#ffffff'],
              ['Growth', pct(topic.live.growth), topic.live.growth > 90 ? '#ff5d73' : '#ffffff'],
              ['Virality', `${topic.virality}%`, '#ffb02e'],
              ['Crisis', `${topic.crisis}/100`, topic.crisis > 70 ? '#ff5d73' : '#6ea8ff'],
            ].map(([k, v, c]) => (
              <div key={k}>
                <div className="label">{k}</div>
                <div className="font-mono text-[20px] font-bold" style={{ color: c }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* signature row */}
      <div className="grid gap-3 lg:grid-cols-2">
        <WhyTrending topic={topic} />
        <ViralityPanel topic={topic} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <Card title="Mention volume & forecast" right={<Chip tone="warn">confidence band</Chip>}>
          <ForecastStrip topic={topic} />
          <div className="mt-2">
            <VolumeForecast topic={topic} height={214} />
          </div>
        </Card>
        <Card title="Sentiment over time">
          <SentimentTimeline topic={topic} height={258} />
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <CrisisPanel topic={topic} />
        <FusionPanel topic={topic} />
        <ConversationDNA topic={topic} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Propagation topic={topic} />
        <Card title="Emotion radar" right={<Chip tone="warn">vs. #MetroPhase3</Chip>}>
          <EmotionRadar topic={topic} compare={TOPICS.find((t) => t.id === 'metro')} height={260} />
        </Card>
        <Card title="Stance detection">
          <StanceSplit topic={topic} />
          <div className="mt-4 border-t border-line pt-3">
            <div className="label mb-1.5">Sarcasm prevalence</div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[22px] font-bold text-warn">{topic.sarcasm}%</span>
              <span className="text-[12px] text-slate-500">of posts flagged as ironic or sarcastic</span>
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500">
              Those posts are re-scored: surface sentiment is discarded in favour of resolved intent.
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <EmotionTransitions topic={topic} />
        <RelatedTopics topic={topic} onPick={setSelectedTopic} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <MisinfoPanel topic={topic} />
        <SarcasmPanel />
        <InfluenceTable ids={topic.influencers} />
      </div>

      <GeoPanel topic={topic} />

      <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
        <ActionEngine topic={topic} />
        <div className="space-y-3">
          <TopicPicker title="Switch topic" height={230} />
          <button className="btn btn-primary w-full" onClick={() => navigate('/network')}>
            Inspect the influence network <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <LiveFeed topicId={topic.id} title={`Annotated stream · ${topic.tag}`} height={300} />
    </div>
  )
}
