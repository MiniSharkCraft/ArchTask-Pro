import { useState, useEffect } from 'react'
import { Gamepad2, Zap, Battery, Cpu, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import { GetGameModeStatus, GetCPUGovernor, SetCPUGovernor, ApplyGameModeToProcess } from '../../wailsjs/go/main/App'

const GOVERNORS = [
  {
    id: 'performance',
    label: '🔥 Performance',
    desc: 'Maximum clock speeds. All cores run at max frequency. Best for gaming and heavy workloads.',
    color: '#ef4444',
    icon: Zap,
  },
  {
    id: 'powersave',
    label: '💤 Powersave',
    desc: 'Minimum clock speeds. Reduces power consumption and heat. Best for battery / idle.',
    color: '#22c55e',
    icon: Battery,
  },
  {
    id: 'schedutil',
    label: '⚖  Schedutil',
    desc: 'Dynamic scaling based on CPU load scheduler hints. Balanced default for most use cases.',
    color: '#3b82f6',
    icon: Cpu,
  },
]

function GovernorCard({ gov, active, onSelect }) {
  const Icon = gov.icon
  const isActive = active === gov.id
  return (
    <button
      onClick={() => !isActive && onSelect(gov.id)}
      className="text-left rounded-xl p-4 transition-all w-full"
      style={{
        background: isActive ? `${gov.color}14` : 'rgba(16,16,32,0.8)',
        border: `1px solid ${isActive ? gov.color + '55' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: isActive ? `0 0 24px ${gov.color}18` : 'none',
        cursor: isActive ? 'default' : 'pointer',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: `${gov.color}20` }}>
            <Icon size={14} style={{ color: gov.color }} />
          </div>
          <span className="font-semibold text-sm" style={{ color: isActive ? gov.color : '#cbd5e1' }}>
            {gov.label}
          </span>
        </div>
        {isActive && (
          <span
            className="px-2 py-0.5 rounded-full text-xs font-bold animate-pulse"
            style={{ background: `${gov.color}25`, color: gov.color }}
          >
            ACTIVE
          </span>
        )}
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{gov.desc}</p>
    </button>
  )
}

export default function GameModeTab({ metrics, perfMode }) {
  const [governor, setGovernor]     = useState('unknown')
  const [gmStatus, setGmStatus]     = useState(null)
  const [pending, setPending]       = useState(null)   // governor id being confirmed
  const [applying, setApplying]     = useState(false)
  const [gmPid, setGmPid]           = useState('')
  const [gmResult, setGmResult]     = useState(null)   // { ok, msg }

  useEffect(() => {
    loadStatus()
  }, [])

  const loadStatus = async () => {
    try {
      const [gov, gm] = await Promise.all([GetCPUGovernor(), GetGameModeStatus()])
      setGovernor(gov)
      setGmStatus(gm)
    } catch (e) {
      console.error(e)
    }
  }

  const confirmGovernor = async () => {
    setApplying(true)
    setPending(null)
    try {
      await SetCPUGovernor(pending)
      setGovernor(pending)
    } catch (e) {
      alert(`Failed: ${e}`)
    } finally {
      setApplying(false)
    }
  }

  const applyGameMode = async () => {
    const pid = parseInt(gmPid)
    if (!pid || isNaN(pid)) {
      setGmResult({ ok: false, msg: 'Enter a valid PID first.' })
      return
    }
    setApplying(true)
    setGmResult(null)
    try {
      await ApplyGameModeToProcess(pid)
      setGmResult({ ok: true, msg: `GameMode applied to PID ${pid} ✓` })
    } catch (e) {
      setGmResult({ ok: false, msg: String(e) })
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      {/* Beast Mode banner */}
      {perfMode && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            boxShadow: '0 0 32px rgba(239,68,68,0.08)',
          }}
        >
          <span className="text-2xl">🔥</span>
          <div>
            <p className="font-bold text-red-400 text-sm">BEAST MODE ACTIVE</p>
            <p className="text-xs text-red-400/60">CPU Governor is set to Performance. All cores at max frequency.</p>
          </div>
        </div>
      )}

      {/* CPU Governor selection */}
      <div
        className="rounded-xl p-5"
        style={{ background: 'rgba(16,16,32,0.85)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">CPU Governor</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Changes applied via <code className="text-indigo-400">pkexec cpupower</code> to all cores
            </p>
          </div>
          <button onClick={loadStatus} className="btn btn-ghost text-xs">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>

        {applying ? (
          <div className="flex items-center gap-2 text-sm text-indigo-300 py-4">
            <RefreshCw size={14} className="animate-spin" />
            Applying governor…
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {GOVERNORS.map(gov => (
              <GovernorCard
                key={gov.id}
                gov={gov}
                active={governor}
                onSelect={setPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* GameMode status */}
      <div
        className="rounded-xl p-5"
        style={{ background: 'rgba(16,16,32,0.85)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg" style={{ background: 'rgba(139,92,246,0.2)' }}>
            <Gamepad2 size={14} className="text-violet-400" />
          </div>
          <h2 className="text-sm font-semibold text-slate-100">Feral GameMode</h2>
        </div>

        {gmStatus ? (
          <div className="grid grid-cols-2 gap-5">
            {/* Status */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {gmStatus.installed
                  ? <CheckCircle2 size={14} className="text-green-400" />
                  : <XCircle size={14} className="text-red-400" />
                }
                <span className="text-sm text-slate-300">
                  {gmStatus.installed ? 'Installed' : 'Not installed'}
                  {gmStatus.version && <span className="text-slate-500 text-xs ml-2">{gmStatus.version}</span>}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${gmStatus.running ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`}
                />
                <span className="text-sm text-slate-300">
                  {gmStatus.running ? 'Running' : 'Idle'}
                </span>
              </div>
              {!gmStatus.installed && (
                <div
                  className="p-3 rounded-lg text-xs space-y-1"
                  style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}
                >
                  <p className="text-slate-400">Install GameMode:</p>
                  <code className="text-indigo-400 block">pacman -S gamemode</code>
                  <code className="text-indigo-400 block">systemctl --user enable --now gamemoded</code>
                </div>
              )}
            </div>

            {/* Apply to PID */}
            {gmStatus.installed && (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">Apply GameMode optimizations to a process PID:</p>
                <div className="flex gap-2">
                  <input
                    value={gmPid}
                    onChange={e => setGmPid(e.target.value)}
                    placeholder="PID (e.g. 12345)"
                    className="flex-1 px-3 py-1.5 rounded-lg text-sm text-slate-200 bg-white/5
                      border border-white/10 focus:outline-none focus:border-violet-500/50 transition font-mono"
                  />
                  <button
                    onClick={applyGameMode}
                    disabled={applying || !gmPid}
                    className="btn btn-primary"
                  >
                    <Gamepad2 size={12} /> Apply
                  </button>
                </div>
                {gmResult && (
                  <div
                    className={`px-3 py-2 rounded-lg text-xs ${
                      gmResult.ok
                        ? 'bg-green-900/20 text-green-400 border border-green-700/30'
                        : 'bg-red-900/20 text-red-400 border border-red-700/30'
                    }`}
                  >
                    {gmResult.msg}
                  </div>
                )}
                <p className="text-xs text-slate-600">
                  Tip: Select a process on the Processes tab and copy its PID here.
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Loading GameMode status…</p>
        )}
      </div>

      {/* Live CPU snapshot from metrics */}
      {metrics && (
        <div
          className="rounded-xl p-4"
          style={{ background: 'rgba(16,16,32,0.85)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Live CPU State</h3>
          <div className="grid grid-cols-4 gap-2">
            {metrics.cpu.perCore?.slice(0, 16).map((pct, i) => {
              const col = pct > 80 ? '#f87171' : pct > 50 ? '#fb923c' : pct > 20 ? '#facc15' : '#4ade80'
              return (
                <div key={i}
                  className="rounded-lg p-2 text-center"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div className="text-xs text-slate-600 mb-1">Core {i}</div>
                  <div className="text-xs font-bold font-mono" style={{ color: col }}>{pct?.toFixed(0)}%</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Confirm modal for governor switch */}
      {pending && (
        <ConfirmModal
          title="⚡ Change CPU Governor"
          message={`Switch to: ${GOVERNORS.find(g => g.id === pending)?.label}\n\nThis runs: pkexec cpupower frequency-set -g ${pending}\n\nInstall the polkit rule to avoid password prompts.`}
          isAlert={pending === 'performance'}
          confirmLabel="Apply"
          onConfirm={confirmGovernor}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}
