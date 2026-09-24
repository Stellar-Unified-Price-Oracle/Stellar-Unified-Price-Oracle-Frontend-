import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { PriceHistoryEntry } from '../types'
import {
  computeFreshnessScore,
  computeConfidenceScore,
  computeDeviationScore,
  computeSourceCoverageScore,
  computeQualityScore,
  computeQualityTrend,
  qualityExportFields,
  scoreToLabel,
  labelToColorClass,
  FACTOR_WEIGHTS,
  FRESHNESS_MAX_AGE_MS,
} from './dataQualityScore'

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const nowArb = fc.integer({ min: 1_600_000_000_000, max: 1_900_000_000_000 })
const timestampArb = fc.integer({ min: 1_500_000_000_000, max: 1_900_000_000_000 })
const priceArb = fc
  .integer({ min: 0, max: 20 })
  .chain((exp) => fc.integer({ min: 1, max: 999_999 }).map((mantissa) => (mantissa / 1e5) * 10 ** exp))
const confidenceArb = fc.double({ min: 0, max: 1, noNaN: true })
const sourcesArb = fc.array(fc.constantFrom('chainlink', 'redstone', 'band', 'reflector'), { maxLength: 6 })

const entriesArb: fc.Arbitrary<PriceHistoryEntry[]> = fc.array(
  fc.record({ price: priceArb, timestamp: timestampArb, confidence: confidenceArb, sources: sourcesArb }),
  { minLength: 0, maxLength: 30 },
)

const expectIntIn0To100 = (v: number): void => {
  expect(Number.isInteger(v)).toBe(true)
  expect(v).toBeGreaterThanOrEqual(0)
  expect(v).toBeLessThanOrEqual(100)
}

// ---------------------------------------------------------------------------
// Per-factor sub-scores
// ---------------------------------------------------------------------------

describe('computeFreshnessScore properties', () => {
  it('is always an integer in [0, 100]', () => {
    fc.assert(
      fc.property(nowArb, timestampArb, (now, ts) => {
        expectIntIn0To100(computeFreshnessScore(ts, now))
      }),
      { numRuns: 800 },
    )
  })

  it('is non-increasing in age: an older price can never score fresher', () => {
    fc.assert(
      fc.property(nowArb, timestampArb, fc.integer({ min: 0, max: 10 * FRESHNESS_MAX_AGE_MS }), (now, ts, extraAge) => {
        const younger = computeFreshnessScore(ts, now)
        const older = computeFreshnessScore(ts - extraAge, now)
        expect(older).toBeLessThanOrEqual(younger)
      }),
      { numRuns: 800 },
    )
  })

  it('scores 100 for any price at or after "now" (just-published or future)', () => {
    fc.assert(
      fc.property(nowArb, fc.integer({ min: 0, max: 3_600_000 }), (now, ahead) => {
        expect(computeFreshnessScore(now + ahead, now)).toBe(100)
      }),
      { numRuns: 300 },
    )
  })

  it('scores 0 for any price at least FRESHNESS_MAX_AGE_MS old', () => {
    fc.assert(
      fc.property(nowArb, fc.integer({ min: 0, max: 3_600_000 }), (now, extra) => {
        expect(computeFreshnessScore(now - (FRESHNESS_MAX_AGE_MS + extra), now)).toBe(0)
      }),
      { numRuns: 300 },
    )
  })
})

describe('computeConfidenceScore properties', () => {
  it('is always an integer in [0, 100], and exactly 0 for an empty window', () => {
    fc.assert(
      fc.property(entriesArb, (entries) => {
        const score = computeConfidenceScore(entries)
        expectIntIn0To100(score)
        if (entries.length === 0) expect(score).toBe(0)
      }),
    )
  })

  it('lies within the rounded min/max confidence of the window — an average cannot escape its inputs', () => {
    fc.assert(
      fc.property(entriesArb, (entries) => {
        fc.pre(entries.length > 0)
        const score = computeConfidenceScore(entries)
        const min = Math.min(...entries.map((e) => e.confidence))
        const max = Math.max(...entries.map((e) => e.confidence))
        expect(score).toBeGreaterThanOrEqual(Math.floor(min * 100) - 1)
        expect(score).toBeLessThanOrEqual(Math.ceil(max * 100) + 1)
      }),
    )
  })

  it('returns exactly 100 (0) when every entry has confidence 1 (0)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ price: priceArb, timestamp: timestampArb }), { minLength: 1, maxLength: 20 }),
        (partial) => {
          const all = partial.map((e) => ({ ...e, confidence: 1, sources: [] as string[] }))
          expect(computeConfidenceScore(all)).toBe(100)
          const none = partial.map((e) => ({ ...e, confidence: 0, sources: [] as string[] }))
          expect(computeConfidenceScore(none)).toBe(0)
        },
      ),
    )
  })
})

