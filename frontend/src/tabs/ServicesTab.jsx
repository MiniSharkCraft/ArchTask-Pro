import { useState, useEffect, useCallback } from 'react'
import { Play, Square, RotateCcw, Power, PowerOff, Search, RefreshCw } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import { GetServices, ServiceAction } from '../../wailsjs/go/main/App'

const ACTION_CONFIG = {
  start:   { icon: Play,       label: 'Start',   cls: 'btn-success' },
  stop:    { icon: Square,     label: 'Stop',    cls: 'btn-danger'  },
  restart: { icon: RotateCcw,  label: 'Restart', cls: 'btn-primary' },
  enable:  { icon: Power,      label: 'Enable',  cls: 'btn-ghost'   },
  disable: { icon: PowerOff,   label: 'Disable', cls: 'btn-ghost'   },
}

function StatusDot({ state }) {
  const map = {
    active:   { color: '#4ade80', label: 'Active'   },
    inactive: { color: '#64748b', label: 'Inactive' },
    failed:   { color: '#f87171', label: 'Failed'   },
    unknown:  { color: '#94a3b8', label: 'Unknown'  },
  }
  const { color, label } = map[state] ?? map.unknown
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 4px ${color}` }} />
      <span className="text-xs font-medium" style={{ color }}>{label}</span>
    </div>
  )
}

export default function ServicesTab() {
  const [services, setServices] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState('all')
  const [selected, setSelected] = useState(null) // { service, action }
  const [busy, setBusy]         = useState(null)

  const load = useCallback(async () => {
    try {
      const svc = await GetServices()
      setServices(svc || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
  }, [load])

  const doAction = async () => {
    if (!selected) return
    setBusy(selected.service.name)
    setSelected(null)
    try {
      await ServiceAction(selected.service.name, selected.action)
    } catch (e) {
      alert(`Error: ${e}`)
    } finally {
      setBusy(null)
      setTimeout(load, 800)
    }
  }

  const visible = services.filter(s => {
    const m = !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description?.toLowerCase().includes(search.toLowerCase())
    const f = filter === 'all' ? true :
      filter === 'active'   ? s.activeState === 'active' :
      filter === 'failed'   ? s.activeState === 'failed' :
      filter === 'inactive' ? s.activeState === 'inactive' : true
    return m && f
  })

  const failedCount = services.filter(s => s.activeState === 'failed').length

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search services…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm text-slate-200 bg-white/5
              border border-white/10 focus:outline-none focus:border-indigo-500/50 transition"
          />
        </div>
        <div className="flex gap-1.5">
          {[
            { id: 'all',      label: `All (${services.length})` },
            { id: 'active',   label: 'Active' },
            { id: 'failed',   label: `Failed (${failedCount})`, urgent: failedCount > 0 },
            { id: 'inactive', label: 'Inactive' },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                filter === f.id
                  ? (f.urgent ? 'bg-red-900/40 text-red-300 border border-red-500/40' : 'bg-indigo-600/40 text-indigo-300 border border-indigo-500/40')
                  : (f.urgent ? 'bg-red-900/20 text-red-400 border border-red-700/30 hover:bg-red-900/30' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10')
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={load} className="btn btn-ghost ml-auto"><RefreshCw size={12} /></button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">Loading services…</div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr style={{ background: 'rgba(10,10,22,0.98)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Service', 'Status', 'Sub', 'Description', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs text-slate-500 font-semibold uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(svc => (
                <tr
                  key={svc.name}
                  className="table-row border-b border-white/[0.03]"
                  style={{
                    background: svc.activeState === 'failed'
                      ? 'rgba(239,68,68,0.06)' : 'transparent',
                  }}
                >
                  <td className="px-4 py-2.5">
                    <span className="text-sm font-medium text-slate-200">{svc.name}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusDot state={svc.activeState} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{svc.subState}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 max-w-xs truncate">
                    {svc.description}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1.5">
                      {busy === svc.name ? (
                        <span className="text-xs text-indigo-400 animate-pulse">Working…</span>
                      ) : (
                        Object.entries(ACTION_CONFIG).map(([action, cfg]) => {
                          const Icon = cfg.icon
                          return (
                            <button
                              key={action}
                              onClick={() => setSelected({ service: svc, action })}
                              className={`btn ${cfg.cls}`}
                              style={{ padding: '3px 8px', fontSize: 11 }}
                              title={cfg.label}
                            >
                              <Icon size={10} />
                            </button>
                          )
                        })
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2 text-xs text-slate-500 shrink-0 flex gap-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <span>Total: <strong className="text-slate-300">{services.length}</strong></span>
        <span>Active: <strong className="text-green-400">{services.filter(s => s.activeState === 'active').length}</strong></span>
        {failedCount > 0 && (
          <span>Failed: <strong className="text-red-400">{failedCount}</strong></span>
        )}
        <span className="ml-auto text-slate-600">Actions use pkexec (polkit-authenticated)</span>
      </div>

      {selected && (
        <ConfirmModal
          title={`${ACTION_CONFIG[selected.action]?.label} — ${selected.service.name}`}
          message={`Run: pkexec systemctl ${selected.action} ${selected.service.name}.service`}
          isAlert={selected.action === 'stop' || selected.action === 'disable'}
          confirmLabel={ACTION_CONFIG[selected.action]?.label}
          onConfirm={doAction}
          onCancel={() => setSelected(null)}
        />
      )}
    </div>
  )
}
