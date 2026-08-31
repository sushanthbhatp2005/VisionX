import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Activity, AlertTriangle, Brain, Globe2, Languages, MessageSquare,
  Network, Play, ShieldAlert, TrendingUp, Users,
} from 'lucide-react'
import { useLive } from '../store/LiveContext.jsx'
import { KpiCard, Card, Chip, SentimentBar, Dot } from '../components/ui.jsx'
import TopicPicker from '../components/TopicPicker.jsx'
import { fmt } from '../data/engine.js'
import { TOPICS } from '../data/seed.js'

const FEATURES = [
  { icon: Brain, title: 'Why is this trending?', body: 'The causal chain behind a spike — who seeded it, what merged, what amplified it — not just the count.', color: '#c77dff' },
  { icon: TrendingUp, title: 'Virality prediction', body: 'Probability, predicted peak size and time-to-peak, with a confidence band.', color: '#ffb02e' },
  { icon: ShieldAlert, title: 'Early crisis detection', body: 'Fires on a combination — spike + negative velocity + emotion + geographic concentration.', color: '#ff5d73' },
  { icon: Globe2, title: 'Cross-platform propagation', body: 'Tracks a topic as it moves between platforms, with delay, volume and sentiment drift per hop.', color: '#6ea8ff' },
  { icon: Users, title: 'Influence, not follower count', body: 'Reach × engagement × centrality × topic relevance × amplification.', color: '#2fd4a7' },
  { icon: Languages, title: 'Indic + code-mix', body: 'Hinglish and Kannada-English handled natively, with sarcasm resolved against surface sentiment.', color: '#9db4ff' },
]

export default function Overview() {
  const { totals, topics, alerts, setDemoStep } = useLive()
  const navigate = useNavigate()
  const hero = TOPICS[0]
  const heroLive = topics[hero.id]
  const topAlert = alerts[0]

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      {/* hero */}
      <section className="card relative overflow-hidden">
        <div className="absolute inset-0 grid-lines opacity-40" />
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative px-6 py-7">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="accent">Team VisionX</Chip>
            <Chip>Social Media Analytics</Chip>
            <span className="flex items-center gap-1.5 text-[11.5px] text-slate-500">
              <Dot color="#2fd4a7" pulse /> live prototype
            </span>
          </div>

          <h2 className="mt-3 max-w-3xl text-[26px] font-bold leading-tight tracking-tight text-white sm:text-[32px]">
            From millions of conversations to <span className="text-accent">one clear decision</span>.
          </h2>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-slate-400">
            VisionX does not stop at what people are saying. It explains why a conversation is happening,
            predicts where it is going, identifies who is driving it, and recommends what to investigate next.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button className="btn btn-primary" onClick={() => setDemoStep(0)}>
              <Play size={14} /> Run the guided incident demo
            </button>
            <button className="btn" onClick={() => navigate('/dashboard')}>
              Open live dashboard <ArrowRight size={14} />
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12px]">
            {['Collect', 'Analyse', 'Predict', 'Alert', 'Act'].map((s, i, arr) => (
              <React.Fragment key={s}>
                <span className="rounded-md border border-line bg-ink-700/60 px-2.5 py-1 font-medium text-slate-300">{s}</span>
                {i < arr.length - 1 && <ArrowRight size={12} className="text-slate-600" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Posts analysed" value={totals.processed.toLocaleString()} sub="rolling 24h window" icon={MessageSquare} />
        <KpiCard label="Active mentions" value={fmt(totals.mentions)} sub={`${totals.topics} tracked topics`} icon={Activity} accent="#c77dff" />
        <KpiCard label="Negative share" value={`${totals.neg}%`} sub={`${totals.pos}% positive · ${totals.neu}% neutral`} icon={TrendingUp} accent="#ff5d73" />
        <KpiCard label="Accounts mapped" value={totals.influencers} sub="5 communities detected" icon={Network} accent="#2fd4a7" />
        <KpiCard label="Open alerts" value={totals.alerts} sub={`${totals.unread} unread`} icon={AlertTriangle} accent="#ffb02e" />
      </section>

      <div className="grid gap-3 lg:grid-cols-[1.15fr_1fr]">
        <TopicPicker />

        <div className="space-y-3">
          {/* headline topic */}
          <Card title="Headline conversation" right={<Chip tone="neg">crisis {hero.crisis}/100</Chip>}>
            <div className="flex items-baseline gap-2">
              <span className="text-[19px] font-bold text-white">{hero.tag}</span>
              <span className="text-[12.5px] text-slate-500">{hero.title}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                ['Mentions', fmt(heroLive.mentions)],
                ['Virality', `${hero.virality}%`],
                ['Peak in', `~${Math.round(hero.peakEtaMin / 60)}h`],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="label">{k}</div>
                  <div className="font-mono text-[19px] font-bold text-white">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <SentimentBar
                pos={Math.round(heroLive.pos)}
                neu={Math.round(heroLive.neu)}
                neg={Math.round(heroLive.neg)}
                showLabels
              />
            </div>
            <button className="btn mt-3 w-full" onClick={() => navigate('/explorer')}>
              Investigate <ArrowRight size={14} />
            </button>
          </Card>

          {/* latest alert */}
          {topAlert && (
            <Card title="Latest alert" right={<Chip tone="neg">{topAlert.severity}</Chip>}>
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={16} className="mt-px shrink-0 text-neg" />
                <div>
                  <p className="text-[13.5px] font-semibold text-white">{topAlert.title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-slate-400">{topAlert.body}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {topAlert.metrics.map(([k, v]) => (
                      <Chip key={k}>{k}: <span className="text-white">{v}</span></Chip>
                    ))}
                    <Chip tone="accent">confidence {topAlert.confidence}%</Chip>
                  </div>
                </div>
              </div>
              <button className="btn mt-3 w-full" onClick={() => navigate('/alerts')}>
                Open the alert board <ArrowRight size={14} />
              </button>
            </Card>
          )}
        </div>
      </div>

      {/* differentiators */}
      <section>
        <h3 className="card-t mb-2 px-1">What makes this different</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card px-4 py-3.5 transition hover:border-accent-dim/60">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${f.color}1a`, color: f.color }}>
                  <f.icon size={16} />
                </span>
                <h4 className="text-[13.5px] font-semibold text-white">{f.title}</h4>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
