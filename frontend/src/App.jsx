import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ProcessesTab from './tabs/ProcessesTab'
import PerformanceTab from './tabs/PerformanceTab'
import StartupTab from './tabs/StartupTab'
import ServicesTab from './tabs/ServicesTab'
import GameModeTab from './tabs/GameModeTab'
import { EventsOn } from '../wailsjs/runtime/runtime'

const TABS = ['processes', 'performance', 'startup', 'services', 'gamemode']

export default function App() {
  const [activeTab, setActiveTab] = useState('processes')
  const [metrics, setMetrics] = useState(null)
  const [perfMode, setPerfMode] = useState(false)

  // Subscribe to real-time metrics stream from Go backend
  useEffect(() => {
    const unsub = EventsOn('metrics:update', (data) => {
      setMetrics(data)
      setPerfMode(data?.cpu?.governor === 'performance')
    })
    return () => { if (typeof unsub === 'function') unsub() }
  }, [])

  const renderTab = () => {
    switch (activeTab) {
      case 'processes':   return <ProcessesTab />
      case 'performance': return <PerformanceTab metrics={metrics} />
      case 'startup':     return <StartupTab />
      case 'services':    return <ServicesTab />
      case 'gamemode':    return <GameModeTab metrics={metrics} perfMode={perfMode} />
      default:            return null
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: '#090912' }}>
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        perfMode={perfMode}
        metrics={metrics}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{
            background: 'rgba(12,12,24,0.95)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <h1 className="text-sm font-semibold tracking-widest text-slate-300 uppercase">
            {activeTab === 'processes'   && '⚡ Process Manager'}
            {activeTab === 'performance' && '📊 Performance Monitor'}
            {activeTab === 'startup'     && '🚀 Startup Applications'}
            {activeTab === 'services'    && '⚙  Systemd Services'}
            {activeTab === 'gamemode'    && '🎮 GameMode & CPU Governor'}
          </h1>

          <div className="flex items-center gap-3">
            {perfMode && (
              <span
                className="px-3 py-1 rounded-full text-xs font-bold animate-pulse"
                style={{
                  background: 'rgba(239,68,68,0.18)',
                  color: '#fca5a5',
                  border: '1px solid rgba(239,68,68,0.4)',
                }}
              >
                🔥 BEAST MODE
              </span>
            )}
            {metrics && (
              <span className="text-xs text-slate-500">
                CPU {metrics.cpu?.totalPct?.toFixed(1)}% &nbsp;·&nbsp;
                RAM {metrics.ram?.pct?.toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden animate-fade-in">
          {renderTab()}
        </div>
      </main>
    </div>
  )
}
