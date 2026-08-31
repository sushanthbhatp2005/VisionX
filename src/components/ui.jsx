import React from 'react'

export function Card({ title, right, children, className = '', bodyClass = 'px-4 pb-4' }) {
  return (
    <section className={`card flex flex-col ${className}`}>
      {(title || right) && (
        <header className="card-h">
          <h3 className="card-t">{title}</h3>
          {right}
        </header>
      )}
      <div className={`flex-1 ${bodyClass}`}>{children}</div>
    </section>
  )
}

export function Chip({ children, tone = 'default', className = '' }) {
  const tones = {
    default: '',
    pos: 'border-pos/40 bg-pos/10 text-pos',
    neg: 'border-neg/40 bg-neg/10 text-neg',
    warn: 'border-warn/40 bg-warn/10 text-warn',
    accent: 'border-accent-dim/60 bg-accent-dim/15 text-accent',
  }
  return <span className={`chip ${tones[tone]} ${className}`}>{children}</span>
}

export function Delta({ value, suffix = '%' }) {
  const up = value > 0
  return (
    <span className={`font-mono text-[12px] font-semibold ${up ? 'text-neg' : 'text-pos'}`}>
      {up ? '▲' : '▼'} {Math.abs(Math.round(value))}{suffix}
    </span>
  )
}

export function Meter({ value, color = '#6ea8ff', height = 6, track = 'rgba(255,255,255,.07)' }) {
  return (
    <div className="w-full overflow-hidden rounded-full" style={{ height, background: track }}>
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: color, boxShadow: `0 0 12px ${color}55` }}
      />
    </div>
  )
}

export function ScoreRing({ value, size = 116, stroke = 9, color = '#ff5d73', label, sub }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c * (1 - Math.min(100, Math.max(0, value)) / 100)
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.4,0,.2,1)', filter: `drop-shadow(0 0 7px ${color}80)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[26px] font-bold leading-none text-white tabular-nums">{Math.round(value)}</span>
        {label && <span className="mt-1 text-[10px] font-semibold uppercase tracking-[.16em]" style={{ color }}>{label}</span>}
        {sub && <span className="mt-0.5 text-[10px] text-slate-500">{sub}</span>}
      </div>
    </div>
  )
}

export function KpiCard({ label, value, sub, delta, accent = '#6ea8ff', icon: Icon }) {
  return (
    <div className="card relative overflow-hidden px-4 py-3">
      <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      <div className="flex items-start justify-between">
        <span className="label">{label}</span>
        {Icon && <Icon size={15} style={{ color: accent }} />}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="stat">{value}</span>
        {delta !== undefined && <Delta value={delta} />}
      </div>
      {sub && <div className="mt-1 text-[11.5px] text-slate-500">{sub}</div>}
    </div>
  )
}

export function SentimentBar({ pos, neu, neg, height = 8, showLabels = false }) {
  return (
    <div>
      <div className="flex overflow-hidden rounded-full" style={{ height }}>
        <div style={{ width: `${pos}%`, background: '#2fd4a7' }} className="transition-all duration-700" />
        <div style={{ width: `${neu}%`, background: '#38455f' }} className="transition-all duration-700" />
        <div style={{ width: `${neg}%`, background: '#ff5d73' }} className="transition-all duration-700" />
      </div>
      {showLabels && (
        <div className="mt-1.5 flex justify-between font-mono text-[11px]">
          <span className="text-pos">{pos}% pos</span>
          <span className="text-slate-500">{neu}% neu</span>
          <span className="text-neg">{neg}% neg</span>
        </div>
      )}
    </div>
  )
}

export function Dot({ color, pulse = false }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      {pulse && <span className="absolute inline-flex h-full w-full rounded-full opacity-70 animate-pulseRing" style={{ background: color }} />}
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  )
}

export function ChartTip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line bg-ink-900/95 px-3 py-2 shadow-xl backdrop-blur">
      <div className="mb-1 font-mono text-[11px] text-slate-400">{label}</div>
      {payload.filter((p) => p.value !== null && p.value !== undefined).map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-[12px]">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color || p.stroke || p.fill }} />
          <span className="text-slate-400">{p.name}</span>
          <span className="ml-auto font-mono font-semibold text-white">
            {Array.isArray(p.value) ? `${p.value[0]}–${p.value[1]}` : p.value}{unit}
          </span>
        </div>
      ))}
    </div>
  )
}

export const SENT_COLORS = { pos: '#2fd4a7', neu: '#8b95b5', neg: '#ff5d73' }
export const PRIORITY = {
  critical: { color: '#ff5d73', label: 'CRITICAL' },
  high: { color: '#ffb02e', label: 'HIGH' },
  medium: { color: '#6ea8ff', label: 'MEDIUM' },
  low: { color: '#8b95b5', label: 'LOW' },
}