describe('computeDeviationScore properties', () => {
  it('is always an integer in [0, 100]', () => {
    fc.assert(
      fc.property(entriesArb, (entries) => {
        expectIntIn0To100(computeDeviationScore(entries))
      }),
    )
  })

  it('returns 100 for zero or one entry regardless of values', () => {
    fc.assert(
      fc.property(priceArb, timestampArb, confidenceArb, sourcesArb, (price, timestamp, confidence, sources) => {
        expect(computeDeviationScore([])).toBe(100)
        expect(computeDeviationScore([{ price, timestamp, confidence, sources }])).toBe(100)
      }),
    )
  })

  it('returns 100 for any number of identical prices (zero variance)', () => {
    fc.assert(
      fc.property(priceArb, fc.integer({ min: 2, max: 20 }), timestampArb, (price, n, ts) => {
        const entries = Array.from({ length: n }, (_, i) => ({
          price,
          timestamp: ts + i,
          confidence: 0.9,
          sources: ['chainlink'],
        }))
        expect(computeDeviationScore(entries)).toBe(100)
      }),
    )
  })

  it('scores 0 for any window whose prices oscillate beyond ±5% of the mean', () => {
    fc.assert(
      fc.property(
        priceArb,
        fc.double({ min: 0.5, max: 2, noNaN: true }),
        fc.integer({ min: 3, max: 10 }),
        (price, spread, n) => {
          fc.pre(price > 0)
          const entries = Array.from({ length: n }, (_, i) => ({
            price: i % 2 === 0 ? price * (1 + spread) : price * (1 - spread),
            timestamp: i,
            confidence: 0.9,
            sources: ['chainlink'],
          }))
          // Alternating ±spread (≥ 0.5) gives CV ≥ spread ≥ 0.5 » 0.05
          expect(computeDeviationScore(entries)).toBe(0)
        },
      ),
    )
  })
})

describe('computeSourceCoverageScore properties', () => {
  it('is always an integer in [0, 100], exactly 0 for an empty window', () => {
    fc.assert(
      fc.property(entriesArb, (entries) => {
        const score = computeSourceCoverageScore(entries)
        expectIntIn0To100(score)
        if (entries.length === 0) expect(score).toBe(0)
      }),
    )
  })

  it('never exceeds the best single entry scaled — a mean of source counts cannot beat the max entry', () => {
    fc.assert(
      fc.property(entriesArb, (entries) => {
        fc.pre(entries.length > 0)
        const score = computeSourceCoverageScore(entries)
        const best = Math.max(...entries.map((e) => e.sources.length))
        expect(score).toBeLessThanOrEqual(Math.round((best / 4) * 100))
      }),
    )
  })

  it('returns 100 when every entry carries all four known sources', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ price: priceArb, timestamp: timestampArb, confidence: confidenceArb }), {
          minLength: 1,
          maxLength: 15,
        }),
        (partial) => {
          const entries = partial.map((e) => ({ ...e, sources: ['chainlink', 'redstone', 'band', 'reflector'] }))
          expect(computeSourceCoverageScore(entries)).toBe(100)
        },
      ),
    )
  })
})

// ---------------------------------------------------------------------------
// Composite score
// ---------------------------------------------------------------------------

