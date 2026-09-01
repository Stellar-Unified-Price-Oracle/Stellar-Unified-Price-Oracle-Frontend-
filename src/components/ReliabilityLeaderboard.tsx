/**
 * @file ReliabilityLeaderboard
 *
 * Panel that ranks oracle sources by reliability metrics computed from live
 * health status and historical price-feed data.
 *
 * Columns: Rank | Source | Status | Uptime % | Mean Latency (ms) | Staleness | Trend
 *
 * Time-window buttons (24h / 7d / 30d) control which slice of priceHistory is
 * used for metric computation. An Export button downloads the current metrics
 * as CSV. Clicking "Details" on any row opens a SourceHistoryDrilldown modal.
 */
import { memo, useState, useMemo, useCallback, type ReactElement } from 'react'
import type { SourceHealth, PriceHistoryEntry } from '../types'
import { SOURCE_COLORS } from '../utils/sourceColors'
import { computeSourceMetrics, exportLeaderboardCsv } from '../utils/export'
import type { SourceReliabilityMetric } from '../utils/export'
import { SourceHistoryDrilldown } from './SourceHistoryDrilldown'

// ── Types ─────────────────────────────────────────────────────────────────────

type TimeWindow = '24h' | '7d' | '30d'

// ── Constants ─────────────────────────────────────────────────────────────────

const WINDOW_LABELS: Record<TimeWindow, string> = {
  '24h': '24 h',
  '7d': '7 d',
  '30d': '30 d',
}

const WINDOW_MS: Record<TimeWindow, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

