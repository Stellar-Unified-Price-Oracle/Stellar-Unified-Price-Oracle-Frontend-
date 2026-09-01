/**
 * @file SourceHistoryDrilldown
 *
 * Modal dialog that displays a detailed history chart and summary statistics
 * for a single oracle source. Opened by the ReliabilityLeaderboard when a
 * user clicks "Details" on a table row.
 *
 * The chart shows the source's contribution percentage bucketed into hourly
 * intervals — i.e. for each hour-bucket that has history entries, the
 * percentage of entries where `sources` included this source.
 */
import { memo, useMemo, useEffect, useCallback, type ReactElement } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { PriceHistoryEntry } from '../types'

// ── Props ─────────────────────────────────────────────────────────────────────

interface SourceHistoryDrilldownProps {
  /** The oracle source identifier (e.g. 'chainlink'). */
  source: string
  /** All available price history entries across asset pairs. */
  history: PriceHistoryEntry[]
  /** Called when the modal should close (Escape key or backdrop/button click). */
  onClose: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const HOUR_MS = 60 * 60 * 1000

function floorToHour(ts: number): number {
  return Math.floor(ts / HOUR_MS) * HOUR_MS
}

function formatHour(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:00`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Component ─────────────────────────────────────────────────────────────────

export const SourceHistoryDrilldown = memo(function SourceHistoryDrilldown({
  source,
  history,
  onClose,
}: SourceHistoryDrilldownProps): ReactElement {
  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // ── Derived stats ────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (history.length === 0) {
      return {
        totalPoints: 0,
        avgConfidence: null as number | null,
        firstSeen: null as number | null,
        lastSeen: null as number | null,
        chartData: [] as Array<{ hour: number; label: string; contributionPct: number }>,
      }
    }

    const totalPoints = history.length

    // Confidence is 0–1 scale
    const avgConfidence =
      history.reduce((sum, e) => sum + e.confidence, 0) / totalPoints

    const timestamps = history.map((e) => e.timestamp)
    const firstSeen = Math.min(...timestamps)
    const lastSeen = Math.max(...timestamps)

    // Group into hourly buckets and compute contribution %
    const buckets = new Map<number, { total: number; present: number }>()
    for (const entry of history) {
      const bucket = floorToHour(entry.timestamp)
      const existing = buckets.get(bucket) ?? { total: 0, present: 0 }
      existing.total += 1
      if (entry.sources.includes(source)) {
        existing.present += 1
      }
      buckets.set(bucket, existing)
    }

    const chartData = Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, { total, present }]) => ({
        hour,
        label: formatHour(hour),
        contributionPct: total > 0 ? Math.round((present / total) * 100) : 0,
      }))

    return { totalPoints, avgConfidence, firstSeen, lastSeen, chartData }
  }, [history, source])

  // ── Backdrop click ───────────────────────────────────────────────────────

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose],
  )

  // ── Render ───────────────────────────────────────────────────────────────

  const sourceLabel = capitalize(source)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${sourceLabel} history drilldown`}
        className="relative w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <h2 className="text-lg font-semibold text-gray-100">
            {sourceLabel} — History Drilldown
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drilldown"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Total data points"
              value={stats.totalPoints.toLocaleString()}
            />
            <StatCard
              label="Avg confidence"
              value={
                stats.avgConfidence !== null
                  ? `${(stats.avgConfidence * 100).toFixed(1)}%`
                  : '—'
              }
            />
            <StatCard
              label="First seen"
              value={
                stats.firstSeen !== null
                  ? formatHour(stats.firstSeen)
                  : '—'
              }
            />
            <StatCard
              label="Last seen"
              value={
                stats.lastSeen !== null
                  ? formatHour(stats.lastSeen)
                  : '—'
              }
            />
          </div>

          {/* Contribution chart */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">
              Contribution % per hour
            </h3>
            {stats.chartData.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">
                No history data available for this source.
              </p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={stats.chartData}
                    margin={{ top: 4, right: 8, left: -16, bottom: 4 }}
                  >
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      interval="preserveStartEnd"
                      tickLine={false}
                      axisLine={{ stroke: '#374151' }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#111827',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#f3f4f6',
                        fontSize: 12,
                      }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any) => [`${value}%`, 'Contribution'] as [string, string]}
                      labelStyle={{ color: '#9ca3af' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="contributionPct"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#22d3ee' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 shrink-0 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
})

// ── Sub-component: StatCard ───────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string
}

const StatCard = memo(function StatCard({ label, value }: StatCardProps): ReactElement {
  return (
    <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-3 flex flex-col gap-1">
      <span className="text-xs text-gray-500 leading-none">{label}</span>
      <span className="text-sm font-semibold text-gray-100 leading-snug">{value}</span>
    </div>
  )
})
