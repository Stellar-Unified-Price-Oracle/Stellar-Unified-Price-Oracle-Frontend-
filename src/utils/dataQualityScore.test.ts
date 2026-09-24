import { describe, it, expect } from 'vitest'
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
  KNOWN_SOURCES,
} from './dataQualityScore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<PriceHistoryEntry> = {}): PriceHistoryEntry {
  return {
    price: 100,
    timestamp: Date.now(),
    confidence: 0.95,
    sources: ['chainlink', 'redstone'],
    ...overrides,
  }
}

function makeEntries(
  count: number,
  overrides: Partial<PriceHistoryEntry> = {},
): PriceHistoryEntry[] {
  const now = Date.now()
  return Array.from({ length: count }, (_, i) => ({
    price: 100,
    timestamp: now - (count - i) * 60_000,
    confidence: 0.95,
    sources: ['chainlink', 'redstone'],
    ...overrides,
  }))
}

// ---------------------------------------------------------------------------
// computeFreshnessScore
// ---------------------------------------------------------------------------

describe('computeFreshnessScore', () => {
  const NOW = 1_000_000

  it('returns 100 for a just-published price (age = 0)', () => {
    expect(computeFreshnessScore(NOW, NOW)).toBe(100)
  })

  it('returns 0 for a price older than FRESHNESS_MAX_AGE_MS', () => {
    expect(computeFreshnessScore(NOW - FRESHNESS_MAX_AGE_MS, NOW)).toBe(0)
  })

  it('returns 0 for a price older than twice the max age (clamped)', () => {
    expect(computeFreshnessScore(NOW - FRESHNESS_MAX_AGE_MS * 2, NOW)).toBe(0)
  })

  it('returns 50 for a price exactly halfway through the decay window', () => {
    const halfAge = FRESHNESS_MAX_AGE_MS / 2
    // Due to Math.round the result could be 50 ± rounding — use toBeCloseTo-equivalent
    const score = computeFreshnessScore(NOW - halfAge, NOW)
    expect(score).toBeGreaterThanOrEqual(49)
    expect(score).toBeLessThanOrEqual(51)
  })

  it('is deterministic — same inputs produce same outputs', () => {
    const ts = 123_456_789
    const now = 123_700_000
    expect(computeFreshnessScore(ts, now)).toBe(computeFreshnessScore(ts, now))
  })
})

// ---------------------------------------------------------------------------
// computeConfidenceScore
// ---------------------------------------------------------------------------

describe('computeConfidenceScore', () => {
  it('returns 0 for an empty entries array', () => {
    expect(computeConfidenceScore([])).toBe(0)
  })

  it('returns 100 for all-confidence-1.0 entries', () => {
    const entries = makeEntries(5, { confidence: 1.0 })
    expect(computeConfidenceScore(entries)).toBe(100)
  })

  it('returns 0 for all-confidence-0 entries', () => {
    const entries = makeEntries(5, { confidence: 0 })
    expect(computeConfidenceScore(entries)).toBe(0)
  })

  it('averages multiple confidence values correctly', () => {
    const entries = [
      makeEntry({ confidence: 0.8 }),
      makeEntry({ confidence: 0.6 }),
    ]
    // (0.8 + 0.6) / 2 = 0.7 → 70
    expect(computeConfidenceScore(entries)).toBe(70)
  })

  it('is deterministic', () => {
    const entries = makeEntries(10, { confidence: 0.75 })
    expect(computeConfidenceScore(entries)).toBe(computeConfidenceScore(entries))
  })
})

// ---------------------------------------------------------------------------
// computeDeviationScore
// ---------------------------------------------------------------------------

