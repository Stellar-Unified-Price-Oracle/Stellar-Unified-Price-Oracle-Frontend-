import { memo, useMemo, useCallback } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import type { PriceHistoryEntry } from '../types'
import { SOURCE_COLORS } from '../utils/sourceColors'
import { formatPriceShort } from '../utils/format'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportRow {
  timestamp: number
  [pair: string]: number
}

export interface MultiPairOverlayChartProps {
  /** Pair names to display */
  pairs: string[]
  /** Price history per pair */
  history: Record<string, PriceHistoryEntry[]>
  /** Pair to use as benchmark (rendered dashed) */
  benchmarkPair?: string
  /** Show % change from first data point */
  normalizedMode?: boolean
  /** Export callback — receives rows with timestamp + one key per pair */
  onExport?: (data: ExportRow[]) => void
}

// ---------------------------------------------------------------------------
// Color palette for series
// Each pair index gets a stable, distinct color. SOURCE_COLORS holds CSS
// badge classes for oracle source names — referenced here so callers can
// cross-reference oracle badge styles with series colors in the legend.
// ---------------------------------------------------------------------------
const SERIES_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#f87171', '#60a5fa', '#a78bfa', '#34d399']

// SOURCE_COLORS provides oracle badge CSS classes keyed by source name.
// We expose them through the legend's aria-label so screen readers can
// describe which oracle feed each series corresponds to.
const SOURCE_BADGE_KEYS = Object.keys(SOURCE_COLORS)

function colorForPair(pair: string, pairs: string[]): string {
  const idx = pairs.indexOf(pair)
  return SERIES_COLORS[idx % SERIES_COLORS.length] ?? '#06b6d4'
}

// ---------------------------------------------------------------------------
// Normalize a price series to % change relative to its first data point.
// Returns (price / firstPrice - 1) * 100 for each entry.
// ---------------------------------------------------------------------------
function normalizeToPercent(
  entries: PriceHistoryEntry[],
): Array<{ timestamp: number; value: number }> {
  if (entries.length === 0) return []
  const base = entries[0].price
  if (base === 0) return entries.map((e) => ({ timestamp: e.timestamp, value: 0 }))
  return entries.map((e) => ({
    timestamp: e.timestamp,
    value: (e.price / base - 1) * 100,
  }))
}

// ---------------------------------------------------------------------------
// Build a merged, timestamp-aligned dataset for the LineChart.
// Rows are keyed by timestamp; each pair contributes a column.
// ---------------------------------------------------------------------------
function buildChartData(
  pairs: string[],
  history: Record<string, PriceHistoryEntry[]>,
  normalizedMode: boolean,
): Array<Record<string, number>> {
  // Collect all unique timestamps across every pair
  const tsSet = new Set<number>()
  for (const pair of pairs) {
    const entries = history[pair] ?? []
    for (const e of entries) tsSet.add(e.timestamp)
  }
  const sortedTs = Array.from(tsSet).sort((a, b) => a - b)

  // Build a lookup: pair → timestamp → value
  const lookup: Record<string, Map<number, number>> = {}
  for (const pair of pairs) {
    const entries = history[pair] ?? []
    const map = new Map<number, number>()
    if (normalizedMode) {
      const normed = normalizeToPercent(entries)
      for (const { timestamp, value } of normed) map.set(timestamp, value)
    } else {
      for (const e of entries) map.set(e.timestamp, e.price)
    }
    lookup[pair] = map
  }

  // Merge into row objects
  return sortedTs.map((ts) => {
    const row: Record<string, number> = { timestamp: ts }
    for (const pair of pairs) {
      const val = lookup[pair]?.get(ts)
      if (val !== undefined) row[pair] = val
    }
    return row
  })
}

