import { describe, expect, it } from 'vitest'
import {
  pearsonCorrelation,
  rollingCorrelation,
  alignSeries,
  detectCorrelationShifts,
  formatCorrelationInsight,
} from './correlation'
import type { CorrelationShift } from './correlation'

// ---------------------------------------------------------------------------
// pearsonCorrelation
// ---------------------------------------------------------------------------

describe('pearsonCorrelation', () => {
  it('returns 1 for perfectly correlated data', () => {
    const xs = [1, 2, 3, 4, 5]
    const ys = [2, 4, 6, 8, 10]
    expect(pearsonCorrelation(xs, ys)).toBeCloseTo(1, 10)
  })

  it('returns -1 for perfectly anti-correlated data', () => {
    const xs = [1, 2, 3, 4, 5]
    const ys = [10, 8, 6, 4, 2]
    expect(pearsonCorrelation(xs, ys)).toBeCloseTo(-1, 10)
  })

  it('returns approximately 0 for uncorrelated data', () => {
    // A genuinely decorrelated pair — alternating directions cancel out
    const a = [1, 2, 3, 4]
    const b = [2, 1, 4, 3]
    const r = pearsonCorrelation(a, b)
    expect(r).toBeCloseTo(0, 1)
  })

  it('returns NaN for an empty array', () => {
    expect(pearsonCorrelation([], [])).toBeNaN()
  })

  it('returns NaN for a single-element array', () => {
    expect(pearsonCorrelation([1], [2])).toBeNaN()
  })

  it('returns NaN when one series has zero variance (all identical values)', () => {
    const xs = [1, 2, 3]
    const ys = [5, 5, 5]
    expect(pearsonCorrelation(xs, ys)).toBeNaN()
  })

  it('returns NaN when both series have zero variance', () => {
    expect(pearsonCorrelation([3, 3, 3], [7, 7, 7])).toBeNaN()
  })

  it('returns NaN when arrays have mismatched lengths', () => {
    expect(pearsonCorrelation([1, 2, 3], [1, 2])).toBeNaN()
  })
})

// ---------------------------------------------------------------------------
// rollingCorrelation
// ---------------------------------------------------------------------------

describe('rollingCorrelation', () => {
  it('returns an array of length n - window + 1', () => {
    const n = 10
    const window = 4
    const xs = Array.from({ length: n }, (_, i) => i)
    const ys = Array.from({ length: n }, (_, i) => i * 2)
    const result = rollingCorrelation(xs, ys, window)
    expect(result).toHaveLength(n - window + 1)
  })

  it('returns an array of length 1 when window equals series length', () => {
    const xs = [1, 2, 3, 4, 5]
    const ys = [2, 4, 6, 8, 10]
    expect(rollingCorrelation(xs, ys, 5)).toHaveLength(1)
  })

  it('returns an empty array when window is larger than series', () => {
    const xs = [1, 2, 3]
    const ys = [1, 2, 3]
    expect(rollingCorrelation(xs, ys, 10)).toHaveLength(0)
  })

  it('returns all-1 values for a perfectly correlated pair', () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8]
    const ys = xs.map((x) => x * 3 + 1)
    const result = rollingCorrelation(xs, ys, 3)
    result.forEach((r) => expect(r).toBeCloseTo(1, 10))
  })
})

// ---------------------------------------------------------------------------
// alignSeries
// ---------------------------------------------------------------------------

