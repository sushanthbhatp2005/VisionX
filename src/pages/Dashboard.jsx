import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, ArrowRight, BarChart3, MessageSquare, TrendingUp, Users } from 'lucide-react'
import { useLive, useTopic } from '../store/LiveContext.jsx'
import { Card, Chip, KpiCard, SentimentBar } from '../components/ui.jsx'
import { EmotionRadar, PlatformBars, SentimentTimeline, StanceSplit, VolumeForecast } from '../components/charts.jsx'
import { ForecastStrip } from '../components/insight.jsx'
import { GeoPanel, LanguagePanel } from '../components/panels.jsx'
import TopicPicker from '../components/TopicPicker.jsx'
import LiveFeed from '../components/LiveFeed.jsx'
import { fmt, pct } from '../data/engine.js'

export default function Dashboard() {
  const { selectedTopic, totals } = useLive()
  const topic = useTopic(selectedTopic)
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-[1500px] space-y-3">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Posts analysed" value={totals.processed.toLocaleString()} sub="rolling 24h" icon={MessageSquare} />
        <KpiCard label={`${topic.tag} mentions`} value={fmt(topic.live.mentions)} delta={topic.live.growth} sub="live" icon={Activity} accent="#c77dff" />
        <KpiCard label="Negative share" value={`${Math.round(topic.live.neg)}%`} sub={`shift ${pct(topic.live.shift)} over the window`} icon={TrendingUp} accent="#ff5d73" />
        <KpiCard label="Virality" value={`${topic.virality}%`} sub={`peak in ~${Math.round(topic.peakEtaMin / 60)}h`} icon={BarChart3} accent="#ffb02e" />
        <KpiCard label="Accounts driving" value={topic.influencers.length} sub="above influence 70" icon={Users} accent="#2fd4a7" />
      </section>

      <div className="grid gap-3 xl:grid-cols-[1fr_330px]">
        <div className="space-y-3">
          <Card
            title={`Mention volume & forecast · ${topic.tag}`}
            right={<Chip tone="warn">Prophet + BERTopic</Chip>}
          >
            <ForecastStrip topic={topic} />
            <div className="mt-2">
              <VolumeForecast topic={topic} />
            </div>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card title="Sentiment over time" right={<Chip tone={topic.live.neg > 55 ? 'neg' : 'accent'}>{Math.round(topic.live.neg)}% negative</Chip>}>
              <SentimentTimeline topic={topic} />
              <div className="mt-2">
                <SentimentBar pos={Math.round(topic.live.pos)} neu={Math.round(topic.live.neu)} neg={Math.round(topic.live.neg)} showLabels />
              </div>
            </Card>

            <Card title="Emotion distribution" right={<Chip tone="warn">8-class</Chip>}>
              <EmotionRadar topic={topic} />
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card title="Platform comparison" right={<Chip>{fmt(Object.values(topic.platforms).reduce((a, b) => a + b, 0))} posts</Chip>}>
              <PlatformBars topic={topic} />
            </Card>

            <Card title="Stance detection" right={<Chip tone="accent">support / oppose</Chip>}>
              <StanceSplit topic={topic} />
              <p className="mt-3 text-[11.5px] leading-relaxed text-slate-500">
                Stance is tracked separately from sentiment: a post can be negative in tone while supporting
                the underlying position, and the two diverge most on policy topics.
              </p>
            </Card>
          </div>

          <GeoPanel topic={topic} />
        </div>

        <div className="space-y-3">
          <TopicPicker height={272} />
          <LiveFeed height={396} />
          <LanguagePanel />
          <button className="btn btn-primary w-full" onClick={() => navigate('/explorer')}>
            Full breakdown for {topic.tag} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
