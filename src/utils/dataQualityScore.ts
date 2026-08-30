/**
 * Data Quality Scorecard — per-pair feed quality computation.
 *
 * Computes a deterministic 0–100 composite quality score for a price feed
 * from four orthogonal factors:
 *
 *   1. **Freshness**   — how recently the latest price was published
 *   2. **Confidence**  — the aggregator's confidence score (0–1)
 *   3. **Deviation**   — how stable prices are over the window (low CV = good)
 *   4. **Source coverage** — how many oracle sources were active
 *
 * Each factor produces a sub-score in [0, 100] and is weighted. The final
 * score is `Math.round(weightedSum)`, so it is always an integer.
 *
 * All functions are pure and have no side-effects — safe to call inside
 * `useMemo`, workers, or tests.
 */

import type { PriceHistoryEntry } from '../types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum "fresh" age in milliseconds. Older than this → freshness = 0. */
export const FRESHNESS_MAX_AGE_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Known oracle source identifiers used to calculate the maximum possible
 * source-coverage denominator.
 */
export const KNOWN_SOURCES = ['chainlink', 'redstone', 'band', 'reflector'] as const

/** Weights assigned to each factor. Must sum to 1. */
export const FACTOR_WEIGHTS = {
  freshness: 0.3,
  confidence: 0.3,
  deviation: 0.2,
  sourceCoverage: 0.2,
} as const

// ---------------------------------------------------------------------------
// Per-factor sub-scores
// ---------------------------------------------------------------------------

/**
 * Freshness sub-score (0–100).
 *
 * Linear decay from 100 at `ageMs = 0` to 0 at `ageMs = FRESHNESS_MAX_AGE_MS`.
 * Clamped to [0, 100].
 *
 * @param latestTimestamp  Unix timestamp (ms) of the most recent price entry.
 * @param nowMs            Current time in milliseconds (injectable for tests).
 */
export function computeFreshnessScore(latestTimestamp: number, nowMs: number = Date.now()): number {
  const ageMs = Math.max(0, nowMs - latestTimestamp)
  const ratio = 1 - ageMs / FRESHNESS_MAX_AGE_MS
  return Math.round(Math.min(100, Math.max(0, ratio * 100)))
}

/**
 * Confidence sub-score (0–100).
 *
 * Averages the confidence values (0–1 range) across all entries in the
 * window and maps to [0, 100].
 *
 * @param entries  Historical entries in the selected range.
 */
export function computeConfidenceScore(entries: PriceHistoryEntry[]): number {
  if (entries.length === 0) return 0
  const avg = entries.reduce((sum, e) => sum + e.confidence, 0) / entries.length
  return Math.round(Math.min(100, Math.max(0, avg * 100)))
}

/**
 * Deviation sub-score (0–100).
 *
 * Measures price stability via the **coefficient of variation** (CV):
 *   CV = stdDev / mean
 *
 * Mapping:
 *   - CV ≤ 0      → 100  (perfectly stable)
 *   - CV ≥ 0.05   → 0    (≥ 5 % relative volatility — very unstable)
 *   - Linear interpolation in between.
 *
 * A single-entry window returns 100 (no observable deviation).
 *
 * @param entries  Historical entries in the selected range.
 */
export function computeDeviationScore(entries: PriceHistoryEntry[]): number {
  if (entries.length <= 1) return 100

  const mean = entries.reduce((sum, e) => sum + e.price, 0) / entries.length
  if (mean === 0) return 0

  const variance =
    entries.reduce((sum, e) => sum + Math.pow(e.price - mean, 2), 0) / entries.length
  const stdDev = Math.sqrt(variance)
  const cv = stdDev / mean

  // CV threshold at which score hits zero
  const CV_MAX = 0.05
  const ratio = 1 - cv / CV_MAX
  return Math.round(Math.min(100, Math.max(0, ratio * 100)))
}

/**
 * Source-coverage sub-score (0–100).
 *
 * Counts the mean number of distinct oracle sources seen per entry in the
 * window, then scales by the total known sources.
 *
 * A feed backed by all 4 known sources at every point → 100.
 * A feed with 0 entries → 0.
 *
 * @param entries  Historical entries in the selected range.
 */
export function computeSourceCoverageScore(entries: PriceHistoryEntry[]): number {
  if (entries.length === 0) return 0

  const avgSources =
    entries.reduce((sum, e) => sum + e.sources.length, 0) / entries.length

  const maxSources = KNOWN_SOURCES.length
  return Math.round(Math.min(100, Math.max(0, (avgSources / maxSources) * 100)))
}

// ---------------------------------------------------------------------------
// Composite score
// ---------------------------------------------------------------------------

/** Scores for each contributing factor, each in [0, 100]. */
export interface QualityFactors {
  /** How recently the latest price was published (linear decay, 5-min horizon). */
  freshness: number
  /** Average aggregator confidence over the window. */
  confidence: number
  /** Price stability — low coefficient of variation → high score. */
  deviation: number
  /** Mean oracle source count scaled to the known-source maximum. */
  sourceCoverage: number
}

/** Full result returned by {@link computeQualityScore}. */
export interface QualityScoreResult {
  /** Composite score [0, 100]. */
  score: number
  /** Per-factor breakdown. */
  factors: QualityFactors
  /** Human-readable label derived from the composite score. */
  label: 'Excellent' | 'Good' | 'Fair' | 'Poor'
  /** Tailwind colour token for the score band. */
  colorClass: string
}

/**
 * Derive a human-readable quality band label from a composite score.
 *
 * | Range   | Label     |
 * |---------|-----------|
 * | 80–100  | Excellent |
 * | 60–79   | Good      |
 * | 40–59   | Fair      |
 * | 0–39    | Poor      |
 */