describe('computeDeviationScore', () => {
  it('returns 100 for a single entry', () => {
    expect(computeDeviationScore([makeEntry({ price: 100 })])).toBe(100)
  })

  it('returns 100 for zero entries', () => {
    // Edge case: empty array — treated as "no observable deviation"
    expect(computeDeviationScore([])).toBe(100)
  })

  it('returns 100 for entries with identical prices (zero stdDev)', () => {
    const entries = makeEntries(10, { price: 1000 })
    expect(computeDeviationScore(entries)).toBe(100)
  })

  it('returns 0 when CV is at or above the 5 % threshold', () => {
    // mean = 100, stdDev ≥ 5 → CV ≥ 0.05
    const entries = [
      makeEntry({ price: 95 }),
      makeEntry({ price: 105 }),
      makeEntry({ price: 90 }),
      makeEntry({ price: 110 }),
    ]
    const score = computeDeviationScore(entries)
    // These prices produce a CV well above 0.05 so score should be 0
    expect(score).toBe(0)
  })

  it('returns a value between 0 and 100 for moderate volatility', () => {
    // Small variance: all within 1 % of mean
    const entries = [
      makeEntry({ price: 100 }),
      makeEntry({ price: 100.5 }),
      makeEntry({ price: 99.5 }),
      makeEntry({ price: 100.2 }),
    ]
    const score = computeDeviationScore(entries)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('returns 0 when mean is zero', () => {
    const entries = makeEntries(3, { price: 0 })
    expect(computeDeviationScore(entries)).toBe(0)
  })

  it('is deterministic', () => {
    const entries = makeEntries(10, { price: 100 })
    expect(computeDeviationScore(entries)).toBe(computeDeviationScore(entries))
  })
})

// ---------------------------------------------------------------------------
// computeSourceCoverageScore
// ---------------------------------------------------------------------------

describe('computeSourceCoverageScore', () => {
  it('returns 0 for an empty entries array', () => {
    expect(computeSourceCoverageScore([])).toBe(0)
  })

  it('returns 100 when every entry has all known sources', () => {
    const entries = makeEntries(5, { sources: [...KNOWN_SOURCES] })
    expect(computeSourceCoverageScore(entries)).toBe(100)
  })

  it('returns 50 when every entry has exactly half the known sources', () => {
    const halfSources = [...KNOWN_SOURCES].slice(0, KNOWN_SOURCES.length / 2) as string[]
    const entries = makeEntries(5, { sources: halfSources })
    const score = computeSourceCoverageScore(entries)
    expect(score).toBe(50)
  })

  it('returns 0 when every entry has no sources', () => {
    const entries = makeEntries(5, { sources: [] })
    expect(computeSourceCoverageScore(entries)).toBe(0)
  })

  it('rounds correctly for non-integer averages', () => {
    // alternating 2 and 3 sources → average 2.5 / 4 = 62.5 → rounds to 63
    const entries = [
      makeEntry({ sources: ['chainlink', 'redstone'] }),
      makeEntry({ sources: ['chainlink', 'redstone', 'band'] }),
    ]
    const score = computeSourceCoverageScore(entries)
    expect(score).toBe(63)
  })

  it('is deterministic', () => {
    const entries = makeEntries(10)
    expect(computeSourceCoverageScore(entries)).toBe(computeSourceCoverageScore(entries))
  })
})

// ---------------------------------------------------------------------------
// scoreToLabel
// ---------------------------------------------------------------------------

describe('scoreToLabel', () => {
  it('maps 80–100 to Excellent', () => {
    expect(scoreToLabel(100)).toBe('Excellent')
    expect(scoreToLabel(80)).toBe('Excellent')
  })

  it('maps 60–79 to Good', () => {
    expect(scoreToLabel(79)).toBe('Good')
    expect(scoreToLabel(60)).toBe('Good')
  })

  it('maps 40–59 to Fair', () => {
    expect(scoreToLabel(59)).toBe('Fair')
    expect(scoreToLabel(40)).toBe('Fair')
  })

  it('maps 0–39 to Poor', () => {
    expect(scoreToLabel(39)).toBe('Poor')
    expect(scoreToLabel(0)).toBe('Poor')
  })
})

// ---------------------------------------------------------------------------
// labelToColorClass
// ---------------------------------------------------------------------------

describe('labelToColorClass', () => {
  it('returns non-empty strings for every label', () => {
    const labels = ['Excellent', 'Good', 'Fair', 'Poor'] as const
    for (const label of labels) {
      expect(labelToColorClass(label).length).toBeGreaterThan(0)
    }
  })

  it('each label maps to a distinct colour class', () => {
    const classes = (['Excellent', 'Good', 'Fair', 'Poor'] as const).map(labelToColorClass)
    const unique = new Set(classes)
    expect(unique.size).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// computeQualityScore — composite
// ---------------------------------------------------------------------------

describe('computeQualityScore', () => {
  it('returns a score in [0, 100]', () => {
    const entries = makeEntries(20)
    const now = Date.now()
    const { score } = computeQualityScore(entries, entries[entries.length - 1].timestamp, now)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('is deterministic — same inputs yield same score', () => {
    const entries = makeEntries(10, { confidence: 0.9, price: 200 })
    const latest = entries[entries.length - 1].timestamp
    const now = latest + 30_000

    const r1 = computeQualityScore(entries, latest, now)
    const r2 = computeQualityScore(entries, latest, now)

    expect(r1.score).toBe(r2.score)
    expect(r1.factors).toEqual(r2.factors)
    expect(r1.label).toBe(r2.label)
  })

  it('returns all four factors in the result', () => {
    const entries = makeEntries(5)
    const { factors } = computeQualityScore(entries, entries[entries.length - 1].timestamp)
    expect(typeof factors.freshness).toBe('number')
    expect(typeof factors.confidence).toBe('number')
    expect(typeof factors.deviation).toBe('number')
    expect(typeof factors.sourceCoverage).toBe('number')
  })

  it('honours FACTOR_WEIGHTS — verifies weighted sum manually', () => {
    // Use a fixed nowMs so freshness is deterministic
    const nowMs = 1_000_000_000
    const entries: PriceHistoryEntry[] = [
      { price: 100, timestamp: nowMs - 1000, confidence: 1.0, sources: [...KNOWN_SOURCES] },
    ]
    const latest = nowMs - 1000

    const { score, factors } = computeQualityScore(entries, latest, nowMs)
    const expectedRaw =
      factors.freshness      * FACTOR_WEIGHTS.freshness +
      factors.confidence     * FACTOR_WEIGHTS.confidence +
      factors.deviation      * FACTOR_WEIGHTS.deviation +
      factors.sourceCoverage * FACTOR_WEIGHTS.sourceCoverage

    expect(score).toBe(Math.round(expectedRaw))
  })

  it('returns Excellent label and emerald colorClass for a near-perfect feed', () => {
    const nowMs = 1_000_000_000
    // Very fresh, high confidence, all sources, stable price
    const entries: PriceHistoryEntry[] = Array.from({ length: 10 }, (_, i) => ({
      price: 100,
      timestamp: nowMs - (10 - i) * 1000,
      confidence: 1.0,
      sources: [...KNOWN_SOURCES],
    }))
    const latest = entries[entries.length - 1].timestamp

    const { label, colorClass } = computeQualityScore(entries, latest, nowMs)
    expect(label).toBe('Excellent')
    expect(colorClass).toContain('emerald')
  })

  it('returns Poor label for a stale, low-confidence, low-source feed', () => {
    const nowMs = 1_000_000_000
    const staleTs = nowMs - FRESHNESS_MAX_AGE_MS * 2
    const entries: PriceHistoryEntry[] = [
      { price: 100, timestamp: staleTs, confidence: 0.1, sources: [] },
    ]

    const { label } = computeQualityScore(entries, staleTs, nowMs)
    expect(label).toBe('Poor')
  })

  it('handles empty entries gracefully (returns score in [0, 100])', () => {
    const nowMs = 1_000_000_000
    const { score } = computeQualityScore([], 0, nowMs)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})

// ---------------------------------------------------------------------------
// computeQualityTrend
// ---------------------------------------------------------------------------

describe('computeQualityTrend', () => {
  it('returns an empty array for empty entries', () => {
    expect(computeQualityTrend([], 10)).toEqual([])
  })

  it('returns a single point for a single entry', () => {
    const entry = makeEntry({ timestamp: 1_000_000 })
    const result = computeQualityTrend([entry], 10, 1_100_000)
    expect(result).toHaveLength(1)
    expect(result[0].timestamp).toBe(1_000_000)
    expect(result[0].score).toBeGreaterThanOrEqual(0)
    expect(result[0].score).toBeLessThanOrEqual(100)
  })

  it('returns at most bucketCount points', () => {
    const entries = makeEntries(100)
    const result = computeQualityTrend(entries, 20)
    expect(result.length).toBeLessThanOrEqual(20)
  })

  it('each point has score in [0, 100]', () => {
    const entries = makeEntries(50)
    const result = computeQualityTrend(entries, 10)
    for (const point of result) {
      expect(point.score).toBeGreaterThanOrEqual(0)
      expect(point.score).toBeLessThanOrEqual(100)
    }
  })

  it('is deterministic', () => {
    const entries = makeEntries(30)
    const now = Date.now()
    const r1 = computeQualityTrend(entries, 10, now)
    const r2 = computeQualityTrend(entries, 10, now)
    expect(r1).toEqual(r2)
  })

  it('timestamps are ordered oldest → newest', () => {
    const entries = makeEntries(30)
    const result = computeQualityTrend(entries, 10)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].timestamp).toBeGreaterThanOrEqual(result[i - 1].timestamp)
    }
  })
})

// ---------------------------------------------------------------------------
// qualityExportFields
// ---------------------------------------------------------------------------

describe('qualityExportFields', () => {
  it('returns all six expected fields', () => {
    const entries = makeEntries(5)
    const latest = entries[entries.length - 1].timestamp
    const fields = qualityExportFields(entries, latest, latest + 1000)

    expect(fields).toHaveProperty('qualityScore')
    expect(fields).toHaveProperty('qualityLabel')
    expect(fields).toHaveProperty('qualityFreshness')
    expect(fields).toHaveProperty('qualityConfidence')
    expect(fields).toHaveProperty('qualityDeviation')
    expect(fields).toHaveProperty('qualitySourceCoverage')
  })

  it('qualityScore is an integer in [0, 100]', () => {
    const entries = makeEntries(10)
    const latest = entries[entries.length - 1].timestamp
    const { qualityScore } = qualityExportFields(entries, latest)
    expect(typeof qualityScore).toBe('number')
    expect(Number.isInteger(qualityScore)).toBe(true)
    expect(qualityScore as number).toBeGreaterThanOrEqual(0)
    expect(qualityScore as number).toBeLessThanOrEqual(100)
  })

  it('qualityLabel is a valid label string', () => {
    const entries = makeEntries(5)
    const latest = entries[entries.length - 1].timestamp
    const { qualityLabel } = qualityExportFields(entries, latest)
    expect(['Excellent', 'Good', 'Fair', 'Poor']).toContain(qualityLabel)
  })

  it('is deterministic for fixed nowMs', () => {
    const entries = makeEntries(5)
    const latest = entries[entries.length - 1].timestamp
    const nowMs = latest + 10_000

    const f1 = qualityExportFields(entries, latest, nowMs)
    const f2 = qualityExportFields(entries, latest, nowMs)
    expect(f1).toEqual(f2)
  })
})
