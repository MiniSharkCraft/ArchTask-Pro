import {
  Cpu, MemoryStick, Rocket, Settings2, Gamepad2,
  Activity, Zap,
} from 'lucide-react'

const NAV_ITEMS = [
  { id: 'processes',   icon: Activity,   label: 'Processes',   badge: null },
  { id: 'performance', icon: Cpu,        label: 'Performance', badge: null },
  { id: 'startup',     icon: Rocket,     label: 'Startup Apps',badge: 'NEW' },
  { id: 'services',    icon: Settings2,  label: 'Services',    badge: null },
  { id: 'gamemode',    icon: Gamepad2,   label: 'GameMode',    badge: null },
]

export default function Sidebar({ activeTab, onTabChange, perfMode, metrics }) {
  const cpuPct  = metrics?.cpu?.totalPct  ?? 0
  const ramPct  = metrics?.ram?.pct       ?? 0
  const governor = metrics?.cpu?.governor ?? 'unknown'

  return (
    <aside
      className="flex flex-col shrink-0 animate-slide-in"
      style={{
        width: 210,
        background: 'rgba(10,10,22,0.98)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo */}
      <div
        className="px-4 py-5 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
            style={{ background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.4)' }}
          >
            ⚡
          </div>
          <div>
            <div className="text-sm font-bold text-slate-100 tracking-tight">ArchTask</div>
            <div className="text-xs text-indigo-400 font-medium">Pro v2.0</div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ id, icon: Icon, label, badge }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`nav-item w-full text-left ${activeTab === id ? 'active' : ''}`}
          >
            <Icon size={15} className="shrink-0" />
            <span className="flex-1">{label}</span>
            {badge && (
              <span
                className="text-xs px-1.5 py-0.5 rounded font-bold"
                style={{ background: 'rgba(34,197,94,0.2)', color: '#4ade80', fontSize: 9 }}
              >
                {badge}
              </span>
            )}
            {id === 'gamemode' && perfMode && (
              <span className="text-xs">🔥</span>
            )}
          </button>
        ))}
      </nav>

      {/* Mini metrics at the bottom */}
      <div
        className="px-4 py-4 shrink-0 space-y-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <MiniMetric label="CPU" value={cpuPct} color="#6366f1" />
        <MiniMetric label="RAM" value={ramPct} color="#06b6d4" />

        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-slate-600">Governor</span>
          <span
            className="text-xs font-bold"
            style={{ color: governor === 'performance' ? '#f87171' : '#4ade80' }}
          >
            {governor === 'performance' ? '🔥 PERF' : governor === 'powersave' ? '💤 SAVE' : governor}
          </span>
        </div>
      </div>
    </aside>
  )
}

function MiniMetric({ label, value, color }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-xs font-mono" style={{ color }}>{value.toFixed(1)}%</span>
      </div>
      <div className="metric-bar">
        <div
          className="metric-bar-fill"
          style={{
            width: `${Math.min(100, value)}%`,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
          }}
        />
      </div>
    </div>
  )
}