describe('computeQualityScore properties', () => {
  it('always returns an integer score in [0, 100] with four integer sub-scores', () => {
    fc.assert(
      fc.property(entriesArb, timestampArb, nowArb, (entries, latest, now) => {
        const { score, factors } = computeQualityScore(entries, latest, now)
        expectIntIn0To100(score)
        for (const v of Object.values(factors)) expectIntIn0To100(v)
      }),
      { numRuns: 600 },
    )
  })

  it('equals the rounded weighted sum of its own reported factors', () => {
    fc.assert(
      fc.property(entriesArb, timestampArb, nowArb, (entries, latest, now) => {
        const { score, factors } = computeQualityScore(entries, latest, now)
        const raw =
          factors.freshness * FACTOR_WEIGHTS.freshness +
          factors.confidence * FACTOR_WEIGHTS.confidence +
          factors.deviation * FACTOR_WEIGHTS.deviation +
          factors.sourceCoverage * FACTOR_WEIGHTS.sourceCoverage
        expect(score).toBe(Math.round(raw))
      }),
      { numRuns: 600 },
    )
  })

  it('is deterministic for identical inputs', () => {
    fc.assert(
      fc.property(entriesArb, timestampArb, nowArb, (entries, latest, now) => {
        expect(computeQualityScore(entries, latest, now)).toEqual(computeQualityScore(entries, latest, now))
      }),
    )
  })

  it('freshening the latest timestamp weakly increases the composite score', () => {
    fc.assert(
      fc.property(entriesArb, timestampArb, nowArb, (entries, latest, now) => {
        const before = computeQualityScore(entries, latest, now).score
        const after = computeQualityScore(entries, latest + 60_000, now).score
        expect(after).toBeGreaterThanOrEqual(before)
      }),
      { numRuns: 400 },
    )
  })

  it('reports the label its own score maps to, and the color its own label maps to', () => {
    fc.assert(
      fc.property(entriesArb, timestampArb, nowArb, (entries, latest, now) => {
        const { score, label, colorClass } = computeQualityScore(entries, latest, now)
        expect(label).toBe(scoreToLabel(score))
        expect(colorClass).toBe(labelToColorClass(label))
        expect(colorClass.length).toBeGreaterThan(0)
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// scoreToLabel / labelToColorClass
// ---------------------------------------------------------------------------

describe('label mapping properties', () => {
  it('partitions every integer 0–100 into exactly the four documented bands', () => {
    // Exhaustive over the domain — a "property" that is really a proof.
    for (let score = 0; score <= 100; score++) {
      const expected = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Poor'
      expect(scoreToLabel(score)).toBe(expected)
    }
  })

  it('is monotone: a higher score never yields a worse label', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 100 }), (a, b) => {
        fc.pre(a <= b)
        const rank = { Poor: 0, Fair: 1, Good: 2, Excellent: 3 } as const
        expect(rank[scoreToLabel(b)]).toBeGreaterThanOrEqual(rank[scoreToLabel(a)])
      }),
    )
  })

  it('maps each label to a distinct, non-empty color class', () => {
    const labels = ['Excellent', 'Good', 'Fair', 'Poor'] as const
    const classes = labels.map(labelToColorClass)
    classes.forEach((c) => expect(c.length).toBeGreaterThan(0))
    expect(new Set(classes).size).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// Trend + export
// ---------------------------------------------------------------------------

describe('computeQualityTrend properties', () => {
  it('returns at most bucketCount points, each scored in [0, 100]', () => {
    fc.assert(
      fc.property(entriesArb, fc.integer({ min: 1, max: 30 }), nowArb, (entries, buckets, now) => {
        const points = computeQualityTrend(entries, buckets, now)
        expect(points.length).toBeLessThanOrEqual(buckets)
        for (const p of points) expectIntIn0To100(p.score)
      }),
    )
  })

  it('timestamps are non-decreasing and every point timestamp exists in the input', () => {
    fc.assert(
      fc.property(entriesArb, fc.integer({ min: 2, max: 20 }), nowArb, (entries, buckets, now) => {
        const points = computeQualityTrend(entries, buckets, now)
        const inputTimestamps = new Set(entries.map((e) => e.timestamp))
        for (let i = 1; i < points.length; i++) {
          expect(points[i].timestamp).toBeGreaterThanOrEqual(points[i - 1].timestamp)
        }
        for (const p of points) expect(inputTimestamps.has(p.timestamp)).toBe(true)
      }),
    )
  })

  it('returns [] for empty entries and exactly one point for a single entry', () => {
    fc.assert(
      fc.property(nowArb, (now) => {
        expect(computeQualityTrend([], 10, now)).toEqual([])
        const e = { price: 100, timestamp: now - 1000, confidence: 0.9, sources: ['chainlink'] }
        expect(computeQualityTrend([e], 10, now)).toHaveLength(1)
      }),
    )
  })

  it('is deterministic for identical inputs', () => {
    fc.assert(
      fc.property(entriesArb, fc.integer({ min: 1, max: 20 }), nowArb, (entries, buckets, now) => {
        expect(computeQualityTrend(entries, buckets, now)).toEqual(computeQualityTrend(entries, buckets, now))
      }),
    )
  })
})

describe('qualityExportFields properties', () => {
  it('always exposes the six documented fields, consistent with computeQualityScore', () => {
    fc.assert(
      fc.property(entriesArb, timestampArb, nowArb, (entries, latest, now) => {
        const fields = qualityExportFields(entries, latest, now)
        const { score, factors, label } = computeQualityScore(entries, latest, now)
        expect(fields.qualityScore).toBe(score)
        expect(fields.qualityLabel).toBe(label)
        expect(fields.qualityFreshness).toBe(factors.freshness)
        expect(fields.qualityConfidence).toBe(factors.confidence)
        expect(fields.qualityDeviation).toBe(factors.deviation)
        expect(fields.qualitySourceCoverage).toBe(factors.sourceCoverage)
      }),
    )
  })

  it('is JSON-serializable for any input (export payloads must never throw)', () => {
    fc.assert(
      fc.property(entriesArb, timestampArb, nowArb, (entries, latest, now) => {
        const fields = qualityExportFields(entries, latest, now)
        expect(() => JSON.stringify(fields)).not.toThrow()
      }),
    )
  })
})
