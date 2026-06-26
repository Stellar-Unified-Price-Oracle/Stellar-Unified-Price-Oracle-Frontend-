import { memo, useEffect, useState } from 'react'
import { wsAnalytics, type WsAnalyticsSummary } from '../utils/wsAnalytics'

const TYPE_STYLES: Record<string, string> = {
  connect: 'text-green-400',
  disconnect: 'text-red-400',
  reconnect: 'text-yellow-400',
  error: 'text-red-500',
  latency: 'text-blue-400',
}

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString()
}

export const WsAnalyticsPanel = memo(function WsAnalyticsPanel() {
  const [summary, setSummary] = useState<WsAnalyticsSummary>(() => wsAnalytics.getSummary())

  useEffect(() => wsAnalytics.subscribe(setSummary), [])

  const recentEvents = [...summary.events].reverse().slice(0, 50)

  return (
    <section className="bg-gray-900 rounded-lg p-4 space-y-3" aria-label="WebSocket analytics">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-white">WebSocket Analytics</h3>
        <button
          onClick={() => {
            const a = document.createElement('a')
            a.href = URL.createObjectURL(new Blob([wsAnalytics.exportEvents()], { type: 'application/json' }))
            a.download = 'ws-events.json'
            a.click()
          }}
          className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200"
        >
          Export
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {[
          ['Connects', summary.totalConnects, 'text-green-400'],
          ['Disconnects', summary.totalDisconnects, 'text-red-400'],
          ['Reconnects', summary.totalReconnects, 'text-yellow-400'],
          ['Errors', summary.totalErrors, 'text-red-500'],
        ].map(([label, val, cls]) => (
          <div key={label as string} className="bg-gray-800 rounded p-2">
            <div className={`text-lg font-mono font-bold ${cls}`}>{val}</div>
            <div className="text-gray-400">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-gray-800 rounded p-2">
          <div className="text-gray-400">Disconnect rate</div>
          <div className="font-mono text-white">{summary.disconnectRate.toFixed(2)}/min</div>
        </div>
        <div className="bg-gray-800 rounded p-2">
          <div className="text-gray-400">Avg latency</div>
          <div className="font-mono text-white">
            {summary.avgLatencyMs != null ? `${summary.avgLatencyMs.toFixed(0)}ms` : '—'}
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-xs text-gray-400 mb-1">Connection timeline</h4>
        <ul className="space-y-0.5 max-h-48 overflow-y-auto" role="list">
          {recentEvents.length === 0 && (
            <li className="text-xs text-gray-500 italic">No events yet.</li>
          )}
          {recentEvents.map((e, i) => (
            <li key={i} className="flex items-center gap-2 text-xs font-mono">
              <span className="text-gray-500">{fmt(e.timestamp)}</span>
              <span className={`uppercase font-bold w-20 ${TYPE_STYLES[e.type] ?? 'text-gray-300'}`}>{e.type}</span>
              {e.durationMs != null && <span className="text-gray-400">connected {e.durationMs}ms</span>}
              {e.latencyMs != null && <span className="text-gray-400">{e.latencyMs}ms</span>}
              {e.detail && <span className="text-gray-400">{e.detail}</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
})
