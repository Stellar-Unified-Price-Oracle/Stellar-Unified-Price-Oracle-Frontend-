/**
 * Correlation math utilities for the Cross-Pair Correlation Explorer.
 *
 * All functions are pure and dependency-free so they can run in a worker
 * if needed in the future.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CorrelationShift {
  /** Unix timestamp (ms) of the window where the shift was detected */
  timestamp: number
  /** Correlation value in the window just before the shift */
  before: number
  /** Correlation value in the window at/after the shift */
  after: number
  /** Absolute magnitude of the change */
  magnitude: number
  /** Direction of the shift */
  type: 'breakdown' | 'convergence'
}

// ---------------------------------------------------------------------------
// pearsonCorrelation
// ---------------------------------------------------------------------------

/**
 * Computes the Pearson product-moment correlation coefficient between two
 * equal-length arrays of numbers.
 *
 * Returns NaN when:
 * - Either array has fewer than 2 elements
 * - Either series has zero standard deviation (all values identical)
 */
export function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2 || ys.length < 2 || n !== ys.length) return NaN

  let sumX = 0
  let sumY = 0
  for (let i = 0; i < n; i++) {
    sumX += xs[i]
    sumY += ys[i]
  }
  const meanX = sumX / n
  const meanY = sumY / n

  let cov = 0
  let varX = 0
  let varY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    cov += dx * dy
    varX += dx * dx
    varY += dy * dy
  }

  if (varX === 0 || varY === 0) return NaN

  return cov / Math.sqrt(varX * varY)
}

// ---------------------------------------------------------------------------
// rollingCorrelation
// ---------------------------------------------------------------------------

/**
 * Computes a rolling Pearson r for each window-sized slice of the two series.
 *
 * Returns an array of length `Math.max(0, n - window + 1)`.
 * If the window is larger than the series, an empty array is returned.
 */
export function rollingCorrelation(xs: number[], ys: number[], window: number): number[] {
  const n = xs.length
  if (n < window || window < 2) return []

  const result: number[] = []
  for (let i = 0; i <= n - window; i++) {
    const sliceX = xs.slice(i, i + window)
    const sliceY = ys.slice(i, i + window)
    result.push(pearsonCorrelation(sliceX, sliceY))
  }
  return result
}

// ---------------------------------------------------------------------------
// alignSeries
// ---------------------------------------------------------------------------

/**
 * Aligns two time-series by matching timestamps within a 60-second tolerance.
 *
 * For each point in series `a`, we look for the closest point in series `b`
 * whose timestamp is within ±60 000 ms. When a match is found both prices and
 * the matched timestamp (from `a`) are added to the parallel output arrays.
 *
 * Each point in `b` is consumed at most once to avoid duplicate matches.
 */
export function alignSeries(
  a: { timestamp: number; price: number }[],
  b: { timestamp: number; price: number }[],
): { xs: number[]; ys: number[]; timestamps: number[] } {
  const TOLERANCE_MS = 60_000
  const xs: number[] = []
  const ys: number[] = []
  const timestamps: number[] = []

  const bSorted = [...b].sort((p, q) => p.timestamp - q.timestamp)
  const used = new Set<number>()

  for (const pointA of a) {
    let bestIdx = -1
    let bestDiff = Infinity

    for (let i = 0; i < bSorted.length; i++) {
      if (used.has(i)) continue
      const diff = Math.abs(bSorted[i].timestamp - pointA.timestamp)
      if (diff <= TOLERANCE_MS && diff < bestDiff) {
        bestDiff = diff
        bestIdx = i
      }
    }

    if (bestIdx !== -1) {
      used.add(bestIdx)
      xs.push(pointA.price)
      ys.push(bSorted[bestIdx].price)
      timestamps.push(pointA.timestamp)
    }
  }

  return { xs, ys, timestamps }
}

// ---------------------------------------------------------------------------
// detectCorrelationShifts
// ---------------------------------------------------------------------------

/**
 * Scans a rolling-correlation array for significant jumps or drops.
 *
 * A shift is recorded when `|rolling[i] - rolling[i-1]| >= threshold`.
 * - A drop (positive → smaller / more negative) is a `'breakdown'`
 * - A rise (negative → larger / more positive) is a `'convergence'`
 *
 * @param rolling    Output of `rollingCorrelation`
 * @param timestamps Parallel timestamp array (same length as `rolling`)
 * @param threshold  Minimum absolute change to qualify as a shift (default 0.3)
 */
export function detectCorrelationShifts(
  rolling: number[],
  timestamps: number[],
  threshold = 0.3,
): CorrelationShift[] {
  const shifts: CorrelationShift[] = []

  for (let i = 1; i < rolling.length; i++) {
    const before = rolling[i - 1]
    const after = rolling[i]

    if (isNaN(before) || isNaN(after)) continue

    const magnitude = Math.abs(after - before)
    if (magnitude >= threshold) {
      shifts.push({
        timestamp: timestamps[i],
        before,
        after,
        magnitude,
        type: after < before ? 'breakdown' : 'convergence',
      })
    }
  }

  return shifts
}

// ---------------------------------------------------------------------------
// formatCorrelationInsight
// ---------------------------------------------------------------------------

/**
 * Returns a human-readable insight string for a detected correlation shift.
 */
export function formatCorrelationInsight(shift: CorrelationShift, pairA: string, pairB: string): string {
  const time = new Date(shift.timestamp).toLocaleTimeString()
  const beforeStr = shift.before.toFixed(2)
  const afterStr = shift.after.toFixed(2)
  const magnitudeStr = shift.magnitude.toFixed(2)

  if (shift.type === 'breakdown') {
    return (
      `Correlation breakdown detected between ${pairA} and ${pairB} at ${time}: ` +
      `r dropped from ${beforeStr} → ${afterStr} (Δ ${magnitudeStr}).`
    )
  }

  return (
    `Correlation convergence detected between ${pairA} and ${pairB} at ${time}: ` +
    `r rose from ${beforeStr} → ${afterStr} (Δ ${magnitudeStr}).`
  )
}
