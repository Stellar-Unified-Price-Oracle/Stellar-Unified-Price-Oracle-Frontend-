/**
 * @file alertAnalytics
 *
 * Utility functions for computing per-alert effectiveness statistics from the
 * fired-alert history log. These stats power the `AlertAnalyticsStrip` component
 * and the "Export Analytics" CSV download in AlertPanel.
 *
 * All functions are pure and side-effect-free — safe to call in render or
 * outside of React.
 */
import type { AlertHistoryEntry } from '../types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AlertStats {
  alertId: string
  /** Total number of times the alert has fired (from history slice). */
  fireCount: number
  /** Mean ms between consecutive fires. Null when fewer than 2 fires. */
  avgTimeToFire: number | null
  /** Maximum ms between consecutive fires. Null when fewer than 2 fires. */
  maxTimeToFire: number | null
  /** Unix ms of the first recorded fire. Null when no history. */
  firstFiredAt: number | null
  /** Unix ms of the most recent fire. Null when no history. */
  lastFiredAt: number | null
  /**
   * Fires per day since alert creation.
   * Uses a minimum of 1 day to avoid division by near-zero for brand-new alerts.
   * NaN when `createdAt` is unavailable.
   */
  hitRate: number
  /** Advisory hint about threshold calibration, or null if no clear issue. */
  thresholdHint: ThresholdHint | null
}

export type ThresholdHint =
  | { type: 'too_close'; message: string }
  | { type: 'too_far'; message: string }
  | { type: 'high_false_positive'; message: string }
  | { type: 'good_calibration'; message: string }

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000

// ---------------------------------------------------------------------------
// Exported utilities
// ---------------------------------------------------------------------------

/**
 * Formats a duration in milliseconds as a human-readable string.
 *
 * @example
 * formatTimeDuration(3_661_000) // '1h 1m'
 * formatTimeDuration(86_400_000) // '1d 0h'
 */
export function formatTimeDuration(ms: number): string {
  if (ms < 0) ms = 0

  const totalSeconds = Math.floor(ms / 1000)
  const totalMinutes = Math.floor(totalSeconds / 60)
  const totalHours = Math.floor(totalMinutes / 60)
  const days = Math.floor(totalHours / 24)

  if (days >= 1) {
    const remainingHours = totalHours - days * 24
    return `${days}d ${remainingHours}h`
  }

  const hours = totalHours
  const minutes = totalMinutes - hours * 60
  return `${hours}h ${minutes}m`
}

/**
 * Computes a threshold-calibration hint for a single alert based on its
 * fire history, age, and current market price.
 *
 * Exported for unit-testing; consumers should prefer calling `computeAlertStats`
 * which calls this internally.
 */
export function computeThresholdHint(
  alert: {
    id: string
    upperThreshold: number | null
    lowerThreshold: number | null
    createdAt: number
    percentageMode: boolean
    percentageThreshold: number | null
  },
  history: AlertHistoryEntry[],
  currentPrice?: number,
): ThresholdHint | null {
  const alertHistory = history.filter((h) => h.alertId === alert.id)
  const fireCount = alertHistory.length
  const ageMs = Date.now() - alert.createdAt
  const ageDays = Math.max(ageMs / MS_PER_DAY, 1 / MS_PER_DAY) // avoid zero
  const hitRate = fireCount / Math.max(ageDays, 1)

  // 1. Threshold is right next to current price — will fire immediately or never
  if (fireCount === 0 && currentPrice != null && !alert.percentageMode) {
    const upper = alert.upperThreshold
    const lower = alert.lowerThreshold
    const thresholdToCheck = upper ?? lower
    if (thresholdToCheck != null) {
      const diff = Math.abs(thresholdToCheck - currentPrice) / currentPrice
      if (diff <= 0.001) {
        return {
          type: 'too_close',
          message: 'Threshold is within 0.1% of current price — likely to fire immediately or never.',
        }
      }
    }
  }

  // 2. Fired a lot in under 24 hours → likely noisy threshold
  if (fireCount > 20 && ageMs < MS_PER_DAY) {
    return {
      type: 'high_false_positive',
      message: 'Fired more than 20 times in under 24 hours — consider widening the threshold.',
    }
  }

  // 3. High fire rate over the lifetime of the alert
  if (hitRate > 5) {
    return {
      type: 'high_false_positive',
      message: 'High fire frequency — consider a wider threshold or longer cooldown.',
    }
  }

  // 4. Fires at a sensible cadence
  if (fireCount >= 1 && fireCount <= 10 && hitRate < 3) {
    return {
      type: 'good_calibration',
      message: 'Well-calibrated threshold — firing at a reasonable rate.',
    }
  }

  // 5. Never fired and the alert is stale
  if (fireCount === 0 && ageMs > 7 * MS_PER_DAY) {
    return {
      type: 'too_far',
      message: 'Alert has never fired in 7+ days — threshold may be set too far from the price range.',
    }
  }

  return null
}

