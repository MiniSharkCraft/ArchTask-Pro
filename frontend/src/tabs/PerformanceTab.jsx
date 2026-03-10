import { useEffect, useState } from 'react'
import { Cpu, MemoryStick, HardDrive, Network, Monitor, Zap, Thermometer } from 'lucide-react'
import SparkLine from '../components/SparkLine'

const MAX_HISTORY = 60

function useHistory(value, max = MAX_HISTORY) {
  const [hist, setHist] = useState([])
  useEffect(() => {
    if (value == null) return
    setHist(prev => {
      const next = [...prev, value]
      return next.length > max ? next.slice(next.length - max) : next
    })
  }, [value])
  return hist
}

// ── Generic metric card ───────────────────────────────────────────────────────
function MetricCard({ icon: Icon, title, value, unit, color, children, sparkData, badge }) {
  const pct = Math.min(100, Math.max(0, typeof value === 'number' ? value : 0))
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: 'rgba(16,16,32,0.85)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: `${color}18` }}>
            <Icon size={13} style={{ color }} />
          </div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
          {badge && (
            <span className="px-1.5 py-0.5 rounded text-xs font-bold"
              style={{ background: `${badge.color}18`, color: badge.color, border: `1px solid ${badge.color}30` }}>
              {badge.label}
            </span>
          )}
        </div>
        <span className="text-sm font-bold font-mono" style={{ color }}>
          {typeof value === 'number' ? value.toFixed(1) : value}{unit}
        </span>
      </div>
      <div className="metric-bar">
        <div className="metric-bar-fill" style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}80, ${color})`,
          boxShadow: `0 0 6px ${color}40`,
        }} />
      </div>
      {sparkData && (
        <div style={{ height: 40 }}>
          <SparkLine data={sparkData} color={color} height={40} />
        </div>
      )}
      {children && <div className="text-xs text-slate-400 space-y-1">{children}</div>}
    </div>
  )
}

// ── Per-core CPU grid ─────────────────────────────────────────────────────────
function CoreGrid({ cores }) {
  if (!cores?.length) return null
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))' }}>
      {cores.map((pct, i) => {
        const col = pct > 80 ? '#f87171' : pct > 50 ? '#fb923c' : pct > 20 ? '#facc15' : '#4ade80'
        return (
          <div key={i} className="rounded-lg p-2 text-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-xs text-slate-500 mb-1">C{i}</div>
            <div className="text-xs font-bold font-mono" style={{ color: col }}>{pct?.toFixed(0)}%</div>
            <div className="metric-bar mt-1" style={{ height: 3 }}>
              <div className="metric-bar-fill" style={{ width: `${pct}%`, background: col }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── GPU type helpers ──────────────────────────────────────────────────────────
const GPU_TYPE_LABEL = {
  nvidia:     { label: 'NVIDIA',       color: '#76b900' },
  amd_dgpu:   { label: 'AMD dGPU',     color: '#ed1c24' },
  intel_igpu: { label: 'Intel iGPU',   color: '#0071c5' },
  amd_igpu:   { label: 'AMD iGPU',     color: '#ed1c24' },
  generic:    { label: 'GPU',          color: '#94a3b8' },
}

function gpuAccent(type) {
  return GPU_TYPE_LABEL[type]?.color ?? '#ec4899'
}

// ── iGPU-specific details ─────────────────────────────────────────────────────
function IGPUDetails({ gpu }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
      {/* Frequency */}
      {gpu.freqMhz > 0 && (
        <>
          <span className="text-slate-500">Clock</span>
          <span className="font-mono text-right" style={{ color: gpuAccent(gpu.type) }}>
            {gpu.freqMhz} <span className="text-slate-600">/ {gpu.maxFreqMhz || '?'} MHz</span>
          </span>
          {/* Freq bar */}
          {gpu.maxFreqMhz > 0 && (
            <div className="col-span-2">
              <div className="metric-bar" style={{ height: 3 }}>
                <div className="metric-bar-fill" style={{
                  width: `${(gpu.freqMhz / gpu.maxFreqMhz) * 100}%`,
                  background: gpuAccent(gpu.type),
                }} />
              </div>
            </div>
          )}
        </>
      )}

      {/* Shared RAM (iGPU uses system RAM) */}
      {gpu.sharedMemMb > 0 && (
        <>
          <span className="text-slate-500">Shared RAM</span>
          <span className="font-mono text-right text-cyan-400">{gpu.sharedMemMb} MB</span>
        </>
      )}

      {/* Dedicated VRAM (AMD APU can have small dedicated pool) */}
      {gpu.vramTotalMb > 0 && (
        <>
          <span className="text-slate-500">VRAM</span>
          <span className="font-mono text-right">
            <span style={{ color: gpuAccent(gpu.type) }}>{gpu.vramUsedMb} MB</span>
            <span className="text-slate-600"> / {gpu.vramTotalMb} MB</span>
          </span>
        </>
      )}

      {/* Temperature */}
      {gpu.temp > 0 && (
        <>
          <span className="text-slate-500 flex items-center gap-1">
            <Thermometer size={10} /> Temp
          </span>
          <span className="font-mono text-right"
            style={{ color: gpu.temp > 85 ? '#f87171' : gpu.temp > 70 ? '#fb923c' : '#4ade80' }}>
            {gpu.temp.toFixed(0)}°C
          </span>
        </>
      )}

      {/* Power draw */}
      {gpu.powerW > 0 && (
        <>
          <span className="text-slate-500 flex items-center gap-1">
            <Zap size={10} /> Power
          </span>
          <span className="font-mono text-right text-yellow-400">{gpu.powerW.toFixed(1)} W</span>
        </>
      )}

      {/* Driver */}
      {gpu.driver && gpu.driver !== 'unknown' && (
        <>
          <span className="text-slate-500">Driver</span>
          <span className="font-mono text-right text-slate-400">{gpu.driver}</span>
        </>
      )}

      {/* Note for iGPU with no dedicated VRAM */}
      {gpu.isIgpu && gpu.vramTotalMb === 0 && (
        <p className="col-span-2 text-slate-600 italic mt-1">
          Uses shared system RAM — no dedicated VRAM pool.
        </p>
      )}
    </div>
  )
}

// ── Single GPU card ───────────────────────────────────────────────────────────
function GPUCard({ gpu }) {
  const accent  = gpuAccent(gpu.type)
  const typeInfo = GPU_TYPE_LABEL[gpu.type] ?? GPU_TYPE_LABEL.generic
  const isIGPU   = gpu.isIgpu

  if (!gpu.available) {
    return (
      <div className="rounded-xl p-4"
        style={{ background: 'rgba(16,16,32,0.85)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Monitor size={13} className="text-slate-600" />
          <span className="text-xs text-slate-600">{gpu.name}</span>
        </div>
        <p className="text-xs text-slate-700">
          Not detected. Install <code className="text-indigo-500">nvidia-smi</code>,{' '}
          <code className="text-indigo-500">rocm-smi</code>, or ensure{' '}
          <code className="text-indigo-500">i915</code> / <code className="text-indigo-500">amdgpu</code> is loaded.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl p-4 flex flex-col gap-3"
      style={{
        background: 'rgba(16,16,32,0.85)',
        border: `1px solid ${accent}22`,
        boxShadow: `0 0 20px ${accent}08`,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg shrink-0" style={{ background: `${accent}18` }}>
            <Monitor size={13} style={{ color: accent }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-100 truncate" title={gpu.name}>
                {gpu.name}
              </span>
              {/* Type badge */}
              <span className="px-1.5 py-0.5 rounded text-xs font-bold shrink-0"
                style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}30` }}>
                {typeInfo.label}
              </span>
              {isIGPU && (
                <span className="px-1.5 py-0.5 rounded text-xs font-bold shrink-0"
                  style={{ background: 'rgba(6,182,212,0.12)', color: '#67e8f9', border: '1px solid rgba(6,182,212,0.2)' }}>
                  iGPU
                </span>
              )}
            </div>
          </div>
        </div>
        <span className="text-sm font-bold font-mono shrink-0" style={{ color: accent }}>
          {gpu.usagePct.toFixed(1)}%
        </span>
      </div>

      {/* Usage bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-500">GPU Usage</span>
          <span className="font-mono" style={{ color: accent }}>{gpu.usagePct.toFixed(1)}%</span>
        </div>
        <div className="metric-bar">
          <div className="metric-bar-fill" style={{
            width: `${gpu.usagePct}%`,
            background: `linear-gradient(90deg, ${accent}70, ${accent})`,
            boxShadow: `0 0 6px ${accent}40`,
          }} />
        </div>
      </div>

      {/* VRAM bar (discrete GPU) */}
      {!isIGPU && gpu.vramTotalMb > 0 && (
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-500">VRAM</span>
            <span className="font-mono text-pink-400">
              {gpu.vramUsedMb} / {gpu.vramTotalMb} MB
              <span className="text-slate-600 ml-1">({gpu.vramPct.toFixed(0)}%)</span>
            </span>
          </div>
          <div className="metric-bar">
            <div className="metric-bar-fill" style={{
              width: `${gpu.vramPct}%`,
              background: `linear-gradient(90deg, #db277780, #db2777)`,
            }} />
          </div>
        </div>
      )}

      {/* iGPU-specific details */}
      {isIGPU && <IGPUDetails gpu={gpu} />}

      {/* Discrete GPU: temp + power inline */}
      {!isIGPU && (gpu.temp > 0 || gpu.powerW > 0) && (
        <div className="flex gap-4 text-xs">
          {gpu.temp > 0 && (
            <span className="flex items-center gap-1 text-slate-400">
              <Thermometer size={10} />
              <span style={{ color: gpu.temp > 85 ? '#f87171' : gpu.temp > 70 ? '#fb923c' : '#4ade80' }}>
                {gpu.temp.toFixed(0)}°C
              </span>
            </span>
          )}
          {gpu.powerW > 0 && (
            <span className="flex items-center gap-1 text-slate-400">
              <Zap size={10} />
              <span className="text-yellow-400">{gpu.powerW.toFixed(1)} W</span>
            </span>
          )}
          {gpu.driver && (
            <span className="text-slate-600 ml-auto">{gpu.driver}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function PerformanceTab({ metrics }) {
  const cpuHist  = useHistory(metrics?.cpu?.totalPct)
  const ramHist  = useHistory(metrics?.ram?.pct)
  const netSHist = useHistory((metrics?.network?.sendRateMbs ?? 0) * 100)
  const netRHist = useHistory((metrics?.network?.recvRateMbs ?? 0) * 100)

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        Waiting for metrics stream…
      </div>
    )
  }

  const { cpu, ram, swap, zram, gpus = [], network } = metrics

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">

      {/* ── Row 1: CPU + RAM ── */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard icon={Cpu} title="CPU Total" value={cpu.totalPct} unit="%" color="#6366f1" sparkData={cpuHist}>
          <div className="flex justify-between">
            <span>Governor: <strong style={{ color: cpu.governor === 'performance' ? '#f87171' : '#4ade80' }}>
              {cpu.governor === 'performance' ? '🔥 Performance' : cpu.governor}
            </strong></span>
            <span>{cpu.perCore?.length} cores</span>
          </div>
        </MetricCard>

        <MetricCard icon={MemoryStick} title="RAM" value={ram.pct} unit="%" color="#06b6d4" sparkData={ramHist}>
          <div className="flex justify-between">
            <span>Used: <strong className="text-cyan-400">{ram.usedMb?.toFixed(0)} MB</strong></span>
            <span>Total: <strong className="text-slate-300">{ram.totalMb?.toFixed(0)} MB</strong></span>
          </div>
        </MetricCard>
      </div>

      {/* ── Per-core grid ── */}
      <div className="rounded-xl p-4"
        style={{ background: 'rgba(16,16,32,0.85)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Per-Core CPU</div>
        <CoreGrid cores={cpu.perCore} />
      </div>

      {/* ── Row 2: Swap + Zram ── */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard icon={HardDrive} title="Swap" value={swap.pct} unit="%" color="#8b5cf6">
          <div className="flex justify-between">
            <span>Used: <strong className="text-violet-400">{swap.usedMb?.toFixed(0)} MB</strong></span>
            <span>Total: <strong>{swap.totalMb?.toFixed(0)} MB</strong></span>
          </div>
        </MetricCard>

        {/* Zram */}
        <div className="rounded-xl p-4"
          style={{ background: 'rgba(16,16,32,0.85)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg" style={{ background: '#f9731618' }}>
              <HardDrive size={13} style={{ color: '#f97316' }} />
            </div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Zram</span>
            <span className="px-2 py-0.5 rounded text-xs font-bold ml-auto"
              style={{
                background: zram.available ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.15)',
                color:      zram.available ? '#4ade80' : '#64748b',
              }}>
              {zram.available ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>
          {zram.available ? (
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Compression Ratio</span>
                <strong className="text-orange-400">{zram.ratio?.toFixed(2)}x</strong>
              </div>
              <div className="flex justify-between">
                <span>Space Saved</span>
                <strong className="text-green-400">{zram.savings?.toFixed(1)}%</strong>
              </div>
              <div className="flex justify-between">
                <span>Original → Compressed</span>
                <span>{zram.originalMb?.toFixed(0)} → {zram.compressedMb?.toFixed(0)} MB</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-600">
              Zram not active.<br />
              <code className="text-indigo-400">modprobe zram && zramctl</code>
            </p>
          )}
        </div>
      </div>

      {/* ── GPU Section — one card per GPU (dGPU + iGPU) ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Monitor size={13} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Graphics
          </span>
          {gpus.filter(g => g.available).length > 1 && (
            <span className="text-xs text-slate-600">
              {gpus.filter(g => g.available).length} GPU(s) detected
            </span>
          )}
        </div>
        <div className={`grid gap-4 ${gpus.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {gpus.map((gpu, i) => (
            <GPUCard key={i} gpu={gpu} />
          ))}
        </div>
      </div>

      {/* ── Network IO ── */}
      <div className="rounded-xl p-4"
        style={{ background: 'rgba(16,16,32,0.85)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg" style={{ background: '#22c55e18' }}>
            <Network size={13} style={{ color: '#22c55e' }} />
          </div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Network IO</span>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">↑ Upload</span>
              <span className="font-mono text-green-400">{network.sendRateMbs?.toFixed(2)} MB/s</span>
            </div>
            <SparkLine data={netSHist} color="#22c55e" height={28} />
            <div className="text-xs text-slate-600 mt-1">Total: {network.totalSentMb?.toFixed(1)} MB</div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">↓ Download</span>
              <span className="font-mono text-blue-400">{network.recvRateMbs?.toFixed(2)} MB/s</span>
            </div>
            <SparkLine data={netRHist} color="#3b82f6" height={28} />
            <div className="text-xs text-slate-600 mt-1">Total: {network.totalRecvMb?.toFixed(1)} MB</div>
          </div>
        </div>
      </div>

    </div>
  )
}
