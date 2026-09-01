/**
 * @file AlertAnalyticsStrip
 *
 * A compact inline strip that renders key effectiveness statistics for a single
 * alert: fire count, hit rate, average interval between fires, and an optional
 * threshold-calibration hint badge.
 *
 * Intended to be placed directly below an alert's condition text inside
 * `AlertPanel`, so it must be small and horizontally scrollable on narrow screens.
 *
 * @example
 * ```tsx
 * const stats = computeAlertStats(alert, alertHistory)
 * <AlertAnalyticsStrip alertId={alert.id} stats={stats} />
 * ```
 *
 * ## Accessibility
 * Every visible metric has a visually-hidden `<span>` label so screen readers
 * announce the metric name along with its value.
 */
import { memo, type ReactElement } from 'react'
import type { AlertStats, ThresholdHint } from '../utils/alertAnalytics'
import { formatTimeDuration } from '../utils/alertAnalytics'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const HINT_STYLES: Record<ThresholdHint['type'], string> = {
  too_close: 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30',
  too_far: 'bg-gray-700/50 text-gray-400 border border-gray-600/40',
  high_false_positive: 'bg-red-500/15 text-red-300 border border-red-500/30',
  good_calibration: 'bg-green-500/15 text-green-300 border border-green-500/30',
}

const HINT_ICONS: Record<ThresholdHint['type'], string> = {
  too_close: '⚡',
  too_far: '📡',
  high_false_positive: '⚠️',
  good_calibration: '✓',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface AlertAnalyticsStripProps {
  alertId: string
  stats: AlertStats
}

function AlertAnalyticsStripBase({ stats }: AlertAnalyticsStripProps): ReactElement {
  const hitRateDisplay = isNaN(stats.hitRate)
    ? '—'
    : stats.hitRate < 0.1
      ? `${(stats.hitRate * 30).toFixed(1)}/mo`
      : `${stats.hitRate.toFixed(1)}/day`

  const avgDisplay = stats.avgTimeToFire != null ? formatTimeDuration(stats.avgTimeToFire) : null

  return (
    <div
      className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[11px] text-gray-500"
      aria-label="Alert analytics"
    >
      {/* Fire count */}
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-medium ${
        stats.fireCount > 0
          ? 'bg-orange-500/15 text-orange-300'
          : 'bg-gray-700/40 text-gray-500'
      }`}>
        <span className="sr-only">Fire count: </span>
        <svg className="w-2.5 h-2.5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/>
        </svg>
        {stats.fireCount === 0 ? 'No fires' : `${stats.fireCount} ${stats.fireCount === 1 ? 'fire' : 'fires'}`}
      </span>

      {/* Hit rate */}
      <span className="inline-flex items-center gap-1">
        <span className="sr-only">Hit rate: </span>
        <svg className="w-2.5 h-2.5 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        {hitRateDisplay}
      </span>

      {/* Avg time between fires */}
      {avgDisplay != null && (
        <span className="inline-flex items-center gap-1">
          <span className="sr-only">Average time between fires: </span>
          <svg className="w-2.5 h-2.5 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>avg {avgDisplay}</span>
        </span>
      )}

      {/* Threshold hint */}
      {stats.thresholdHint != null && (
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-medium ${HINT_STYLES[stats.thresholdHint.type]}`}
          title={stats.thresholdHint.message}
          role="status"
          aria-label={`Threshold hint: ${stats.thresholdHint.message}`}
        >
          <span aria-hidden="true">{HINT_ICONS[stats.thresholdHint.type]}</span>
          <span className="sr-only">Threshold hint: </span>
          {stats.thresholdHint.type === 'too_close' && 'Too close'}
          {stats.thresholdHint.type === 'too_far' && 'No activity'}
          {stats.thresholdHint.type === 'high_false_positive' && 'Noisy'}
          {stats.thresholdHint.type === 'good_calibration' && 'Well-calibrated'}
        </span>
      )}
    </div>
  )
}

export const AlertAnalyticsStrip = memo(AlertAnalyticsStripBase)
