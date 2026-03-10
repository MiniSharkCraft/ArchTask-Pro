import { useState, useEffect, useCallback } from 'react'
import { Rocket, RefreshCw, Search, FolderOpen, AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { GetStartupApps, ToggleStartupApp } from '../../wailsjs/go/main/App'

// ── Toggle Switch component ────────────────────────────────────────────────
function ToggleSwitch({ enabled, onChange, disabled = false }) {
  return (
    <button
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className="shrink-0 transition-opacity"
      style={{ opacity: disabled ? 0.4 : 1 }}
      title={enabled ? 'Click to Disable' : 'Click to Enable'}
    >
      <div
        className="toggle-track"
        style={{ background: enabled ? '#4f46e5' : 'rgba(71,85,105,0.6)' }}
      >
        <div
          className="toggle-thumb shadow-md"
          style={{ left: enabled ? 21 : 3 }}
        />
      </div>
    </button>
  )
}

// ── Source badge ───────────────────────────────────────────────────────────
function SourceBadge({ source }) {
  const isUser = source === 'user'
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-medium shrink-0"
      style={{
        background: isUser ? 'rgba(99,102,241,0.15)' : 'rgba(100,116,139,0.15)',
        color:      isUser ? '#a5b4fc'                : '#94a3b8',
        border:     `1px solid ${isUser ? 'rgba(99,102,241,0.3)' : 'rgba(100,116,139,0.25)'}`,
      }}
    >
      {isUser ? '👤 User' : '⚙ System'}
    </span>
  )
}

// ── App icon ───────────────────────────────────────────────────────────────
function AppIcon({ name }) {
  const initial = (name || '?').charAt(0).toUpperCase()
  // Deterministic pastel color from name
  const colors = ['#6366f1','#8b5cf6','#06b6d4','#22c55e','#f59e0b','#ec4899','#f97316','#14b8a6']
  const hue    = name.charCodeAt(0) % colors.length
  return (
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 select-none"
      style={{
        background: `${colors[hue]}22`,
        border: `1px solid ${colors[hue]}44`,
        color: colors[hue],
      }}
    >
      {initial}
    </div>
  )
}

