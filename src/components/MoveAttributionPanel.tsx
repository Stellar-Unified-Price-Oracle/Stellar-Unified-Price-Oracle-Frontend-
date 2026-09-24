import { memo } from 'react'
import type { MoveAttribution } from '../types'
import { SOURCE_COLORS } from '../utils/sourceColors'

interface MoveAttributionPanelProps {
  /** The most recent attribution record to display. */
  latest: MoveAttribution
  /** Whether to show a short attribution history strip below the latest tick. */
  history?: MoveAttribution[]
}

/**
 * Renders a "Move Attribution" section showing which oracle sources drove the
 * latest price tick and their individual deltas.
 *
 * The panel always shows the latest tick. When `history` is provided it also
 * renders a compact strip of the last few ticks so you can spot which source
 * consistently leads the market.
 */
export const MoveAttributionPanel = memo(function MoveAttributionPanel({
  latest,
  history,
}: MoveAttributionPanelProps) {
  const aggDelta = latest.delta
  const aggDeltaPct = latest.deltaPercent

  return (
    <section
      aria-label="Move attribution"
      className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6"
    >
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">
        Move Attribution
      </p>

      {/* Aggregate delta summary */}
      <div className="flex items-baseline gap-3 mb-5">
        <span className="text-sm text-gray-400">Latest tick</span>
        {aggDelta === null ? (
          <span className="text-sm text-gray-500 italic">First tick — no prior data</span>
        ) : (
          <>
            <span
              className={`text-lg font-mono font-semibold ${aggDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}
            >
              {aggDelta >= 0 ? '+' : ''}
              {aggDelta.toFixed(4)}
            </span>
            {aggDeltaPct !== null && (
              <span
                className={`text-sm font-mono ${aggDelta >= 0 ? 'text-green-500' : 'text-red-500'}`}
              >
                ({aggDeltaPct >= 0 ? '+' : ''}
                {aggDeltaPct.toFixed(3)}%)
              </span>
            )}
          </>
        )}
      </div>

      {/* Per-source breakdown */}
      <div className="space-y-2 mb-4">
        {latest.sources.map((sd) => {
          const isLeader = latest.leadingSources.includes(sd.source)
          const colorClass =
            SOURCE_COLORS[sd.source] ?? 'bg-gray-800 text-gray-400 border-gray-700'

          return (
            <div
              key={sd.source}
              className="flex items-center gap-3 text-sm"
              role="row"
              aria-label={`${sd.source} attribution`}
            >
              {/* Source badge */}
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium border ${colorClass} shrink-0 min-w-[90px] justify-center`}
              >
                {isLeader && (
                  <span aria-hidden="true" title="Leading source">
                    ★
                  </span>
                )}
                {sd.source}
              </span>

              {/* Current price */}
              <span className="font-mono text-gray-200 w-24 text-right">
                ${sd.price.toFixed(4)}
              </span>

              {/* Delta */}
              {sd.delta === null ? (
                <span className="text-gray-500 italic text-xs">first tick</span>
              ) : (
                <>
                  <span
                    className={`font-mono w-20 text-right ${sd.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}
                  >
                    {sd.delta >= 0 ? '+' : ''}
                    {sd.delta.toFixed(4)}
                  </span>
                  {sd.deltaPercent !== null && (
                    <span
                      className={`font-mono text-xs w-16 text-right ${sd.delta >= 0 ? 'text-green-500' : 'text-red-500'}`}
                    >
                      ({sd.deltaPercent >= 0 ? '+' : ''}
                      {sd.deltaPercent.toFixed(2)}%)
                    </span>
                  )}
                </>
              )}

              {/* Leader indicator */}
              {isLeader && sd.delta !== null && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-semibold uppercase tracking-wide">
                  Leader
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* History strip — last N ticks, most-recent on the right */}
      {history && history.length > 1 && (
        <div className="border-t border-gray-800 pt-3 mt-3">
          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">
            Last {Math.min(history.length, 10)} ticks
          </p>
          <HistoryStrip entries={history.slice(-10)} />
        </div>
      )}
    </section>
  )
})

// ---------------------------------------------------------------------------
// History strip — a compact row-per-source sparkline of recent deltas
// ---------------------------------------------------------------------------

interface HistoryStripProps {
  entries: MoveAttribution[]
}

const HistoryStrip = memo(function HistoryStrip({ entries }: HistoryStripProps) {
  // Gather the union of source names across all entries
  const allSources = [...new Set(entries.flatMap((e) => e.sources.map((s) => s.source)))]

  return (
    <div className="overflow-x-auto">
      <table className="text-[11px] font-mono w-full min-w-[320px]">
        <thead>
          <tr>
            <th className="text-gray-600 font-normal text-left pr-3 py-0.5 w-[90px]">Source</th>
            {entries.map((e, i) => (
              <th
                key={i}
                className="text-gray-700 font-normal text-right px-1 py-0.5"
                aria-label={`Tick at ${new Date(e.timestamp).toLocaleTimeString()}`}
              >
                {new Date(e.timestamp).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allSources.map((src) => (
            <tr key={src} className="border-t border-gray-800/50">
              <td className="text-gray-500 pr-3 py-0.5">{src}</td>
              {entries.map((e, i) => {
                const sd = e.sources.find((s) => s.source === src)
                if (!sd) {
                  return (
                    <td key={i} className="text-gray-700 text-right px-1 py-0.5">
                      —
                    </td>
                  )
                }
                if (sd.delta === null) {
                  return (
                    <td key={i} className="text-gray-600 text-right px-1 py-0.5">
                      –
                    </td>
                  )
                }
                const isLeader = e.leadingSources.includes(src)
                return (
                  <td
                    key={i}
                    className={`text-right px-1 py-0.5 ${sd.delta >= 0 ? 'text-green-500' : 'text-red-500'} ${isLeader ? 'font-bold' : ''}`}
                    title={`${src} Δ ${sd.delta >= 0 ? '+' : ''}${sd.delta.toFixed(4)} at ${new Date(e.timestamp).toLocaleTimeString()}`}
                  >
                    {sd.delta >= 0 ? '+' : ''}
                    {sd.delta.toFixed(3)}
                  </td>
                )
              })}
            </tr>
          ))}
          {/* Aggregate row */}
          <tr className="border-t border-gray-700">
            <td className="text-gray-400 pr-3 py-0.5 font-semibold">agg</td>
            {entries.map((e, i) => {
              if (e.delta === null) {
                return (
                  <td key={i} className="text-gray-600 text-right px-1 py-0.5">
                    –
                  </td>
                )
              }
              return (
                <td
                  key={i}
                  className={`text-right px-1 py-0.5 font-semibold ${e.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}
                >
                  {e.delta >= 0 ? '+' : ''}
                  {e.delta.toFixed(3)}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
})
