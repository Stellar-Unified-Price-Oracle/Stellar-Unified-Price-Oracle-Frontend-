import { describe, it, expect } from 'vitest'
import { detectAnomalies, anomalySeverity } from './anomalyDetection'
import type { PriceHistoryEntry } from '../types/price'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHistory(prices: number[], sources?: string[][]): PriceHistoryEntry[] {
  return prices.map((price, i) => ({
    price,
    timestamp: 1_000_000 + i * 60_000,
    confidence: 0.95,
    sources: sources?.[i] ?? ['chainlink', 'redstone', 'band'],
  }))
}

// ---------------------------------------------------------------------------
// z-score detector
// ---------------------------------------------------------------------------

describe('detectAnomalies – z-score', () => {
  it('returns no anomalies for a flat series', () => {
    const history = makeHistory(Array.from({ length: 30 }, () => 100))
    const result = detectAnomalies(history, { zScoreThreshold: 3, detectSourceDrop: false })
    expect(result.filter((a) => a.reasons.includes('zscore'))).toHaveLength(0)
  })

  it('flags a single spike in an otherwise flat series', () => {
    // 25 flat points at 100 with slight natural variation so stddev > 0,
    // then one spike to 200 well above any reasonable threshold.
    const base = Array.from({ length: 25 }, (_, i) => 100 + (i % 3 === 0 ? 0.5 : -0.5))
    const prices = [...base, 200]
    const history = makeHistory(prices)
    const result = detectAnomalies(history, { zScoreThreshold: 3, gapThresholdPercent: 200, detectSourceDrop: false })
    const zscore = result.filter((a) => a.reasons.includes('zscore'))
    expect(zscore.length).toBeGreaterThanOrEqual(1)
    expect(zscore[0].index).toBe(25)
  })

  it('records a non-zero zScore on the flagged event', () => {
    // Natural-variance window so stddev > 0, then large spike
    const base = Array.from({ length: 25 }, (_, i) => 100 + (i % 3 === 0 ? 1 : -1))
    const prices = [...base, 500]
    const history = makeHistory(prices)
    const result = detectAnomalies(history, { zScoreThreshold: 3, gapThresholdPercent: 1000, detectSourceDrop: false })
    const zscore = result.find((a) => a.reasons.includes('zscore'))
    expect(zscore?.zScore).toBeDefined()
    expect(Math.abs(zscore!.zScore!)).toBeGreaterThan(3)
  })

  it('does not flag the first 2 ticks (insufficient window)', () => {
    // Sharp spike at index 1 — window not yet built
    const prices = [100, 500, 100]
    const history = makeHistory(prices)
    const result = detectAnomalies(history, { zScoreThreshold: 3, gapThresholdPercent: 1000, detectSourceDrop: false })
    expect(result.filter((a) => a.reasons.includes('zscore') && a.index <= 2)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Gap detector
// ---------------------------------------------------------------------------

describe('detectAnomalies – gap', () => {
  it('flags a > threshold percentage jump', () => {
    // 10% jump: 100 → 111
    const history = makeHistory([100, 111])
    const result = detectAnomalies(history, { gapThresholdPercent: 5, detectSourceDrop: false })
    expect(result.some((a) => a.reasons.includes('gap'))).toBe(true)
  })

  it('does NOT flag a jump below the threshold', () => {
    // 2% jump: 100 → 102
    const history = makeHistory([100, 102])
    const result = detectAnomalies(history, { gapThresholdPercent: 5, detectSourceDrop: false })
    expect(result.some((a) => a.reasons.includes('gap'))).toBe(false)
  })

  it('records gapPercent on the flagged event', () => {
    const history = makeHistory([100, 150])
    const result = detectAnomalies(history, { gapThresholdPercent: 5, detectSourceDrop: false })
    const gap = result.find((a) => a.reasons.includes('gap'))
    expect(gap?.gapPercent).toBeCloseTo(50, 1)
  })

  it('handles a downward gap', () => {
    const history = makeHistory([100, 80])
    const result = detectAnomalies(history, { gapThresholdPercent: 5, detectSourceDrop: false })
    const gap = result.find((a) => a.reasons.includes('gap'))
    expect(gap).toBeDefined()
    expect(gap!.gapPercent).toBeCloseTo(-20, 1)
    expect(gap!.explanation).toContain('down')
  })
})

// ---------------------------------------------------------------------------
// Source-drop detector
// ---------------------------------------------------------------------------

describe('detectAnomalies – source-drop', () => {
  it('flags a drop from 3 sources to 2', () => {
    const sources = [
      ['chainlink', 'redstone', 'band'],
      ['chainlink', 'redstone'],
    ]
    const history = makeHistory([100, 100], sources)
    const result = detectAnomalies(history, { detectSourceDrop: true, gapThresholdPercent: 100 })
    expect(result.some((a) => a.reasons.includes('source-drop'))).toBe(true)
  })

  it('does NOT flag when source count stays the same', () => {
    const history = makeHistory([100, 100])
    const result = detectAnomalies(history, { detectSourceDrop: true, gapThresholdPercent: 100 })
    expect(result.some((a) => a.reasons.includes('source-drop'))).toBe(false)
  })

  it('does NOT flag when source count increases', () => {
    const sources = [['chainlink'], ['chainlink', 'redstone']]
    const history = makeHistory([100, 100], sources)
    const result = detectAnomalies(history, { detectSourceDrop: true, gapThresholdPercent: 100 })
    expect(result.some((a) => a.reasons.includes('source-drop'))).toBe(false)
  })

  it('records prevSourceCount and sourceCount', () => {
    const sources = [
      ['chainlink', 'redstone', 'band'],
      ['chainlink'],
    ]
    const history = makeHistory([100, 100], sources)
    const result = detectAnomalies(history, { detectSourceDrop: true, gapThresholdPercent: 100 })
    const event = result.find((a) => a.reasons.includes('source-drop'))
    expect(event?.prevSourceCount).toBe(3)
    expect(event?.sourceCount).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Multi-reason events
// ---------------------------------------------------------------------------

describe('detectAnomalies – multi-reason', () => {
  it('can flag both gap and source-drop on the same tick', () => {
    const prices = [...Array.from({ length: 5 }, () => 100), 200]
    const sources: string[][] = Array.from({ length: 5 }, () => ['chainlink', 'redstone', 'band'])
    sources.push(['chainlink'])
    const history = makeHistory(prices, sources)
    const result = detectAnomalies(history, { gapThresholdPercent: 5, detectSourceDrop: true })
    const tick = result.find((a) => a.index === 5)
    expect(tick?.reasons).toContain('gap')
    expect(tick?.reasons).toContain('source-drop')
  })
})

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe('detectAnomalies – determinism', () => {
  it('produces identical results on repeated calls with the same input', () => {
    const prices = [100, 101, 99, 100, 200, 100, 99, 98]
    const history = makeHistory(prices)
    const a = detectAnomalies(history)
    const b = detectAnomalies(history)
    expect(a).toEqual(b)
  })
})

// ---------------------------------------------------------------------------
// anomalySeverity
// ---------------------------------------------------------------------------

describe('anomalySeverity', () => {
  it('critical when both zscore and gap fire', () => {
    const event: AnomalyEvent = {
      index: 1, timestamp: 0, price: 100,
      reasons: ['zscore', 'gap'],
      explanation: '',
      zScore: 4,
      gapPercent: 10,
    }
    expect(anomalySeverity(event)).toBe('critical')
  })

  it('critical when zscore >= 5', () => {
    const event: AnomalyEvent = {
      index: 1, timestamp: 0, price: 100,
      reasons: ['zscore'],
      explanation: '',
      zScore: 6,
    }
    expect(anomalySeverity(event)).toBe('critical')
  })

  it('warning for a single gap', () => {
    const event: AnomalyEvent = {
      index: 1, timestamp: 0, price: 100,
      reasons: ['gap'],
      explanation: '',
      gapPercent: 10,
    }
    expect(anomalySeverity(event)).toBe('warning')
  })
})

// ---------------------------------------------------------------------------
// Empty / short series
// ---------------------------------------------------------------------------

describe('detectAnomalies – edge cases', () => {
  it('returns empty array for empty history', () => {
    expect(detectAnomalies([])).toEqual([])
  })

  it('returns empty array for single-tick history', () => {
    const history = makeHistory([100])
    expect(detectAnomalies(history)).toEqual([])
  })
})
