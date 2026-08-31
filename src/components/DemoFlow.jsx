import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useLive } from '../store/LiveContext.jsx'

/* The guided incident walkthrough: one click per stage of the pipeline,
   ending on a decision rather than a chart. */
const STEPS = [
  {
    title: 'Select the topic',
    body: 'Pick #TrafficBengaluru from the topic explorer. Everything below is computed for that one conversation.',
    route: '/explorer',
    run: (a) => a.setSelectedTopic('traffic'),
  },
  {
    title: 'A spike is detected',
    body: 'Mention volume breaks out of its baseline. Growth passes the velocity threshold and the forecast band widens.',
    route: '/explorer',
    run: (a) => a.escalate('traffic', 0.4),
  },
  {
    title: 'Sentiment turns negative',
    body: 'The negative share climbs sharply. This is the point a simple keyword dashboard would still say "high volume, no context".',
    route: '/explorer',
    run: (a) => { a.escalate('traffic', 0.7); a.raise('traffic', 'sentiment') },
  },
  {
    title: 'Emotion resolves to anger',
    body: 'Eight-emotion classification separates anger from fear. Anger plus rising volume behaves very differently from fear plus rising volume.',
    route: '/explorer',
  },
  {
    title: 'The network names the drivers',
    body: 'PageRank and Louvain identify who is actually carrying the conversation. Note the highest influence score is not the largest account.',
    route: '/network',
  },
  {
    title: 'It crosses platforms',
    body: 'Reddit to X in 32 minutes, X to YouTube in 18, YouTube to Instagram in 41 — with sentiment degrading at each hop.',
    route: '/explorer',
  },
  {
    title: 'Virality is predicted at 87%',
    body: 'The forecast layer projects the peak: ~72k mentions, roughly four hours out, with a confidence band.',
    route: '/explorer',
    run: (a) => a.raise('traffic', 'virality'),
  },
  {
    title: 'Crisis risk goes HIGH',
    body: 'Spike + negative velocity + emotion intensity + geographic concentration + cross-platform spread fire together. One alert, not five.',
    route: '/alerts',
    run: (a) => { a.escalate('traffic', 0.95); a.raise('traffic', 'crisis') },
  },
  {
    title: 'The system explains why',
    body: 'The causal chain is shown, not just the score: who seeded it, where it migrated, what merged, what amplified it.',
    route: '/explorer',
  },
  {
    title: 'And says what to do next',
    body: 'Analysis becomes a decision: four ranked actions, each with the evidence that produced it. A human still decides.',
    route: '/report',
  },
]

export default function DemoFlow() {
  const live = useLive()
  const { demoStep, setDemoStep } = live
  const navigate = useNavigate()
  const step = STEPS[demoStep]

  useEffect(() => {
    if (demoStep < 0 || !step) return
    if (step.route) navigate(step.route)
    step.run?.(live)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoStep])

  if (demoStep < 0 || !step) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 sm:px-6">
      <div className="pointer-events-auto w-full max-w-[640px] rounded-xl border border-accent-dim/60 bg-ink-800/95 shadow-2xl shadow-black/60 backdrop-blur-md">
        <div className="h-[3px] overflow-hidden rounded-t-xl bg-ink-600">
          <div
            className="h-full bg-gradient-to-r from-accent to-[#c77dff] transition-all duration-500"
            style={{ width: `${((demoStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="flex items-start gap-3 px-4 py-3">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent-dim/25 font-mono text-[13px] font-bold text-accent">
            {demoStep + 1}
          </span>
          <div className="min-w-0 flex-1">
            <h4 className="text-[14px] font-semibold text-white">{step.title}</h4>
            <p className="mt-0.5 text-[12.5px] leading-snug text-slate-400">{step.body}</p>
          </div>
          <button onClick={() => setDemoStep(-1)} className="shrink-0 rounded p-1 text-slate-500 hover:text-slate-200" title="Exit walkthrough">
            <X size={15} />
          </button>
        </div>

        <div className="flex items-center gap-2 border-t border-line px-4 py-2">
          <span className="font-mono text-[11px] text-slate-500">
            step {demoStep + 1} / {STEPS.length}
          </span>
          <div className="ml-auto flex gap-1.5">
            <button className="btn" disabled={demoStep === 0} onClick={() => setDemoStep(demoStep - 1)}>
              <ChevronLeft size={14} /> Back
            </button>
            {demoStep < STEPS.length - 1 ? (
              <button className="btn btn-primary" onClick={() => setDemoStep(demoStep + 1)}>
                Next <ChevronRight size={14} />
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => setDemoStep(-1)}>
                Finish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
