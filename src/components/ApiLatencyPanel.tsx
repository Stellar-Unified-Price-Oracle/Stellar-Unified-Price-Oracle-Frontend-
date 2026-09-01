import { memo, useEffect, useState } from 'react'
import {
  exportLatency,
  getLatencyAlertThreshold,
  getLatencyStats,
  getSamples,
  setLatencyAlertThreshold,
  subscribeLatency,
  type LatencySample,
  type LatencyStats,
} from '../utils/latencyMonitor'

function StatBadge({ label, value }: { label: string; value: number | null }) {
  const cls =
    value == null
      ? 'text-gray-500'
      : value > 1000
        ? 'text-red-400'
        : value > 500
          ? 'text-yellow-400'
          : 'text-green-400'
  return (
    <div className="bg-gray-800 rounded p-2 text-xs">
      <div className="text-gray-400">{label}</div>
      <div className={`font-mono text-base font-bold ${cls}`}>{value != null ? `${value.toFixed(0)}ms` : '—'}</div>
    </div>
  )
}

export const ApiLatencyPanel = memo(function ApiLatencyPanel() {
  const [samples, setSamples] = useState<LatencySample[]>(() => getSamples())
  const [stats, setStats] = useState<LatencyStats>(() => getLatencyStats())
  const [threshold, setThreshold] = useState(getLatencyAlertThreshold)

  useEffect(() =>
    subscribeLatency((s) => {
      setSamples(s.slice(-100))
      setStats(getLatencyStats())
    }),
  [])

  const recent = [...samples].reverse().slice(0, 50)

  return (
    <section className="bg-gray-900 rounded-lg p-4 space-y-3" aria-label="API latency">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-white">API Latency ({stats.count} requests)</h3>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">
            Alert &gt;{' '}
            <input
              type="number"
              value={threshold}
              onChange={(e) => {
                const v = Number(e.target.value)
                setThreshold(v)
                setLatencyAlertThreshold(v)
              }}
              className="w-16 bg-gray-800 text-gray-200 rounded px-1 py-0.5 text-xs border border-gray-700"
              aria-label="Latency alert threshold in ms"
            />
            ms
          </label>
          <button
            onClick={() => {
              const a = document.createElement('a')
              a.href = URL.createObjectURL(new Blob([exportLatency()], { type: 'application/json' }))
              a.download = 'latency.json'
              a.click()
            }}
            className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200"
          >
            Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatBadge label="p50" value={stats.p50} />
        <StatBadge label="p95" value={stats.p95} />
        <StatBadge label="p99" value={stats.p99} />
        <StatBadge label="avg" value={stats.avg} />
      </div>

      <div>
        <h4 className="text-xs text-gray-400 mb-1">Recent requests</h4>
        <ul className="space-y-0.5 max-h-48 overflow-y-auto" role="list">
          {recent.length === 0 && <li className="text-xs text-gray-500 italic">No requests tracked yet.</li>}
          {recent.map((s, i) => (
            <li key={i} className="flex items-center gap-2 text-xs font-mono">
              <span className="text-gray-500">{new Date(s.timestamp).toLocaleTimeString()}</span>
              <span
                className={`font-bold w-14 text-right ${
                  s.latencyMs > 1000 ? 'text-red-400' : s.latencyMs > 500 ? 'text-yellow-400' : 'text-green-400'
                }`}
              >
                {s.latencyMs}ms
              </span>
              <span className={s.ok ? 'text-gray-400' : 'text-red-400'} aria-label={s.ok ? 'ok' : 'error'}>
                {s.ok ? '✓' : '✗'}
              </span>
              <span className="text-gray-500 truncate max-w-xs">{s.endpoint}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
})
