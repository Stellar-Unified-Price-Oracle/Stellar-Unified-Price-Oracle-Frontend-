/**
 * @file Anomaly detection for sudden price moves (#463).
 *
 * Three detectors run over a PriceHistoryEntry array:
 *  1. **z-score** – tick price vs rolling mean/stddev of a configurable window
 *  2. **gap** – absolute percentage jump vs previous tick
 *  3. **source-count drop** – active oracle count falls below previous tick
 *
 * Results are deterministic: same inputs always produce same outputs, making them
 * straightforward to unit-test against synthetic series.
 */

import type { PriceHistoryEntry } from '../types/price'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Human-readable reason category for a detected anomaly. */
export type AnomalyReason = 'zscore' | 'gap' | 'source-drop'

/** A single anomaly event attached to a price history tick. */
export interface AnomalyEvent {
  /** Index into the input array. */
  index: number
  /** Unix timestamp (ms) of the anomalous tick. */
  timestamp: number
  /** Price at the anomalous tick. */
  price: number
  /** Which detector(s) flagged this tick. Multiple can fire on the same tick. */
  reasons: AnomalyReason[]
  /** Human-readable explanation suitable for display. */
  explanation: string
  /** z-score magnitude when the z-score detector fired, else undefined. */
  zScore?: number
  /** Absolute % change from previous tick when the gap detector fired, else undefined. */
  gapPercent?: number
  /** Previous oracle count when the source-drop detector fired, else undefined. */
  prevSourceCount?: number
  /** Current oracle count when the source-drop detector fired, else undefined. */
  sourceCount?: number
}

/** Tuning options for all three detectors. */
export interface AnomalyDetectionOptions {
  /**
   * Number of prior ticks used to build the rolling mean/stddev for z-score
   * comparison. Minimum 3. Default 20.
   */
  zScoreWindow?: number
  /**
   * Number of standard deviations beyond which a tick is considered anomalous.
   * Default 3.
   */
  zScoreThreshold?: number
  /**
   * Minimum absolute percentage change between consecutive ticks that counts as
   * a "gap" anomaly. Default 5 (= 5%).
   */
  gapThresholdPercent?: number
  /**
   * Whether to flag ticks whose oracle source count drops below the previous
   * tick's count. Default true.
   */
  detectSourceDrop?: boolean
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

function stddev(values: number[], avg: number): number {
  if (values.length < 2) return 0
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function buildExplanation(reasons: AnomalyReason[], zScore?: number, gapPercent?: number, prevCount?: number, count?: number): string {
  const parts: string[] = []
  if (reasons.includes('zscore') && zScore !== undefined) {
    parts.push(`Price is ${Math.abs(zScore).toFixed(1)}σ from recent average (z-score anomaly)`)
  }
  if (reasons.includes('gap') && gapPercent !== undefined) {
    const dir = gapPercent >= 0 ? 'up' : 'down'
    parts.push(`Price jumped ${dir} ${Math.abs(gapPercent).toFixed(2)}% from previous tick`)
  }
  if (reasons.includes('source-drop') && prevCount !== undefined && count !== undefined) {
    parts.push(`Oracle count dropped from ${prevCount} to ${count} (possible source exclusion or outage)`)
  }
  return parts.join('; ')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect anomalous ticks in a price history array.
 *
 * @param history - Ordered price history entries, oldest first.
 * @param options - Detector tuning. Uses safe defaults when omitted.
 * @returns Array of anomaly events, one per flagged tick (may be empty).
 */
export function detectAnomalies(
  history: PriceHistoryEntry[],
  options: AnomalyDetectionOptions = {},
): AnomalyEvent[] {
  const {
    zScoreWindow = 20,
    zScoreThreshold = 3,
    gapThresholdPercent = 5,
    detectSourceDrop = true,
  } = options

  const window = Math.max(3, zScoreWindow)
  const anomalies: AnomalyEvent[] = []

  for (let i = 1; i < history.length; i++) {
    const tick = history[i]
    const prev = history[i - 1]
    const reasons: AnomalyReason[] = []
    let zScore: number | undefined
    let gapPercent: number | undefined
    let prevSourceCount: number | undefined
    let sourceCount: number | undefined

    // ── 1. z-score detector ────────────────────────────────────────────────
    if (i >= 3) {
      const start = Math.max(0, i - window)
      const windowPrices = history.slice(start, i).map((e) => e.price)
      const avg = mean(windowPrices)
      const sd = stddev(windowPrices, avg)
      if (sd > 0) {
        zScore = (tick.price - avg) / sd
        if (Math.abs(zScore) >= zScoreThreshold) {
          reasons.push('zscore')
        }
      }
    }

    // ── 2. gap detector ────────────────────────────────────────────────────
    if (prev.price !== 0) {
      gapPercent = ((tick.price - prev.price) / prev.price) * 100
      if (Math.abs(gapPercent) >= gapThresholdPercent) {
        reasons.push('gap')
      }
    }

    // ── 3. source-count drop detector ──────────────────────────────────────
    if (detectSourceDrop) {
      prevSourceCount = prev.sources.length
      sourceCount = tick.sources.length
      if (sourceCount < prevSourceCount) {
        reasons.push('source-drop')
      }
    }

    if (reasons.length > 0) {
      anomalies.push({
        index: i,
        timestamp: tick.timestamp,
        price: tick.price,
        reasons,
        explanation: buildExplanation(reasons, zScore, gapPercent, prevSourceCount, sourceCount),
        zScore: reasons.includes('zscore') ? zScore : undefined,
        gapPercent: reasons.includes('gap') ? gapPercent : undefined,
        prevSourceCount: reasons.includes('source-drop') ? prevSourceCount : undefined,
        sourceCount: reasons.includes('source-drop') ? sourceCount : undefined,
      })
    }
  }

  return anomalies
}

/**
 * Returns the AnomalyEvent (if any) for a specific timestamp.
 * Useful for tooltip lookups without re-running full detection.
 */
export function findAnomalyAtTimestamp(
  anomalies: AnomalyEvent[],
  timestamp: number,
): AnomalyEvent | undefined {
  return anomalies.find((a) => a.timestamp === timestamp)
}

/**
 * Severity level for badge/colour rendering.
 *
 * - `critical` — both z-score AND gap fired, or z-score ≥ 5σ
 * - `warning`  — single detector fired
 */
export function anomalySeverity(event: AnomalyEvent): 'critical' | 'warning' {
  if (
    (event.reasons.includes('zscore') && event.reasons.includes('gap')) ||
    (event.zScore !== undefined && Math.abs(event.zScore) >= 5)
  ) {
    return 'critical'
  }
  return 'warning'
}