export function scoreToLabel(score: number): QualityScoreResult['label'] {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  return 'Poor'
}

/**
 * Map a quality label to a Tailwind CSS colour class pair
 * (`text-*` and `border-*` tokens) for use in the scorecard UI.
 */
export function labelToColorClass(label: QualityScoreResult['label']): string {
  switch (label) {
    case 'Excellent': return 'text-emerald-400 border-emerald-500/40'
    case 'Good':      return 'text-cyan-400 border-cyan-500/40'
    case 'Fair':      return 'text-yellow-400 border-yellow-500/40'
    case 'Poor':      return 'text-red-400 border-red-500/40'
  }
}

/**
 * Compute the composite data-quality score and factor breakdown for a feed.
 *
 * The result is **deterministic** for a given `(entries, latestTimestamp, nowMs)`
 * triple — the same input always produces the same output.
 *
 * @param entries          Historical price entries in the selected range.
 * @param latestTimestamp  Unix timestamp (ms) of the most recent published price.
 * @param nowMs            Current time override (default: `Date.now()`).
 */
export function computeQualityScore(
  entries: PriceHistoryEntry[],
  latestTimestamp: number,
  nowMs: number = Date.now(),
): QualityScoreResult {
  const factors: QualityFactors = {
    freshness:      computeFreshnessScore(latestTimestamp, nowMs),
    confidence:     computeConfidenceScore(entries),
    deviation:      computeDeviationScore(entries),
    sourceCoverage: computeSourceCoverageScore(entries),
  }

  const score = Math.round(
    factors.freshness      * FACTOR_WEIGHTS.freshness +
    factors.confidence     * FACTOR_WEIGHTS.confidence +
    factors.deviation      * FACTOR_WEIGHTS.deviation +
    factors.sourceCoverage * FACTOR_WEIGHTS.sourceCoverage,
  )

  const label = scoreToLabel(score)
  const colorClass = labelToColorClass(label)

  return { score, factors, label, colorClass }
}

// ---------------------------------------------------------------------------
// Score trend over history
// ---------------------------------------------------------------------------

/**
 * A single data point in the quality score trend series.
 *
 * `timestamp` is the midpoint of the window slice and `score` is the
 * composite quality score computed over that slice.
 */
export interface QualityTrendPoint {
  /** Midpoint timestamp (ms) of the slice used to compute this score. */
  timestamp: number
  /** Composite quality score [0, 100] at this point in time. */
  score: number
}

/**
 * Compute a series of quality scores over the history window to power the
 * trend sparkline.
 *
 * The history is divided into `bucketCount` equal-width time buckets. For
 * each bucket the quality score is computed using the entries that fall
 * within it, treating the bucket's latest timestamp as the "latest price"
 * for freshness purposes.
 *
 * Buckets with no entries are omitted from the result.
 *
 * @param entries      Full price history array (oldest first).
 * @param bucketCount  Number of buckets to split the window into (default 20).
 * @param nowMs        Current time override (default: `Date.now()`).
 */
export function computeQualityTrend(
  entries: PriceHistoryEntry[],
  bucketCount = 20,
  nowMs: number = Date.now(),
): QualityTrendPoint[] {
  if (entries.length === 0) return []

  const oldest = entries.reduce((min, e) => (e.timestamp < min ? e.timestamp : min), entries[0].timestamp)
  const newest = entries.reduce((max, e) => (e.timestamp > max ? e.timestamp : max), entries[0].timestamp)

  // Avoid division by zero for degenerate single-point windows
  const span = newest - oldest
  if (span === 0) {
    const result = computeQualityScore(entries, newest, nowMs)
    return [{ timestamp: newest, score: result.score }]
  }

  const bucketWidth = span / bucketCount
  const points: QualityTrendPoint[] = []

  for (let i = 0; i < bucketCount; i++) {
    const bucketStart = oldest + i * bucketWidth
    const bucketEnd   = bucketStart + bucketWidth

    const slice = entries.filter(
      (e) => e.timestamp >= bucketStart && e.timestamp < bucketEnd,
    )

    if (slice.length === 0) continue

    const latestInBucket = slice.reduce(
      (max, e) => (e.timestamp > max ? e.timestamp : max),
      slice[0].timestamp,
    )

    // Use nowMs for freshness so the trend reflects real staleness
    const result = computeQualityScore(slice, latestInBucket, nowMs)
    points.push({ timestamp: latestInBucket, score: result.score })
  }

  return points
}

// ---------------------------------------------------------------------------
// Export payload helper
// ---------------------------------------------------------------------------

/**
 * Returns the quality-factor fields that should be injected into an export
 * row (CSV / JSON) for the given history window.
 *
 * Fields added:
 * - `qualityScore`         — composite 0–100 integer
 * - `qualityLabel`         — 'Excellent' | 'Good' | 'Fair' | 'Poor'
 * - `qualityFreshness`     — freshness factor sub-score
 * - `qualityConfidence`    — confidence factor sub-score
 * - `qualityDeviation`     — deviation factor sub-score
 * - `qualitySourceCoverage`— source-coverage factor sub-score
 *
 * @param entries          History entries in the export range.
 * @param latestTimestamp  Latest price timestamp.
 * @param nowMs            Current time override for deterministic tests.
 */
export function qualityExportFields(
  entries: PriceHistoryEntry[],
  latestTimestamp: number,
  nowMs: number = Date.now(),
): Record<string, unknown> {
  const { score, factors, label } = computeQualityScore(entries, latestTimestamp, nowMs)
  return {
    qualityScore:          score,
    qualityLabel:          label,
    qualityFreshness:      factors.freshness,
    qualityConfidence:     factors.confidence,
    qualityDeviation:      factors.deviation,
    qualitySourceCoverage: factors.sourceCoverage,
  }
}
