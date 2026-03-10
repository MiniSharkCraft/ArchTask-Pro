import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, Skull, Zap, Search, Users, Server,
  ChevronRight, ChevronDown, Layers,
} from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import { GetProcesses, KillProcesses } from '../../wailsjs/go/main/App'

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_COLOR = {
  R: '#4ade80', S: '#64748b', I: '#475569',
  Z: '#f87171', T: '#fbbf24', D: '#fb923c',
}

function fmtMem(mb) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} G`
  return `${mb.toFixed(0)} M`
}

function cpuColor(pct) {
  if (pct > 80) return '#f87171'
  if (pct > 50) return '#fb923c'
  if (pct > 20) return '#facc15'
  return '#4ade80'
}

/**
 * groupProcesses — gộp các process có cùng tên thành 1 nhóm.
 * Trả về mảng GroupEntry:
 *   { name, procs[], totalCpu, totalMem, dominantStatus, username }
 */
function groupProcesses(procs) {
  const map = new Map()
  for (const p of procs) {
    // Normalise tên — bỏ đường dẫn, chỉ lấy tên file
    const key = p.name.toLowerCase()
    if (!map.has(key)) {
      map.set(key, { name: p.name, procs: [], totalCpu: 0, totalMem: 0 })
    }
    const g = map.get(key)
    g.procs.push(p)
    g.totalCpu += p.cpu
    g.totalMem += p.memMb
  }

  return [...map.values()]
    .map(g => ({
      ...g,
      // Trạng thái đại diện: ưu tiên R > D > T > Z > S > I
      dominantStatus: dominantStatus(g.procs),
      username: g.procs[0]?.username ?? '',
    }))
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
}

const STATUS_PRIORITY = { R: 5, D: 4, T: 3, Z: 2, S: 1, I: 0 }
function dominantStatus(procs) {
  return procs.reduce((best, p) => {
    return (STATUS_PRIORITY[p.status] ?? 0) > (STATUS_PRIORITY[best] ?? 0)
      ? p.status : best
  }, procs[0]?.status ?? 'S')
}

// ── Sub-components ──────────────────────────────────────────────────────────

/** Checkbox cell */
function CheckCell({ checked, indeterminate = false }) {
  return (
    <div
      className="w-4 h-4 rounded border flex items-center justify-center text-xs shrink-0"
      style={{
        borderColor: checked || indeterminate ? '#6366f1' : 'rgba(255,255,255,0.15)',
        background:  checked ? 'rgba(99,102,241,0.4)'
                   : indeterminate ? 'rgba(99,102,241,0.2)'
                   : 'transparent',
      }}
    >
      {checked && '✓'}
      {!checked && indeterminate && '–'}
    </div>
  )
}

/** Single process row (inside an expanded group) */
function ProcessRow({ proc, selected, onToggle, indent = false }) {
  const isSelected = selected.has(proc.pid)
  return (
    <tr
      className={`table-row cursor-pointer ${isSelected ? 'selected' : ''}`}
      onClick={() => onToggle(proc.pid)}
      style={{ background: isSelected ? 'rgba(59,130,246,0.1)' : undefined }}
    >
      {/* checkbox */}
      <td className="px-3 py-1 w-8">
        <CheckCell checked={isSelected} />
      </td>
      {/* PID */}
      <td className="px-2 py-1 text-slate-500 font-mono text-xs w-16">{proc.pid}</td>
      {/* Name — indented when inside group */}
      <td className="px-2 py-1 font-medium max-w-xs">
        <div className="flex items-center gap-1">
          {indent && <span className="text-slate-700 select-none ml-4">└</span>}
          <span className="truncate text-slate-300 text-xs" title={proc.name}>
            {proc.name}
          </span>
        </div>
      </td>
      {/* CPU */}
      <td className="px-2 py-1 text-xs font-mono" style={{ color: cpuColor(proc.cpu) }}>
        {proc.cpu.toFixed(1)}%
      </td>
      {/* Mem */}
      <td className="px-2 py-1 text-xs text-cyan-400 font-mono">{fmtMem(proc.memMb)}</td>
      {/* Status */}
      <td className="px-2 py-1">
        <span className="text-xs font-bold" style={{ color: STATUS_COLOR[proc.status] ?? '#94a3b8' }}>
          {proc.status}
        </span>
      </td>
      {/* User */}
      <td className="px-2 py-1 text-xs text-slate-500 max-w-xs">
        <span className="truncate block">{proc.username}</span>
      </td>
    </tr>
  )
}

/** Grouped row — shows aggregated stats + expand/collapse */
function GroupRow({ group, selected, onToggleGroup, onToggleSingle, expanded, onExpand }) {
  const pids       = group.procs.map(p => p.pid)
  const allSel     = pids.every(pid => selected.has(pid))
  const someSel    = pids.some(pid => selected.has(pid))
  const isMulti    = group.procs.length > 1
  const SHOW_LIMIT = 5

  // How many are shown when expanded
  const [showAll, setShowAll] = useState(false)
  const visibleProcs = expanded
    ? (showAll ? group.procs : group.procs.slice(0, SHOW_LIMIT))
    : []
  const hiddenCount = group.procs.length - SHOW_LIMIT

  return (
    <>
      {/* ── Main grouped row ───────────────────────────────────────────── */}
      <tr
        className="table-row cursor-pointer"
        style={{
          background: allSel
            ? 'rgba(59,130,246,0.12)'
            : someSel
            ? 'rgba(59,130,246,0.06)'
            : 'rgba(255,255,255,0.015)',
          borderLeft: isMulti ? '2px solid rgba(99,102,241,0.3)' : '2px solid transparent',
        }}
        onClick={() => onToggleGroup(pids)}
      >
        {/* Checkbox */}
        <td className="px-3 py-1.5 w-8">
          <CheckCell checked={allSel} indeterminate={someSel && !allSel} />
        </td>

        {/* PID — hiện số lượng nếu multi */}
        <td className="px-2 py-1.5 w-16">
          {isMulti ? (
            <span
              className="px-1.5 py-0.5 rounded text-xs font-bold"
              style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}
            >
              ×{group.procs.length}
            </span>
          ) : (
            <span className="text-slate-500 font-mono text-xs">{group.procs[0].pid}</span>
          )}
        </td>

        {/* Name + expand toggle */}
        <td className="px-2 py-1.5 font-medium max-w-xs">
          <div className="flex items-center gap-2">
            {/* Expand button — chỉ hiện khi multi */}
            {isMulti && (
              <button
                onClick={e => { e.stopPropagation(); onExpand(group.name) }}
                className="text-slate-500 hover:text-indigo-400 transition-colors shrink-0"
              >
                {expanded
                  ? <ChevronDown size={13} />
                  : <ChevronRight size={13} />}
              </button>
            )}

            {/* App name */}
            <span className="truncate text-sm font-semibold text-slate-200" title={group.name}>
              {group.name}
            </span>

            {/* Instance badge */}
            {isMulti && (
              <span
                className="px-1.5 py-0.5 rounded-full text-xs font-bold shrink-0"
                style={{
                  background: 'rgba(99,102,241,0.15)',
                  color: '#818cf8',
                  border: '1px solid rgba(99,102,241,0.25)',
                  fontSize: 10,
                }}
              >
                {group.procs.length} instances
              </span>
            )}
          </div>
        </td>

        {/* CPU — tổng */}
        <td className="px-2 py-1.5 text-xs font-mono" style={{ color: cpuColor(group.totalCpu) }}>
          {group.totalCpu.toFixed(1)}%
          {isMulti && (
            <span className="text-slate-600 text-xs ml-1">(Σ)</span>
          )}
        </td>

        {/* Mem — tổng */}
        <td className="px-2 py-1.5 text-xs text-cyan-400 font-mono">
          {fmtMem(group.totalMem)}
          {isMulti && (
            <span className="text-slate-600 text-xs ml-1">(Σ)</span>
          )}
        </td>

        {/* Status */}
        <td className="px-2 py-1.5">
          <span className="text-xs font-bold" style={{ color: STATUS_COLOR[group.dominantStatus] ?? '#94a3b8' }}>
            {group.dominantStatus}
          </span>
        </td>

        {/* User */}
        <td className="px-2 py-1.5 text-xs text-slate-500">
          <span className="truncate block">{group.username}</span>
        </td>
      </tr>

      {/* ── Expanded child rows ────────────────────────────────────────── */}
      {expanded && visibleProcs.map(p => (
        <ProcessRow
          key={p.pid}
          proc={p}
          selected={selected}
          onToggle={onToggleSingle}
          indent
        />
      ))}

      {/* ── Show more / less ──────────────────────────────────────────── */}
      {expanded && hiddenCount > 0 && (
        <tr>
          <td colSpan={7} className="px-3 py-1">
            <button
              onClick={e => { e.stopPropagation(); setShowAll(v => !v) }}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300
                transition-colors px-2 py-1 rounded hover:bg-indigo-500/10 ml-8"
            >
              {showAll ? (
                <><ChevronDown size={11} /> Show less</>
              ) : (
                <><ChevronRight size={11} /> Show {hiddenCount} more instances…</>
              )}
            </button>
          </td>
        </tr>
      )}
    </>
  )
}

/** Section header (User Apps / System Processes) */
function SectionHeader({ icon: Icon, label, count, uniqueCount, color }) {
  return (
    <tr>
      <td colSpan={7} className="px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest" style={{ color }}>
          <Icon size={12} />
          <span>{label}</span>
          {/* Unique groups */}
          <span className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: `${color}18`, color }}>
            {uniqueCount} apps
          </span>
          {/* Total instances */}
          {count !== uniqueCount && (
            <span className="text-xs font-normal text-slate-600">
              ({count} instances)
            </span>
          )}
          <div className="flex-1 h-px" style={{ background: `${color}20` }} />
        </div>
      </td>
    </tr>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function ProcessesTab() {
  const [data, setData]         = useState({ userProcs: [], sysProcs: [] })
  const [selected, setSelected] = useState(new Set())
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(null)
  const [expanded, setExpanded] = useState(new Set()) // group names that are expanded
  const [viewMode, setViewMode] = useState('grouped') // 'grouped' | 'flat'

  const load = useCallback(async () => {
    try {
      const res = await GetProcesses()
      setData(res)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 1500)
    return () => clearInterval(id)
  }, [load])

  // ── Selection helpers ──────────────────────────────────────────────────
  const toggleSingle = (pid) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(pid) ? next.delete(pid) : next.add(pid)
      return next
    })
  }

  const toggleGroup = (pids) => {
    setSelected(prev => {
      const next = new Set(prev)
      const allSelected = pids.every(pid => next.has(pid))
      if (allSelected) {
        pids.forEach(pid => next.delete(pid))
      } else {
        pids.forEach(pid => next.add(pid))
      }
      return next
    })
  }

  const selectAllUser = () =>
    setSelected(new Set(data.userProcs.map(p => p.pid)))
  const clearSelection = () => setSelected(new Set())

  // ── Expand/collapse ────────────────────────────────────────────────────
  const toggleExpand = (name) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const expandAll = () => {
    const names = [
      ...groupProcesses(data.userProcs),
      ...groupProcesses(data.sysProcs),
    ].filter(g => g.procs.length > 1).map(g => g.name)
    setExpanded(new Set(names))
  }

  const collapseAll = () => setExpanded(new Set())

  // ── Filter ─────────────────────────────────────────────────────────────
  const filterProcs = (procs) => {
    if (!search) return procs
    const q = search.toLowerCase()
    return procs.filter(p =>
      p.name.toLowerCase().includes(q) ||
      String(p.pid).includes(q) ||
      p.username?.toLowerCase().includes(q)
    )
  }

  const userFiltered = filterProcs(data.userProcs)
  const sysFiltered  = filterProcs(data.sysProcs)
  const userGroups   = groupProcesses(userFiltered)
  const sysGroups    = groupProcesses(sysFiltered)

  // ── Kill ───────────────────────────────────────────────────────────────
  const hasSysSelected = [...selected].some(pid =>
    data.sysProcs.some(p => p.pid === pid)
  )

  const confirmKill = async (force) => {
    const pids = [...selected]
    setModal(null)
    await KillProcesses(pids, force)
    setSelected(new Set())
    setTimeout(load, 300)
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0 flex-wrap"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* Search */}
        <div className="relative" style={{ minWidth: 200 }}>
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search process…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm text-slate-200 bg-white/5
              border border-white/10 focus:outline-none focus:border-indigo-500/50 transition"
          />
        </div>

        {/* View mode toggle */}
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {[
            { id: 'grouped', label: <><Layers size={11} /> Grouped</> },
            { id: 'flat',    label: 'Flat' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setViewMode(id)}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium transition-all"
              style={{
                background: viewMode === id ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.04)',
                color:      viewMode === id ? '#a5b4fc' : '#64748b',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Expand/Collapse buttons (only in grouped mode) */}
        {viewMode === 'grouped' && (
          <div className="flex gap-1">
            <button onClick={expandAll}   className="btn btn-ghost text-xs">Expand All</button>
            <button onClick={collapseAll} className="btn btn-ghost text-xs">Collapse</button>
          </div>
        )}

        {/* Selection count */}
        {selected.size > 0 && (
          <span className="text-xs text-indigo-300 font-medium">
            {selected.size} PIDs selected
          </span>
        )}

        <div className="flex gap-2 ml-auto">
          <button onClick={selectAllUser} className="btn btn-ghost text-xs">Select User</button>
          {selected.size > 0 && (
            <button onClick={clearSelection} className="btn btn-ghost text-xs">Clear</button>
          )}
          <button onClick={load} className="btn btn-ghost">
            <RefreshCw size={12} />
          </button>
          <button
            onClick={() => selected.size > 0 && setModal({ force: false })}
            disabled={selected.size === 0}
            className="btn btn-orange"
          >
            <Zap size={12} /> End Task
          </button>
          <button
            onClick={() => selected.size > 0 && setModal({ force: true })}
            disabled={selected.size === 0}
            className="btn btn-danger"
          >
            <Skull size={12} /> Force Kill
          </button>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Loading processes…
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr style={{
                background: 'rgba(10,10,22,0.98)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                {['', 'PID', 'Name', 'CPU%', 'Mem', 'St', 'User'].map(h => (
                  <th key={h}
                    className="px-2 py-2 text-left text-xs text-slate-500 font-semibold uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {viewMode === 'grouped' ? (
                <>
                  {/* ── User Applications (grouped) ── */}
                  <SectionHeader
                    icon={Users} label="User Applications"
                    count={userFiltered.length} uniqueCount={userGroups.length}
                    color="#818cf8"
                  />
                  {userGroups.map(g => (
                    <GroupRow
                      key={g.name}
                      group={g}
                      selected={selected}
                      onToggleGroup={toggleGroup}
                      onToggleSingle={toggleSingle}
                      expanded={expanded.has(g.name)}
                      onExpand={toggleExpand}
                    />
                  ))}

                  {/* ── System Processes (grouped) ── */}
                  <SectionHeader
                    icon={Server} label="System Processes"
                    count={sysFiltered.length} uniqueCount={sysGroups.length}
                    color="#64748b"
                  />
                  {sysGroups.map(g => (
                    <GroupRow
                      key={g.name}
                      group={g}
                      selected={selected}
                      onToggleGroup={toggleGroup}
                      onToggleSingle={toggleSingle}
                      expanded={expanded.has(g.name)}
                      onExpand={toggleExpand}
                    />
                  ))}
                </>
              ) : (
                <>
                  {/* ── Flat view (original behaviour) ── */}
                  <SectionHeader
                    icon={Users} label="User Applications"
                    count={userFiltered.length} uniqueCount={userFiltered.length}
                    color="#818cf8"
                  />
                  {userFiltered.map(p => (
                    <ProcessRow key={p.pid} proc={p} selected={selected} onToggle={toggleSingle} />
                  ))}
                  <SectionHeader
                    icon={Server} label="System Processes"
                    count={sysFiltered.length} uniqueCount={sysFiltered.length}
                    color="#64748b"
                  />
                  {sysFiltered.map(p => (
                    <ProcessRow key={p.pid} proc={p} selected={selected} onToggle={toggleSingle} />
                  ))}
                </>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Status bar ──────────────────────────────────────────────────── */}
      <div
        className="px-4 py-2 text-xs text-slate-500 shrink-0 flex gap-4 items-center"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <span>User: <strong className="text-slate-300">{data.userProcs.length}</strong></span>
        <span>System: <strong className="text-slate-300">{data.sysProcs.length}</strong></span>
        <span>Total: <strong className="text-slate-300">{data.userProcs.length + data.sysProcs.length}</strong></span>
        {viewMode === 'grouped' && (
          <span className="text-slate-600">
            · {userGroups.length + sysGroups.length} unique apps
          </span>
        )}
        <span className="ml-auto text-slate-600">
          Click row = select group · Click ▶ = expand instances
        </span>
      </div>

      {/* ── Confirm modal ────────────────────────────────────────────────── */}
      {modal && (
        <ConfirmModal
          title={modal.force ? '💀 Force Kill Processes' : '⚡ End Task'}
          message={
            `${modal.force ? 'Force kill (SIGKILL)' : 'Terminate (SIGTERM)'} ` +
            `${selected.size} PID(s)?` +
            (hasSysSelected ? '\n\n⚠  System processes detected — pkexec will be used.' : '')
          }
          isAlert={hasSysSelected || modal.force}
          confirmLabel={modal.force ? 'Force Kill' : 'End Task'}
          onConfirm={() => confirmKill(modal.force)}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  )
}
