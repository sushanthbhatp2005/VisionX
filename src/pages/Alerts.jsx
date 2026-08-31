import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bell, BellOff, FileText, Search, Zap } from 'lucide-react'
import { useLive } from '../store/LiveContext.jsx'
import { Card, Chip, Meter } from '../components/ui.jsx'
import { ActionEngine } from '../components/insight.jsx'
import { SEVERITY } from '../data/engine.js'
import { TOPICS } from '../data/seed.js'

const RULES = [
  { name: 'Emerging negative sentiment', cond: 'negative share ↑ 25% within 60 min AND volume ↑ 50%', fires: 'sentiment' },
  { name: 'Virality threshold', cond: 'virality probability ≥ 70% AND influencer involvement high', fires: 'virality' },
  { name: 'Crisis composite', cond: 'spike + negative velocity + emotion intensity + geographic concentration', fires: 'crisis' },
  { name: 'Coordinated activity', cond: '≥ 20 accounts, ≥ 75% narrative overlap, ≤ 120s posting window', fires: 'coordination' },
  { name: 'Misinformation risk', cond: 'unverified claim + rapid propagation + low-credibility sources', fires: 'misinfo' },
]

export default function Alerts() {
  const { alerts, markAlertsRead, setSelectedTopic, raise, escalate } = useLive()
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(markAlertsRead, 900)
    return () => clearTimeout(t)
  }, [markAlertsRead])

  const investigate = (topicId) => {
    setSelectedTopic(topicId)
    navigate('/explorer')
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-3">
      <div className="grid gap-3 xl:grid-cols-[1fr_330px]">
        <div className="space-y-3">
          {alerts.length === 0 && (
            <Card>
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <BellOff size={26} className="text-slate-600" />
                <p className="text-[13px] text-slate-500">No open alerts. Trigger one from the simulator to see the flow.</p>
              </div>
            </Card>
          )}

          {alerts.map((a) => {
            const sev = SEVERITY[a.severity]
            return (
              <article
                key={a.id}
                className="card animate-slideIn relative overflow-hidden px-4 py-3.5"
                style={{ borderColor: `${sev.color}55` }}
              >
                <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: sev.color }} />
                <div className="flex flex-wrap items-start gap-3">
                  <span
                    className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                    style={{ background: `${sev.color}18`, color: sev.color }}
                  >
                    <AlertTriangle size={17} />
                  </span>

                  <div className="min-w-[230px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14.5px] font-semibold text-white">{a.title}</h3>
                      <span
                        className="rounded px-1.5 py-px font-mono text-[9.5px] font-bold uppercase tracking-wider"
                        style={{ color: sev.color, background: `${sev.color}1c`, border: `1px solid ${sev.color}44` }}
                      >
                        {sev.label}
                      </span>
                      <Chip>{a.tag}</Chip>
                      {!a.read && <span className="h-1.5 w-1.5 rounded-full bg-accent" title="unread" />}
                    </div>
                    <p className="mt-1 text-[13px] leading-snug text-slate-400">{a.body}</p>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {a.metrics.map(([k, v]) => (
                        <Chip key={k}>{k}: <span className="text-white">{v}</span></Chip>
                      ))}
                    </div>

                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="label">Confidence</span>
                      <div className="w-28"><Meter value={a.confidence} color={sev.color} height={4} /></div>
                      <span className="font-mono text-[11.5px] text-slate-300">{a.confidence}%</span>
                      <span className="ml-auto font-mono text-[11px] text-slate-600">
                        {new Date(a.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-1.5">
                    <button className="btn btn-primary" onClick={() => investigate(a.topicId)}>
                      <Search size={13} /> Investigate
                    </button>
                    <button className="btn" onClick={() => { setSelectedTopic(a.topicId); navigate('/report') }}>
                      <FileText size={13} /> Report
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        <div className="space-y-3">
          <Card title="Alert simulator" right={<Chip tone="accent"><Zap size={11} /> demo control</Chip>}>
            <p className="mb-2.5 text-[12px] leading-relaxed text-slate-400">
              In deployment these fire from the streaming rules below. Here you can trigger them by hand.
            </p>
            <div className="space-y-1.5">
              {RULES.map((r) => (
                <button
                  key={r.fires}
                  onClick={() => { escalate('traffic', 0.8); raise('traffic', r.fires) }}
                  className="w-full rounded-lg border border-line bg-ink-700/40 px-3 py-2 text-left transition hover:border-accent-dim/60"
                >
                  <div className="flex items-center gap-2">
                    <Bell size={12} className="text-accent" />
                    <span className="text-[12.5px] font-medium text-slate-200">{r.name}</span>
                  </div>
                  <p className="mt-0.5 font-mono text-[10.5px] leading-snug text-slate-500">{r.cond}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card title="Topics being watched">
            <div className="space-y-1.5">
              {TOPICS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => investigate(t.id)}
                  className="flex w-full items-center gap-2 rounded-lg border border-line bg-ink-700/40 px-2.5 py-1.5 text-left transition hover:border-accent-dim/60"
                >
                  <span className="text-[12.5px] text-slate-200">{t.tag}</span>
                  <span className="ml-auto font-mono text-[11px]" style={{ color: t.crisis > 70 ? '#ff5d73' : t.crisis > 45 ? '#ffb02e' : '#8b95b5' }}>
                    crisis {t.crisis}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {alerts[0] && <ActionEngine topic={TOPICS.find((t) => t.id === alerts[0].topicId)} />}
    </div>
  )
}
