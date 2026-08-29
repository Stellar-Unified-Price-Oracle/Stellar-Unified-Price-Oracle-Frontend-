import { memo, useEffect, useState, type ReactElement } from 'react'
import { wsAnalytics, type WsAnalyticsSummary, type WsRateBucket } from '../utils/wsAnalytics'
import { loadExportUtils } from '../utils/deferredExports'

const TYPE_STYLES: Record<string, string> = {
  connect: 'text-green-400',
  disconnect: 'text-red-400',
  reconnect: 'text-yellow-400',
  error: 'text-red-500',
  latency: 'text-blue-400',
  drop: 'text-orange-400',
}

/** Buckets shown by the sparkline — fixes its width so it never reflows as data arrives (CLS = 0, #473). */
const SPARKLINE_SLOTS = 30
const SPARKLINE_HEIGHT = 32

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString()
}

function fmtMs(ms: number | null): string {
  return ms != null ? `${ms.toFixed(1)}ms` : '—'
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Message-rate sparkline (#473): a fixed-slot bar chart over the last
 * {@link SPARKLINE_SLOTS} one-minute buckets. The slot count — and therefore
 * the rendered width/height — never changes with the data, so the panel
 * never shifts layout as new buckets arrive (CLS = 0).
 */
function RateSparkline({ buckets }: { buckets: WsRateBucket[] }): ReactElement {
  // Left-pad with empty buckets so there are always exactly SPARKLINE_SLOTS bars.
  const padded: Array<WsRateBucket | null> = [
    ...Array.from({ length: Math.max(0, SPARKLINE_SLOTS - buckets.length) }, () => null),
    ...buckets.slice(-SPARKLINE_SLOTS),
  ]
  const max = Math.max(1, ...padded.map((b) => b?.messages ?? 0))
  const barWidth = 100 / SPARKLINE_SLOTS

  return (
    <svg
      viewBox={`0 0 100 ${SPARKLINE_HEIGHT}`}
      preserveAspectRatio="none"
      width="100%"
      height={SPARKLINE_HEIGHT}
      className="block"
      aria-hidden="true"
    >
      {padded.map((b, i) => {
        const messages = b?.messages ?? 0
        const h = messages > 0 ? Math.max(1, (messages / max) * SPARKLINE_HEIGHT) : 0
        return (
          <rect
            key={b?.minute ?? `empty-${i}`}
            x={i * barWidth}
            y={SPARKLINE_HEIGHT - h}
            width={Math.max(0, barWidth - 0.5)}
            height={h}
            className={b && b.drops > 0 ? 'fill-orange-400' : 'fill-cyan-500'}
          />
        )
      })}
    </svg>
  )
}

export const WsAnalyticsPanel = memo(function WsAnalyticsPanel() {
  const [summary, setSummary] = useState<WsAnalyticsSummary>(() => wsAnalytics.getSummary())

  useEffect(() => wsAnalytics.subscribe(setSummary), [])

  const recentEvents = [...summary.events].reverse().slice(0, 50)
  const latestBucket = summary.rateBuckets[summary.rateBuckets.length - 1]
  const currentRatePerMin = latestBucket?.messages ?? 0

  return (
    <section className="bg-gray-900 rounded-lg p-4 space-y-3" aria-label="WebSocket analytics">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-white">WebSocket Analytics</h3>
        <button
          onClick={async () => {
            // #473 – reuse the app's shared export tooling (lazy-loaded, same
            // download/filename helpers as CSV/JSON/XLSX price exports)
            // instead of ad-hoc Blob/anchor plumbing.
            const { downloadFile, exportFilename } = await loadExportUtils()
            downloadFile(
              wsAnalytics.exportDiagnosticsSnapshot(),
              exportFilename('ws-diagnostics', 'json'),
              'application/json',
            )
          }}
          className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          Export diagnostics
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
        {/* #472 – negotiated protocol version */}
        <div className="bg-gray-800 rounded p-2">
          <div className="text-lg font-mono font-bold text-cyan-400">
            {summary.protocolVersion != null ? `v${summary.protocolVersion}` : '—'}
          </div>
          <div className="text-gray-400">Protocol</div>
        </div>
      </div>

      {/* #472 – surface the upgrade prompt on protocol mismatch */}
      {summary.protocolUpgradeRequired && (
        <div className="p-2 rounded bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-300" role="alert">
          Server speaks a newer WS protocol than this client. Downgraded to the supported feature set — update the app.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-gray-800 rounded p-2">
          <div className="text-gray-400">Disconnect rate</div>
          <div className="font-mono text-white">{summary.disconnectRate.toFixed(2)}/min</div>
        </div>
        <div className="bg-gray-800 rounded p-2">
          <div className="text-gray-400">Avg ping latency</div>
          <div className="font-mono text-white">{fmtMs(summary.avgLatencyMs)}</div>
        </div>
      </div>

      {/* #473 – message-rate/byte/drop diagnostics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-gray-800 rounded p-2">
          <div className="text-gray-400">Messages</div>
          <div className="font-mono text-white">{summary.totalMessages}</div>
        </div>
        <div className="bg-gray-800 rounded p-2">
          <div className="text-gray-400">Dropped frames</div>
          <div className={`font-mono ${summary.totalDrops > 0 ? 'text-orange-400' : 'text-white'}`}>
            {summary.totalDrops}
          </div>
        </div>
        <div className="bg-gray-800 rounded p-2">
          <div className="text-gray-400">Data received</div>
          <div className="font-mono text-white">{fmtBytes(summary.totalBytes)}</div>
        </div>
        <div className="bg-gray-800 rounded p-2">
          <div className="text-gray-400">Rate (last min)</div>
          <div className="font-mono text-white">{currentRatePerMin}/min</div>
        </div>
      </div>

      {/* #473 – receive-to-parse latency percentiles, from real per-message timing samples */}
      <div>
        <h4 className="text-xs text-gray-400 mb-1">Message latency percentiles</h4>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-gray-800 rounded p-2">
            <div className="text-gray-400">p50</div>
            <div className="font-mono text-white">{fmtMs(summary.messageLatencyPercentiles.p50)}</div>
          </div>
          <div className="bg-gray-800 rounded p-2">
            <div className="text-gray-400">p95</div>
            <div className="font-mono text-white">{fmtMs(summary.messageLatencyPercentiles.p95)}</div>
          </div>
          <div className="bg-gray-800 rounded p-2">
            <div className="text-gray-400">p99</div>
            <div className={`font-mono ${(summary.messageLatencyPercentiles.p99 ?? 0) > 100 ? 'text-amber-400' : 'text-white'}`}>
              {fmtMs(summary.messageLatencyPercentiles.p99)}
            </div>
          </div>
        </div>
      </div>

      {/* #473 – message-rate sparkline. Height is reserved unconditionally (fixed
          SPARKLINE_HEIGHT + label row) so it never shifts the layout below it. */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-xs text-gray-400">Message rate (last 30 min)</h4>
          <span className="text-xs font-mono text-gray-500">{currentRatePerMin}/min</span>
        </div>
        <div className="bg-gray-800 rounded p-2" style={{ height: SPARKLINE_HEIGHT + 16 }}>
          <RateSparkline buckets={summary.rateBuckets} />
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
