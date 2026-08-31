import React, { useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { useLive, useTopic } from '../store/LiveContext.jsx'
import { Card, Chip, ScoreRing, SentimentBar } from '../components/ui.jsx'
import { EmotionRadar } from '../components/charts.jsx'
import { CompareTable, EmotionTransitions, TopicSelect } from '../components/narrative.jsx'
import { ActionEngine } from '../components/insight.jsx'
import { fusionScore, riskBand, fmt, pct } from '../data/engine.js'
import { PHASES, PHASE_META } from '../data/narrative.js'

function TopicHeader({ topic, accent }) {
  const fusion = fusionScore(topic, topic.live)
  const band = riskBand(fusion.score)
  const phase = PHASES[topic.id]
  const meta = phase ? PHASE_META[phase.current] : null

  return (
    <Card>
      <div className="flex items-start gap-4 pt-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[18px] font-bold tracking-tight" style={{ color: accent }}>{topic.tag}</h3>
            <Chip>{topic.category}</Chip>
          </div>
          <p className="mt-0.5 truncate text-[12.5px] text-slate-400">{topic.title}</p>

          <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {[
              ['Mentions', fmt(topic.live.mentions)],
              ['Growth', pct(topic.live.growth)],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="label">{k}</div>
                <div className="font-mono text-[16px] font-bold text-white">{v}</div>
              </div>
            ))}
          </div>

          <div className="mt-2.5">
            <SentimentBar
              pos={Math.round(topic.live.pos)}
              neu={Math.round(topic.live.neu)}
              neg={Math.round(topic.live.neg)}
              showLabels
            />
          </div>

          {meta && (
            <div className="mt-2.5 flex items-center gap-2">
              <span className="label">Phase</span>
              <span className="flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: meta.color }}>
                <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
                {meta.label}
              </span>
              <span className="ml-auto text-[11px] text-slate-500">
                next: {PHASE_META[phase.next.phase].label} {phase.next.probability}%
              </span>
            </div>
          )}
        </div>

        <div className="shrink-0 text-center">
          <ScoreRing value={fusion.score} color={band.color} label={band.label} size={96} />
          <div className="mt-1 text-[10px] text-slate-500">fusion score</div>
        </div>
      </div>
    </Card>
  )
}

export default function Compare() {
  const { selectedTopic } = useLive()
  const [leftId, setLeftId] = useState(selectedTopic)
  const [rightId, setRightId] = useState(selectedTopic === 'lang' ? 'traffic' : 'lang')
  const left = useTopic(leftId)
  const right = useTopic(rightId)

  const swap = () => { setLeftId(rightId); setRightId(leftId) }

  return (
    <div className="mx-auto max-w-[1500px] space-y-3">
      <Card>
        <div className="grid gap-4 pt-3 md:grid-cols-[1fr_auto_1fr]">
          <TopicSelect label="Left" value={leftId} onChange={setLeftId} exclude={rightId} accent="#6ea8ff" />
          <div className="flex items-end justify-center">
            <button className="btn" onClick={swap} title="Swap sides">
              <ArrowLeftRight size={14} />
            </button>
          </div>
          <TopicSelect label="Right" value={rightId} onChange={setRightId} exclude={leftId} accent="#c77dff" />
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <TopicHeader topic={left} accent="#6ea8ff" />
        <TopicHeader topic={right} accent="#c77dff" />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.15fr_1fr]">
        <CompareTable a={left} b={right} />
        <Card title="Emotion profile" right={<Chip tone="warn">overlaid</Chip>}>
          <EmotionRadar topic={left} compare={right} height={300} />
          <div className="mt-1 flex justify-center gap-4 text-[11.5px]">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="h-2 w-2 rounded-full bg-[#ff5d73]" /> {left.tag}
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="h-2 w-2 rounded-full bg-[#8b95b5]" /> {right.tag}
            </span>
          </div>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <EmotionTransitions topic={left} />
        <EmotionTransitions topic={right} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ActionEngine topic={left} />
        <ActionEngine topic={right} />
      </div>
    </div>
  )
}