/**
 * Computes effectiveness statistics for a single alert from its history slice.
 *
 * @param alert  - The alert to analyse (only metadata fields are needed).
 * @param history - The full `alertHistory` array from `useAlerts`; this function
 *                  filters it to entries belonging to `alert.id`.
 * @param currentPrice - Optional live price for the asset, used to detect
 *                       thresholds that are dangerously close to the market.
 */
export function computeAlertStats(
  alert: {
    id: string
    upperThreshold: number | null
    lowerThreshold: number | null
    createdAt: number
    percentageMode: boolean
    percentageThreshold: number | null
  },
  history: AlertHistoryEntry[],
  currentPrice?: number,
): AlertStats {
  // Filter and sort ascending by trigger time
  const entries = history
    .filter((h) => h.alertId === alert.id)
    .sort((a, b) => a.triggeredAt - b.triggeredAt)

  const fireCount = entries.length

  // Compute inter-fire intervals
  let avgTimeToFire: number | null = null
  let maxTimeToFire: number | null = null

  if (fireCount >= 2) {
    const intervals: number[] = []
    for (let i = 1; i < entries.length; i++) {
      intervals.push(entries[i].triggeredAt - entries[i - 1].triggeredAt)
    }
    const sum = intervals.reduce((acc, v) => acc + v, 0)
    avgTimeToFire = sum / intervals.length
    maxTimeToFire = Math.max(...intervals)
  }

  const firstFiredAt = entries.length > 0 ? entries[0].triggeredAt : null
  const lastFiredAt = entries.length > 0 ? entries[entries.length - 1].triggeredAt : null

  // Fires per day; use 1 day minimum to prevent inflated rates for brand-new alerts
  const ageMs = Date.now() - alert.createdAt
  const ageDays = Math.max(ageMs / MS_PER_DAY, 1)
  const hitRate = fireCount / ageDays

  const thresholdHint = computeThresholdHint(alert, history, currentPrice)

  return {
    alertId: alert.id,
    fireCount,
    avgTimeToFire,
    maxTimeToFire,
    firstFiredAt,
    lastFiredAt,
    hitRate,
    thresholdHint,
  }
}

/**
 * Converts an `AlertStats` object to a flat record suitable for CSV export.
 *
 * Numeric durations are expressed in milliseconds; the hint type is stored as
 * its string discriminant so spreadsheet consumers can filter on it.
 */
export function alertStatsToExportRow(stats: AlertStats): Record<string, string | number> {
  return {
    alertId: stats.alertId,
    fireCount: stats.fireCount,
    avgTimeToFire: stats.avgTimeToFire ?? '',
    maxTimeToFire: stats.maxTimeToFire ?? '',
    hitRatePerDay: isNaN(stats.hitRate) ? '' : Number(stats.hitRate.toFixed(4)),
    thresholdHint: stats.thresholdHint?.type ?? '',
  }
}