const STATUS_STYLES: Record<SourceHealth['status'], string> = {
  healthy: 'bg-green-500/15 text-green-400 border-green-500/30',
  degraded: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  down: 'bg-red-500/15 text-red-400 border-red-500/30',
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface TrendIconProps {
  trend: SourceReliabilityMetric['trend']
}

const TrendIcon = memo(function TrendIcon({ trend }: TrendIconProps): ReactElement {
  if (trend === 'up') {
    return (
      <span className="inline-flex items-center gap-1 text-green-400 text-xs font-medium">
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 3l5 5H3l5-5z" />
        </svg>
        Up
      </span>
    )
  }
  if (trend === 'down') {
    return (
      <span className="inline-flex items-center gap-1 text-red-400 text-xs font-medium">
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 13l-5-5h10l-5 5z" />
        </svg>
        Down
      </span>
    )
  }
  return <span className="text-gray-500 text-xs">—</span>
})

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ReliabilityLeaderboardProps {
  /** Current health status objects for each known oracle source. */
  sourceHealths: SourceHealth[]
  /**
   * Price history keyed by asset pair. Used to derive uptime, trend, and
   * contribution metrics. Optional — latency-only view is shown when absent.
   */
  priceHistory?: Record<string, PriceHistoryEntry[]>
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ReliabilityLeaderboard = memo(function ReliabilityLeaderboard({
  sourceHealths,
  priceHistory = {},
}: ReliabilityLeaderboardProps): ReactElement {
  const [window, setWindow] = useState<TimeWindow>('24h')
  const [drilldownSource, setDrilldownSource] = useState<string | null>(null)

  // Flatten all history entries for the drilldown modal
  const allHistory = useMemo<PriceHistoryEntry[]>(() => {
    return Object.values(priceHistory).flat()
  }, [priceHistory])

  // Compute sorted metrics for the current time window
  const metrics = useMemo<SourceReliabilityMetric[]>(() => {
    return computeSourceMetrics(sourceHealths, priceHistory, WINDOW_MS[window])
  }, [sourceHealths, priceHistory, window])

  // Build a lookup from source → SourceHealth for the status badge
  const healthBySource = useMemo<Map<string, SourceHealth>>(() => {
    const map = new Map<string, SourceHealth>()
    for (const sh of sourceHealths) {
      map.set(sh.source, sh)
    }
    return map
  }, [sourceHealths])

  const handleExport = useCallback(() => {
    exportLeaderboardCsv(metrics)
  }, [metrics])

  const handleDrilldown = useCallback((source: string) => {
    setDrilldownSource(source)
  }, [])

  const handleCloseDrilldown = useCallback(() => {
    setDrilldownSource(null)
  }, [])

  // History entries for the selected drilldown source (filtered to the time window)
  const drilldownHistory = useMemo<PriceHistoryEntry[]>(() => {
    if (!drilldownSource) return []
    const cutoff = Date.now() - WINDOW_MS[window]
    return allHistory.filter((e) => e.timestamp >= cutoff)
  }, [drilldownSource, allHistory, window])

  return (
    <>
      <section
        aria-label="Source reliability leaderboard"
        className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"
      >
        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-gray-100">
              Reliability Leaderboard
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Ranked by uptime over the selected window
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Window selector */}
            <div
              role="group"
              aria-label="Time window"
              className="flex items-center bg-gray-800 rounded-lg p-0.5 gap-0.5"
            >
              {(Object.keys(WINDOW_LABELS) as TimeWindow[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWindow(w)}
                  aria-pressed={window === w}
                  className={[
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                    window === w
                      ? 'bg-gray-700 text-gray-100'
                      : 'text-gray-400 hover:text-gray-200',
                  ].join(' ')}
                >
                  {WINDOW_LABELS[w]}
                </button>
              ))}
            </div>

            {/* Export button */}
            <button
              type="button"
              onClick={handleExport}
              disabled={metrics.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
                />
              </svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* ── Table ── */}
        {metrics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
            <svg
              className="w-10 h-10 text-gray-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <p className="text-sm">No source data available</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Source reliability metrics">
              <thead>
                <tr className="border-b border-gray-800">
                  {[
                    'Rank',
                    'Source',
                    'Status',
                    'Uptime %',
                    'Mean Latency (ms)',
                    'Staleness',
                    'Trend',
                    '',
                  ].map((col) => (
                    <th
                      key={col}
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric, idx) => {
                  const health = healthBySource.get(metric.source)
                  const status = health?.status ?? 'down'
                  const sourceLower = metric.source.toLowerCase()
                  const badgeClasses = SOURCE_COLORS[sourceLower] ?? 'bg-gray-700/30 text-gray-400 border-gray-600/30'

                  return (
                    <tr
                      key={metric.source}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                    >
                      {/* Rank */}
                      <td className="px-4 py-3 text-gray-500 font-mono tabular-nums">
                        {idx + 1}
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3">
                        <span
                          className={[
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                            badgeClasses,
                          ].join(' ')}
                        >
                          {capitalize(metric.source)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={[
                            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border',
                            STATUS_STYLES[status],
                          ].join(' ')}
                        >
                          <span
                            className={[
                              'w-1.5 h-1.5 rounded-full',
                              status === 'healthy'
                                ? 'bg-green-400'
                                : status === 'degraded'
                                  ? 'bg-yellow-400'
                                  : 'bg-red-400',
                            ].join(' ')}
                          />
                          {capitalize(status)}
                        </span>
                      </td>

                      {/* Uptime % */}
                      <td className="px-4 py-3 tabular-nums">
                        <UptimeBar percent={metric.uptimePercent} />
                      </td>

                      {/* Mean Latency */}
                      <td className="px-4 py-3 text-gray-300 tabular-nums font-mono">
                        {metric.meanLatencyMs !== null
                          ? `${Math.round(metric.meanLatencyMs)} ms`
                          : <span className="text-gray-600">—</span>}
                      </td>

                      {/* Staleness */}
                      <td className="px-4 py-3 text-gray-300 tabular-nums font-mono">
                        <StalenessLabel ms={metric.stalenessMs} />
                      </td>

                      {/* Trend */}
                      <td className="px-4 py-3">
                        <TrendIcon trend={metric.trend} />
                      </td>

                      {/* Details button */}
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleDrilldown(metric.source)}
                          className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline transition-colors"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Drilldown Modal ── */}
      {drilldownSource !== null && (
        <SourceHistoryDrilldown
          source={drilldownSource}
          history={drilldownHistory}
          onClose={handleCloseDrilldown}
        />
      )}
    </>
  )
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface UptimeBarProps {
  percent: number
}

const UptimeBar = memo(function UptimeBar({ percent }: UptimeBarProps): ReactElement {
  const clamped = Math.min(100, Math.max(0, percent))
  const color =
    clamped >= 99
      ? 'bg-green-500'
      : clamped >= 90
        ? 'bg-yellow-500'
        : 'bg-red-500'

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-gray-300 text-xs">{clamped.toFixed(1)}%</span>
    </div>
  )
})

interface StalenessLabelProps {
  ms: number
}

const StalenessLabel = memo(function StalenessLabel({ ms }: StalenessLabelProps): ReactElement {
  if (ms <= 0) {
    return <span className="text-gray-600">—</span>
  }
  if (ms < 60_000) {
    return <span className="text-gray-300">{Math.round(ms / 1000)}s ago</span>
  }
  if (ms < 3_600_000) {
    return <span className="text-gray-300">{Math.round(ms / 60_000)}m ago</span>
  }
  return <span className="text-gray-400">{Math.round(ms / 3_600_000)}h ago</span>
})
