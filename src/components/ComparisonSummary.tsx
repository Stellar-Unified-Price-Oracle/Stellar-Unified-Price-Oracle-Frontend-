/**
 * Summary table for the pairs in the overlay chart, shown above the chart (#814).
 *
 * Each row covers the same time window as the chart, so the numbers match the lines
 * the user is about to read. Pairs without data in the window are shown as such rather
 * than dropped, so the table always has one row per selected pair.
 */
import { memo, useId, useMemo, type ReactElement } from 'react'
import type { PriceHistoryEntry } from '../types'
import { summarizeSelection, type PairRangeSummary } from '../utils/comparisonSummary'
import { formatPriceShort } from '../utils/format'

interface ComparisonSummaryProps {
  pairs: string[]
  history: Record<string, PriceHistoryEntry[]>
  /** Window start in ms. Omit for an open start. */
  start?: number
  /** Window end in ms. Omit for an open end. */
  end?: number
}

function formatChange(percent: number | null): string {
  if (percent === null) return '—'
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`
}

function formatWhen(ts: number | null): string {
  return ts === null ? '—' : new Date(ts).toLocaleString()
}

function formatValue(value: number | null): string {
  return value === null ? '—' : formatPriceShort(value)
}

function rangeText(rows: PairRangeSummary[]): string | null {
  const withData = rows.filter((r) => r.from !== null && r.to !== null)
  if (withData.length === 0) return null
  const from = Math.min(...withData.map((r) => r.from as number))
  const to = Math.max(...withData.map((r) => r.to as number))
  return `${formatWhen(from)} – ${formatWhen(to)}`
}

export const ComparisonSummary = memo(function ComparisonSummary({
  pairs,
  history,
  start,
  end,
}: ComparisonSummaryProps): ReactElement {
  const headingId = useId()
  const rows = useMemo(() => summarizeSelection(pairs, history, start, end), [pairs, history, start, end])
  const range = rangeText(rows)

  return (
    <section aria-labelledby={headingId} className="mb-3 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
      <h3 id={headingId} className="text-sm font-medium text-gray-200">
        Summary before comparing
      </h3>
      <p className="mt-1 text-xs text-gray-500">
        {range ? `Window: ${range}` : 'No observations in the selected window.'}
      </p>

      <div className="mt-2 overflow-x-auto">
        <table className="min-w-full text-xs" aria-label="Per-pair summary for the selected window">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th scope="col" className="px-2 py-1.5 text-start font-semibold">
                Pair
              </th>
              <th scope="col" className="px-2 py-1.5 text-end font-semibold">
                Points
              </th>
              <th scope="col" className="px-2 py-1.5 text-end font-semibold">
                First
              </th>
              <th scope="col" className="px-2 py-1.5 text-end font-semibold">
                Last
              </th>
              <th scope="col" className="px-2 py-1.5 text-end font-semibold">
                Change
              </th>
              <th scope="col" className="px-2 py-1.5 text-end font-semibold">
                Low
              </th>
              <th scope="col" className="px-2 py-1.5 text-end font-semibold">
                High
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.pair} className="border-b border-gray-800/60 text-gray-200">
                <th scope="row" className="px-2 py-1.5 text-start font-medium">
                  {row.pair}
                  {row.points === 0 && <span className="ms-2 text-gray-500">no data in window</span>}
                </th>
                <td className="px-2 py-1.5 text-end font-mono">{row.points}</td>
                <td className="px-2 py-1.5 text-end font-mono">{formatValue(row.firstPrice)}</td>
                <td className="px-2 py-1.5 text-end font-mono">{formatValue(row.lastPrice)}</td>
                <td
                  className={`px-2 py-1.5 text-end font-mono ${
                    row.changePercent === null
                      ? 'text-gray-500'
                      : row.changePercent >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                  }`}
                >
                  {formatChange(row.changePercent)}
                </td>
                <td className="px-2 py-1.5 text-end font-mono">{formatValue(row.low)}</td>
                <td className="px-2 py-1.5 text-end font-mono">{formatValue(row.high)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
})