describe('alignSeries', () => {
  it('aligns two series with exactly matching timestamps', () => {
    const a = [
      { timestamp: 1000, price: 10 },
      { timestamp: 2000, price: 20 },
      { timestamp: 3000, price: 30 },
    ]
    const b = [
      { timestamp: 1000, price: 100 },
      { timestamp: 2000, price: 200 },
      { timestamp: 3000, price: 300 },
    ]
    const { xs, ys, timestamps } = alignSeries(a, b)
    expect(xs).toEqual([10, 20, 30])
    expect(ys).toEqual([100, 200, 300])
    expect(timestamps).toEqual([1000, 2000, 3000])
  })

  it('aligns timestamps within 60s tolerance', () => {
    const a = [{ timestamp: 1000, price: 10 }]
    const b = [{ timestamp: 1000 + 30_000, price: 99 }] // 30 s apart — within tolerance
    const { xs, ys } = alignSeries(a, b)
    expect(xs).toEqual([10])
    expect(ys).toEqual([99])
  })

  it('excludes points beyond the 60s tolerance', () => {
    const a = [{ timestamp: 1000, price: 10 }]
    const b = [{ timestamp: 1000 + 61_000, price: 99 }] // 61 s apart — outside tolerance
    const { xs, ys, timestamps } = alignSeries(a, b)
    expect(xs).toHaveLength(0)
    expect(ys).toHaveLength(0)
    expect(timestamps).toHaveLength(0)
  })

  it('returns only matched points when timestamps differ', () => {
    // a has 3 points, but only 2 of them have a matching b point
    const a = [
      { timestamp: 1000, price: 1 },
      { timestamp: 2000, price: 2 },
      { timestamp: 9999, price: 3 }, // no match
    ]
    const b = [
      { timestamp: 1000, price: 10 },
      { timestamp: 2000, price: 20 },
    ]
    const { xs } = alignSeries(a, b)
    expect(xs).toHaveLength(2)
  })

  it('does not reuse the same b point for multiple a points', () => {
    const a = [
      { timestamp: 1000, price: 1 },
      { timestamp: 1010, price: 2 }, // also close to b[0]
    ]
    const b = [{ timestamp: 1000, price: 10 }]
    const { xs } = alignSeries(a, b)
    // Only one b point available — at most one match
    expect(xs).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// detectCorrelationShifts
// ---------------------------------------------------------------------------

describe('detectCorrelationShifts', () => {
  it('finds a breakdown shift when rolling goes from 0.8 to 0.1', () => {
    const rolling = [0.8, 0.8, 0.1, 0.1]
    const timestamps = [1000, 2000, 3000, 4000]
    const shifts = detectCorrelationShifts(rolling, timestamps)
    expect(shifts).toHaveLength(1)
    expect(shifts[0].type).toBe('breakdown')
    expect(shifts[0].before).toBeCloseTo(0.8)
    expect(shifts[0].after).toBeCloseTo(0.1)
    expect(shifts[0].magnitude).toBeCloseTo(0.7)
    expect(shifts[0].timestamp).toBe(3000)
  })

  it('finds a convergence shift when rolling goes from -0.5 to 0.6', () => {
    const rolling = [-0.5, 0.6]
    const timestamps = [1000, 2000]
    const shifts = detectCorrelationShifts(rolling, timestamps)
    expect(shifts).toHaveLength(1)
    expect(shifts[0].type).toBe('convergence')
  })

  it('returns no shifts when values are stable', () => {
    const rolling = [0.9, 0.91, 0.89, 0.9]
    const timestamps = [1000, 2000, 3000, 4000]
    expect(detectCorrelationShifts(rolling, timestamps)).toHaveLength(0)
  })

  it('respects a custom threshold', () => {
    const rolling = [0.5, 0.3] // Δ = 0.2
    const timestamps = [1000, 2000]
    // Default threshold 0.3 → no shift
    expect(detectCorrelationShifts(rolling, timestamps)).toHaveLength(0)
    // Custom threshold 0.1 → shift found
    expect(detectCorrelationShifts(rolling, timestamps, 0.1)).toHaveLength(1)
  })

  it('ignores NaN values without throwing', () => {
    const rolling = [0.9, NaN, 0.1]
    const timestamps = [1000, 2000, 3000]
    // The NaN window should be skipped; no crash
    expect(() => detectCorrelationShifts(rolling, timestamps)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// formatCorrelationInsight
// ---------------------------------------------------------------------------

describe('formatCorrelationInsight', () => {
  const shift: CorrelationShift = {
    timestamp: Date.now(),
    before: 0.8,
    after: 0.1,
    magnitude: 0.7,
    type: 'breakdown',
  }

  it('includes both pair names in the output', () => {
    const msg = formatCorrelationInsight(shift, 'XLM/USD', 'BTC/USD')
    expect(msg).toContain('XLM/USD')
    expect(msg).toContain('BTC/USD')
  })

  it('mentions "breakdown" for a breakdown shift', () => {
    const msg = formatCorrelationInsight(shift, 'XLM/USD', 'BTC/USD')
    expect(msg.toLowerCase()).toContain('breakdown')
  })

  it('mentions "convergence" for a convergence shift', () => {
    const convergenceShift: CorrelationShift = { ...shift, type: 'convergence', before: 0.1, after: 0.8 }
    const msg = formatCorrelationInsight(convergenceShift, 'XLM/USD', 'ETH/USD')
    expect(msg.toLowerCase()).toContain('convergence')
    expect(msg).toContain('ETH/USD')
  })

  it('returns a non-empty string', () => {
    const msg = formatCorrelationInsight(shift, 'A', 'B')
    expect(typeof msg).toBe('string')
    expect(msg.length).toBeGreaterThan(0)
  })
})
