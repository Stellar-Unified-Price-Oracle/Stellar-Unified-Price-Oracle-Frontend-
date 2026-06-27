import { memo, useEffect, useState } from 'react'
import { ApiLatencyPanel } from '../components/ApiLatencyPanel'
import { ConsoleWarningsPanel } from '../components/ConsoleWarningsPanel'
import { WsAnalyticsPanel } from '../components/WsAnalyticsPanel'
import { getLatencyStats } from '../utils/latencyMonitor'
import { wsAnalytics } from '../utils/wsAnalytics'

interface MemoryInfo {
  usedJSHeapSize: number
  jsHeapSizeLimit: number
}

function useMemory() {
  const [mem, setMem] = useState<MemoryInfo | null>(null)
  useEffect(() => {
    function update() {
      const m = (performance as { memory?: MemoryInfo }).memory
      if (m) setMem({ usedJSHeapSize: m.usedJSHeapSize, jsHeapSizeLimit: m.jsHeapSizeLimit })
    }
    update()
    const id = setInterval(update, 5000)
    return () => clearInterval(id)
  }, [])
  return mem
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-1">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-xl font-mono font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  )
}

export const OpsPage = memo(function OpsPage() {
  const mem = useMemory()
  const [wsSum, setWsSum] = useState(() => wsAnalytics.getSummary())
  const [latStats, setLatStats] = useState(() => getLatencyStats())

  useEffect(() => wsAnalytics.subscribe((s) => { setWsSum(s); setLatStats(getLatencyStats()) }), [])

  const memUsedMb = mem ? (mem.usedJSHeapSize / 1024 / 1024).toFixed(1) : null
  const memLimitMb = mem ? (mem.jsHeapSizeLimit / 1024 / 1024).toFixed(0) : null
  const errorRate =
    latStats.count > 0
      ? (
          (wsSum.totalErrors / Math.max(wsSum.totalConnects + latStats.count, 1)) *
          100
        ).toFixed(1)
      : '0.0'

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-6 space-y-6" aria-label="Operational metrics dashboard">
      <div>
        <h1 className="text-2xl font-bold">Operational Metrics</h1>
        <p className="text-sm text-gray-400 mt-1">Real-time app health: API latency, error rates, WebSocket uptime.</p>
      </div>

      {/* Top-level KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="API p95 Latency"
          value={latStats.p95 != null ? `${latStats.p95}ms` : '—'}
          sub={`p99: ${latStats.p99 != null ? latStats.p99 + 'ms' : '—'}`}
        />
        <MetricCard
          label="Error Rate"
          value={`${errorRate}%`}
          sub={`${wsSum.totalErrors} errors`}
        />
        <MetricCard
          label="WS Disconnects"
          value={String(wsSum.totalDisconnects)}
          sub={`${wsSum.disconnectRate.toFixed(2)}/min`}
        />
        <MetricCard
          label="JS Heap"
          value={memUsedMb != null ? `${memUsedMb} MB` : '—'}
          sub={memLimitMb ? `of ${memLimitMb} MB limit` : undefined}
        />
      </div>

      {/* Detailed panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ApiLatencyPanel />
        <WsAnalyticsPanel />
      </div>
      <ConsoleWarningsPanel />
    </main>
  )
})
