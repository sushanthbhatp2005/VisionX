import React from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import {
  Activity, Radar, Network, Bell, FileText, LayoutDashboard, Pause, Play,
  RotateCcw, Gauge, Wand2, GitCompare, Cloud, CloudOff,
} from 'lucide-react'
import { useLive } from './store/LiveContext.jsx'
import { Dot } from './components/ui.jsx'
import DemoFlow from './components/DemoFlow.jsx'
import Overview from './pages/Overview.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Explorer from './pages/Explorer.jsx'
import NetworkPage from './pages/NetworkPage.jsx'
import Alerts from './pages/Alerts.jsx'
import Report from './pages/Report.jsx'
import Compare from './pages/Compare.jsx'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard', label: 'Live analytics', icon: Activity },
  { to: '/explorer', label: 'Topic explorer', icon: Radar },
  { to: '/network', label: 'Influence network', icon: Network },
  { to: '/compare', label: 'Compare topics', icon: GitCompare },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/report', label: 'Reports', icon: FileText },
]

function Sidebar() {
  const { totals } = useLive()
  return (
    <aside className="hidden w-[218px] shrink-0 flex-col border-r border-line bg-ink-800/50 lg:flex">
      <div className="flex items-center gap-2.5 px-5 py-4">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-[#c77dff] font-bold text-ink-900">V</div>
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight text-white">VisionX</div>
          <div className="text-[10px] uppercase tracking-[.18em] text-slate-500">Social intelligence</div>
        </div>
      </div>

      <nav className="mt-1 flex flex-col gap-0.5 px-2.5">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                isActive ? 'bg-accent-dim/20 text-white' : 'text-slate-400 hover:bg-white/[.04] hover:text-slate-200'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r bg-accent" />}
                <Icon size={15.5} />
                {label}
                {to === '/alerts' && totals.unread > 0 && (
                  <span className="ml-auto rounded-full bg-neg px-1.5 py-px font-mono text-[10px] font-bold text-white">
                    {totals.unread}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-3 p-4">
        <div className="rounded-lg border border-line bg-ink-700/50 p-3">
          <div className="label mb-1.5">Pipeline</div>
          {['Collect', 'Analyse', 'Predict', 'Alert', 'Act'].map((s, i) => (
            <div key={s} className="flex items-center gap-2 py-[3px] text-[11.5px] text-slate-400">
              <Dot color={['#6ea8ff', '#c77dff', '#ffb02e', '#ff5d73', '#2fd4a7'][i]} pulse={i === 0} />
              {s}
            </div>
          ))}
        </div>
        <p className="px-1 text-[10.5px] leading-relaxed text-slate-600">
          Prototype running on a synthetic corpus. All accounts and posts are fictional.
        </p>
      </div>
    </aside>
  )
}

// Says plainly where the data is coming from. 'offline' is not an error
// state -- the dashboard simulates locally and keeps working.
function ConnectionPill({ connection }) {
  const map = {
    live: {
      icon: Cloud, color: '#2fd4a7', label: 'LIVE',
      sub: 'FastAPI backend', title: 'Connected to the FastAPI backend over WebSocket',
    },
    connecting: {
      icon: Cloud, color: '#6ea8ff', label: 'CONNECTING',
      sub: 'probing backend', title: 'Looking for the backend',
    },
    offline: {
      icon: CloudOff, color: '#8b95b5', label: 'SIMULATED',
      sub: 'backend offline', title: 'No backend reachable — running the in-browser simulation',
    },
  }
  const s = map[connection] ?? map.offline
  const Icon = s.icon
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1"
      style={{ borderColor: `${s.color}55`, background: `${s.color}12` }}
      title={s.title}
    >
      <Icon size={13} style={{ color: s.color }} />
      <span className="font-mono text-[11.5px] font-semibold" style={{ color: s.color }}>{s.label}</span>
      <span className="hidden font-mono text-[11px] text-slate-500 sm:inline">· {s.sub}</span>
    </div>
  )
}

function Topbar() {
  const { running, setRunning, speed, setSpeed, reset, totals, demoStep, setDemoStep, connection } = useLive()
  const { pathname } = useLocation()
  const title = NAV.find((n) => (n.end ? n.to === pathname : pathname.startsWith(n.to)))?.label ?? 'Overview'

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-line bg-ink-900/85 px-4 py-2.5 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-2.5">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-accent to-[#c77dff] text-[13px] font-bold text-ink-900 lg:hidden">V</div>
        <h1 className="text-[15px] font-semibold tracking-tight text-white">{title}</h1>
      </div>

      <div className="flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-2.5 py-1">
        <Dot color={running ? '#2fd4a7' : '#8b95b5'} pulse={running} />
        <span className="font-mono text-[11.5px] text-slate-400">
          {running ? 'STREAMING' : 'PAUSED'} · {totals.processed.toLocaleString()} posts
        </span>
      </div>

      <ConnectionPill connection={connection} />

      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={() => setDemoStep(demoStep >= 0 ? -1 : 0)}
          className={`btn ${demoStep >= 0 ? 'btn-danger' : 'btn-primary'}`}
          title="Run the guided incident walkthrough"
        >
          <Wand2 size={14} />
          <span className="hidden sm:inline">{demoStep >= 0 ? 'Exit walkthrough' : 'Guided demo'}</span>
        </button>
        <button onClick={() => setRunning(!running)} className="btn" title={running ? 'Pause stream' : 'Resume stream'}>
          {running ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button
          onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 4 : 1)}
          className="btn font-mono"
          title="Stream speed"
        >
          <Gauge size={14} />{speed}x
        </button>
        <button onClick={reset} className="btn" title="Reset demo state">
          <RotateCcw size={14} />
        </button>
      </div>
    </header>
  )
}

export default function App() {
  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/explorer" element={<Explorer />} />
            <Route path="/network" element={<NetworkPage />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/report" element={<Report />} />
          </Routes>
          <footer className="mx-auto mt-8 max-w-[1500px] border-t border-line pt-4 text-[11px] text-slate-600">
            VisionX prototype · synthetic data · pipeline mirrors the proposed FastAPI + WebSocket + TimescaleDB / Neo4j / Qdrant architecture.
          </footer>
        </main>
      </div>
      <DemoFlow />
    </div>
  )
}
