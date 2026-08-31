import React, { useMemo } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line,
  PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { ChartTip } from './ui.jsx'
import { EMOTIONS, PLATFORMS } from '../data/seed.js'
import { mergeSeries, fmt } from '../data/engine.js'

const axis = { stroke: '#3b4766', fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace', tickLine: false }

/* ------------------------------------------------------------------ *
 * Mention volume: history + Prophet-style forecast with a 90% band.
 * ------------------------------------------------------------------ */
export function VolumeForecast({ topic, height = 250 }) {
  const data = useMemo(() => mergeSeries(topic.live.history, topic.live.forecast), [topic.live])
  const boundary = topic.live.history[topic.live.history.length - 1].t
  const peak = topic.live.forecast.find((p) => p.isPeak)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gVol" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6ea8ff" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#6ea8ff" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#1a2440" vertical={false} />
        <XAxis dataKey="t" {...axis} interval={7} />
        <YAxis {...axis} tickFormatter={fmt} width={44} />
        <Tooltip content={<ChartTip />} />
        <Area name="Forecast band" dataKey="band" stroke="none" fill="#ffb02e" fillOpacity={0.13} isAnimationActive={false} />
        <Area name="Mentions" dataKey="mentions" stroke="#6ea8ff" strokeWidth={2} fill="url(#gVol)" isAnimationActive={false} />
        <Line name="Predicted" dataKey="forecast" stroke="#ffb02e" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
        <ReferenceLine x={boundary} stroke="#8b95b5" strokeDasharray="3 3"
          label={{ value: 'now', fill: '#8b95b5', fontSize: 10, position: 'insideTopRight' }} />
        {peak && (
          <ReferenceLine x={peak.t} stroke="#ff5d73" strokeDasharray="2 3"
            label={{ value: 'predicted peak', fill: '#ff5d73', fontSize: 10, position: 'insideTopLeft' }} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/* ------------------------------------------------------------------ *
 * Sentiment over time, stacked to 100%.
 * ------------------------------------------------------------------ */
export function SentimentTimeline({ topic, height = 210 }) {
  const data = topic.live.history
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: 0 }} stackOffset="expand">
        <CartesianGrid stroke="#1a2440" vertical={false} />
        <XAxis dataKey="t" {...axis} interval={7} />
        <YAxis {...axis} width={42} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
        <Tooltip content={<ChartTip unit="%" />} />
        <Area name="Positive" dataKey="pos" stackId="1" stroke="#2fd4a7" fill="#2fd4a7" fillOpacity={0.5} isAnimationActive={false} />
        <Area name="Neutral" dataKey="neu" stackId="1" stroke="#5b6b8f" fill="#38455f" fillOpacity={0.5} isAnimationActive={false} />
        <Area name="Negative" dataKey="neg" stackId="1" stroke="#ff5d73" fill="#ff5d73" fillOpacity={0.55} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ------------------------------------------------------------------ *
 * Emotion radar (8 emotions).
 * ------------------------------------------------------------------ */
export function EmotionRadar({ topic, height = 250, compare }) {
  const data = EMOTIONS.map((e) => ({
    emotion: e[0].toUpperCase() + e.slice(1),
    value: topic.emotions[e],
    ...(compare ? { compare: compare.emotions[e] } : {}),
  }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#22304f" />
        <PolarAngleAxis dataKey="emotion" tick={{ fill: '#8b95b5', fontSize: 10.5 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Tooltip content={<ChartTip />} />
        {compare && <Radar name={compare.tag} dataKey="compare" stroke="#8b95b5" fill="#8b95b5" fillOpacity={0.12} isAnimationActive={false} />}
        <Radar name="Intensity" dataKey="value" stroke="#ff5d73" fill="#ff5d73" fillOpacity={0.35} isAnimationActive={false} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

/* ------------------------------------------------------------------ *
 * Platform comparison.
 * ------------------------------------------------------------------ */
export function PlatformBars({ topic, height = 200 }) {
  const data = PLATFORMS.map((p) => ({ name: p.name, mentions: topic.platforms[p.id], color: p.color }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="#1a2440" vertical={false} />
        <XAxis dataKey="name" {...axis} />
        <YAxis {...axis} tickFormatter={fmt} width={44} />
        <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,.03)' }} />
        <Bar name="Mentions" dataKey="mentions" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((d) => <Cell key={d.name} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ------------------------------------------------------------------ *
 * Stance split.
 * ------------------------------------------------------------------ */
const STANCE = [
  { key: 'support', label: 'Support', color: '#2fd4a7', icon: '▲' },
  { key: 'oppose', label: 'Oppose', color: '#ff5d73', icon: '▼' },
  { key: 'neutral', label: 'Neutral', color: '#8b95b5', icon: '■' },
  { key: 'unclear', label: 'Unclear', color: '#c77dff', icon: '?' },
]

export function StanceSplit({ topic }) {
  return (
    <div className="space-y-2.5">
      <div className="flex h-2.5 overflow-hidden rounded-full">
        {STANCE.map((s) => (
          <div key={s.key} style={{ width: `${topic.stance[s.key]}%`, background: s.color }} className="transition-all duration-700" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {STANCE.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-[12px]">
            <span style={{ color: s.color }}>{s.icon}</span>
            <span className="text-slate-400">{s.label}</span>
            <span className="ml-auto font-mono font-semibold text-white">{topic.stance[s.key]}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Small sparkline used inside topic rows.
 * ------------------------------------------------------------------ */
export function Spark({ data, color = '#6ea8ff', height = 30 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`sp${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area dataKey="mentions" stroke={color} strokeWidth={1.5} fill={`url(#sp${color.slice(1)})`} isAnimationActive={false} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