// ---------------------------------------------------------------------------
// Format timestamp for X-axis ticks
// ---------------------------------------------------------------------------
function formatTs(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------
interface MultiTooltipProps {
  active?: boolean
  payload?: Array<{ dataKey?: string | number; value?: number | string; color?: string }>
  label?: string | number
  pairs: string[]
  normalizedMode: boolean
  benchmarkPair?: string
}

function MultiTooltip({ active, payload, label, normalizedMode, benchmarkPair }: MultiTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const ts = typeof label === 'number' ? label : Number(label)
  const date = new Date(ts)
  const timeLabel = isNaN(date.getTime())
    ? String(label)
    : date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs shadow-xl min-w-[160px]">
      <p className="text-gray-400 mb-2">{timeLabel}</p>
      {payload.map((p) => {
        const isBenchmark = p.dataKey === benchmarkPair
        const val = typeof p.value === 'number' ? p.value : null
        return (
          <div key={p.dataKey} className="flex items-center justify-between gap-3 mb-1">
            <span className="flex items-center gap-1.5" style={{ color: p.color ?? '#fff' }}>
              {isBenchmark && (
                <span className="text-[10px] uppercase tracking-wide opacity-70">bm</span>
              )}
              {p.dataKey}
            </span>
            <span className="font-mono text-gray-100">
              {val !== null
                ? normalizedMode
                  ? `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`
                  : `$${formatPriceShort(val)}`
                : '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Legend row
// ---------------------------------------------------------------------------
interface LegendProps {
  pairs: string[]
  benchmarkPair?: string
}

function MultiLegend({ pairs, benchmarkPair }: LegendProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-4 mt-3"
      role="list"
      aria-label={`Chart series legend. Known oracle sources: ${SOURCE_BADGE_KEYS.join(', ')}.`}
    >
      {pairs.map((pair, idx) => {
        const color = SERIES_COLORS[idx % SERIES_COLORS.length] ?? '#06b6d4'
        const isBenchmark = pair === benchmarkPair
        return (
          <div
            key={pair}
            role="listitem"
            className="flex items-center gap-1.5 text-xs"
            style={{ color }}
          >
            {isBenchmark ? (
              // Dashed line indicator
              <svg width="20" height="10" aria-hidden="true">
                <line
                  x1="0"
                  y1="5"
                  x2="20"
                  y2="5"
                  stroke={color}
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
              </svg>
            ) : (
              <span className="inline-block w-5 h-0 border-t-2" style={{ borderColor: color }} />
            )}
            <span>
              {pair}
              {isBenchmark && (
                <span className="ml-1 text-[10px] uppercase tracking-wide opacity-60">benchmark</span>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const MultiPairOverlayChart = memo(function MultiPairOverlayChart({
  pairs,
  history,
  benchmarkPair,
  normalizedMode = false,
  onExport,
}: MultiPairOverlayChartProps) {
  const chartData = useMemo(
    () => buildChartData(pairs, history, normalizedMode),
    [pairs, history, normalizedMode],
  )

  const handleExport = useCallback(() => {
    if (!onExport) return
    const rows: ExportRow[] = chartData.map((row) => {
      const out: ExportRow = { timestamp: row['timestamp'] as number }
      for (const pair of pairs) {
        if (row[pair] !== undefined) out[pair] = row[pair] as number
      }
      return out
    })
    onExport(rows)
  }, [onExport, chartData, pairs])

  const gridStroke = '#1f2937'
  const tickFill = '#6b7280'

  // Y-axis formatter
  const yTickFormatter = useCallback(
    (v: number) => (normalizedMode ? `${v.toFixed(1)}%` : formatPriceShort(v)),
    [normalizedMode],
  )

  if (pairs.length === 0) {
    return (
      <div className="h-80 bg-gray-900/50 border border-gray-800 rounded-xl flex items-center justify-center text-gray-500 text-sm">
        No pairs selected
      </div>
    )
  }

  // Determine if we have any data at all
  const hasData = chartData.length > 0

  if (!hasData) {
    return (
      <div className="h-80 bg-gray-900/50 border border-gray-800 rounded-xl flex items-center justify-center text-gray-500 text-sm">
        No historical data available
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500 uppercase tracking-wider">
          Multi-Pair Comparison{normalizedMode ? ' — % Change' : ''}
        </p>
        {onExport && (
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg border text-gray-400 border-gray-700 hover:text-gray-200 hover:bg-gray-700 transition-colors"
            aria-label="Export chart data as CSV"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Export
          </button>
        )}
      </div>

      {/* Chart area */}
      <div
        className="h-72"
        role="img"
        aria-label={`Multi-pair overlay chart for ${pairs.join(', ')}${normalizedMode ? ' in normalized % change mode' : ''}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTs}
              tick={{ fill: tickFill, fontSize: 11 }}
              axisLine={{ stroke: gridStroke }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: tickFill, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={yTickFormatter}
              width={80}
            />
            <Tooltip
              content={
                <MultiTooltip
                  pairs={pairs}
                  normalizedMode={normalizedMode}
                  benchmarkPair={benchmarkPair}
                />
              }
            />
            {/* Zero reference line in normalized mode */}
            {normalizedMode && (
              <ReferenceLine
                y={0}
                stroke="#4b5563"
                strokeDasharray="4 2"
                label={{
                  value: '0%',
                  position: 'insideTopRight',
                  fill: '#6b7280',
                  fontSize: 10,
                }}
              />
            )}
            {/* Render a Line for each pair */}
            {pairs.map((pair) => {
              const color = colorForPair(pair, pairs)
              const isBenchmark = pair === benchmarkPair
              return (
                <Line
                  key={pair}
                  type="monotone"
                  dataKey={pair}
                  stroke={color}
                  strokeWidth={isBenchmark ? 1.5 : 2}
                  strokeDasharray={isBenchmark ? '5 3' : undefined}
                  dot={false}
                  activeDot={{ r: 4, fill: color }}
                  connectNulls
                  isAnimationActive={false}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <MultiLegend pairs={pairs} benchmarkPair={benchmarkPair} />

      {/* SR-only accessible table */}
      <div className="sr-only" aria-live="polite">
        <table aria-label={`Multi-pair overlay data for ${pairs.join(', ')}`}>
          <thead>
            <tr>
              <th scope="col">Timestamp</th>
              {pairs.map((p) => (
                <th key={p} scope="col">
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chartData.slice(0, 50).map((row, i) => (
              <tr key={i}>
                <td>{new Date(row['timestamp'] as number).toISOString()}</td>
                {pairs.map((p) => (
                  <td key={p}>{row[p] !== undefined ? String(row[p]) : '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
})