// ── Single startup app row ─────────────────────────────────────────────────
function StartupRow({ app, onToggle, toggling }) {
  const isBusy = toggling === app.filePath

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 rounded-xl transition-all"
      style={{
        background: app.enabled
          ? 'rgba(99,102,241,0.06)'
          : 'rgba(0,0,0,0.2)',
        border: `1px solid ${app.enabled ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.05)'}`,
        opacity: app.enabled ? 1 : 0.65,
      }}
    >
      {/* Icon */}
      <AppIcon name={app.name} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-slate-100 truncate">{app.name || 'Unknown App'}</span>
          <SourceBadge source={app.source} />
        </div>
        {app.comment && (
          <p className="text-xs text-slate-500 truncate mb-0.5">{app.comment}</p>
        )}
        <code
          className="text-xs truncate block max-w-sm"
          style={{ color: 'rgba(148,163,184,0.6)' }}
          title={app.command}
        >
          {app.command || <span className="italic text-slate-600">no command</span>}
        </code>
      </div>

      {/* File path hint */}
      <div className="hidden md:flex items-center gap-1 text-xs text-slate-600 shrink-0 max-w-[180px]">
        <FolderOpen size={10} className="shrink-0" />
        <span className="truncate" title={app.filePath}>
          {app.filePath?.replace(/.*\//, '')}
        </span>
      </div>

      {/* Status label */}
      <div className="w-20 text-right shrink-0">
        {app.enabled ? (
          <span className="flex items-center justify-end gap-1 text-xs text-green-400 font-medium">
            <CheckCircle2 size={11} /> Enabled
          </span>
        ) : (
          <span className="flex items-center justify-end gap-1 text-xs text-slate-500 font-medium">
            <AlertCircle size={11} /> Disabled
          </span>
        )}
      </div>

      {/* Toggle */}
      <div className="shrink-0">
        {isBusy ? (
          <div
            className="w-10 h-[22px] rounded-full flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.2)' }}
          >
            <span className="text-xs text-indigo-400 animate-spin">↻</span>
          </div>
        ) : (
          <ToggleSwitch
            enabled={app.enabled}
            onChange={(enable) => onToggle(app.filePath, enable)}
          />
        )}
      </div>
    </div>
  )
}

// ── Main tab component ─────────────────────────────────────────────────────
export default function StartupTab() {
  const [apps, setApps]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('all') // all | enabled | disabled | user | system
  const [toggling, setToggling] = useState(null) // filePath being toggled

  const load = useCallback(async () => {
    try {
      setError(null)
      const result = await GetStartupApps()
      setApps(result || [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleToggle = async (filePath, enable) => {
    setToggling(filePath)
    try {
      await ToggleStartupApp(filePath, enable)
      // Optimistically update UI
      setApps(prev => prev.map(a =>
        a.filePath === filePath ? { ...a, enabled: enable } : a
      ))
    } catch (e) {
      alert(`Failed to toggle: ${e}`)
      await load() // re-sync from disk
    } finally {
      setToggling(null)
    }
  }

  // Filter + search
  const visible = apps.filter(app => {
    const matchSearch = !search ||
      app.name?.toLowerCase().includes(search.toLowerCase()) ||
      app.command?.toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all'      ? true :
      filter === 'enabled'  ? app.enabled :
      filter === 'disabled' ? !app.enabled :
      filter === 'user'     ? app.source === 'user' :
      filter === 'system'   ? app.source === 'system' : true
    return matchSearch && matchFilter
  })

  const enabledCount  = apps.filter(a => a.enabled).length
  const disabledCount = apps.filter(a => !a.enabled).length

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div
        className="px-4 py-3 shrink-0 space-y-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* Info banner */}
        <div
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs"
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <Info size={13} className="text-indigo-400 shrink-0" />
          <span className="text-slate-300">
            Scanning <code className="text-indigo-400">~/.config/autostart/</code> and{' '}
            <code className="text-indigo-400">/etc/xdg/autostart/</code> · Toggle the switch to enable or disable an app at startup.
          </span>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search startup apps…"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm text-slate-200 bg-white/5
                border border-white/10 focus:outline-none focus:border-indigo-500/50 transition"
            />
          </div>

          {/* Filter chips */}
          <div className="flex gap-1.5">
            {[
              { id: 'all',      label: `All (${apps.length})` },
              { id: 'enabled',  label: `Enabled (${enabledCount})` },
              { id: 'disabled', label: `Disabled (${disabledCount})` },
              { id: 'user',     label: '👤 User' },
              { id: 'system',   label: '⚙ System' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  filter === f.id
                    ? 'bg-indigo-600/40 text-indigo-300 border border-indigo-500/40'
                    : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button onClick={load} className="btn btn-ghost ml-auto">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* App list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
            <Rocket size={32} className="animate-pulse text-indigo-500/40" />
            <span className="text-sm">Scanning autostart directories…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <AlertCircle size={32} className="text-red-400/60" />
            <span className="text-sm text-red-400">{error}</span>
            <button onClick={load} className="btn btn-ghost">Retry</button>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
            <Rocket size={32} className="text-slate-600/40" />
            <span className="text-sm">
              {apps.length === 0
                ? 'No startup applications found'
                : 'No apps match your current filter'}
            </span>
            {apps.length === 0 && (
              <p className="text-xs text-center max-w-xs text-slate-600">
                Place <code className="text-indigo-400">.desktop</code> files in{' '}
                <code className="text-indigo-400">~/.config/autostart/</code> to add startup apps.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(app => (
              <StartupRow
                key={app.filePath}
                app={app}
                onToggle={handleToggle}
                toggling={toggling}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2 text-xs text-slate-500 shrink-0 flex gap-4 items-center"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <span>Total: <strong className="text-slate-300">{apps.length}</strong></span>
        <span>Enabled: <strong className="text-green-400">{enabledCount}</strong></span>
        <span>Disabled: <strong className="text-slate-500">{disabledCount}</strong></span>
        <span className="ml-auto text-slate-600">
          Disable = adds <code>Hidden=true</code> to .desktop file
        </span>
      </div>
    </div>
  )
}
