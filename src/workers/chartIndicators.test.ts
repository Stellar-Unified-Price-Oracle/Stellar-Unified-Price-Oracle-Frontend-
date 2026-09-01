/**
 * Unit tests for technical indicator computations (SMA, EMA, RSI).
 *
 * The helper functions (computeSMA, computeEMA, computeRSI) are module-level
 * in chartAggregation.worker.ts and are not separately exported. Tests drive
 * them through the public ChartAggregationWorker.computeIndicators method, and
 * additionally verify known values with inline reference implementations.
 */

import { describe, it, expect, vi } from 'vitest'

// comlink's expose() is a side-effect at module level; mock it so the worker
// module can be imported in a non-worker environment.
vi.mock('comlink', () => ({ expose: vi.fn() }))

import { ChartAggregationWorker } from './chartAggregation.worker'

// ── Reference implementations (for cross-checking) ───────────────────────────

function refSMA(prices: number[], period: number): (number | null)[] {
  return prices.map((_, i) => {
    if (i < period - 1) return null
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += prices[j]
    return sum / period
  })
}

function refEMA(prices: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1)
  const result: (number | null)[] = new Array(prices.length).fill(null)
  if (prices.length < period) return result
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
  result[period - 1] = ema
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k)
    result[i] = ema
  }
  return result
}

function refRSI(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(prices.length).fill(null)
  if (prices.length < period + 1) return result
  let gains = 0
  let losses = 0
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1]
    if (diff > 0) gains += diff
    else losses -= diff
  }
  let avgGain = gains / period
  let avgLoss = losses / period
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return result
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeHistory(prices: number[]) {
  return prices.map((price, i) => ({
    price,
    timestamp: 1_000_000 + i * 60_000,
    confidence: 1,
    sources: ['test'],
    assetPair: 'XLM/USD',
  }))
}

const worker = new ChartAggregationWorker()

// ── SMA tests ─────────────────────────────────────────────────────────────────

describe('SMA', () => {
  it('returns null for the first (period - 1) values', () => {
    const result = refSMA([1, 2, 3, 4, 5], 3)
    expect(result[0]).toBeNull()
    expect(result[1]).toBeNull()
  })

  it('[1,2,3,4,5] period=3 → [null, null, 2, 3, 4]', () => {
    const result = refSMA([1, 2, 3, 4, 5], 3)
    expect(result).toEqual([null, null, 2, 3, 4])
  })

  it('period=1 equals the input prices', () => {
    const prices = [10, 20, 30]
    expect(refSMA(prices, 1)).toEqual(prices)
  })

  it('period larger than data returns all nulls', () => {
    const result = refSMA([1, 2], 5)
    expect(result.every((v) => v === null)).toBe(true)
  })
})

// ── EMA tests ─────────────────────────────────────────────────────────────────

describe('EMA', () => {
  it('first non-null appears at index (period - 1)', () => {
    const result = refEMA([1, 2, 3, 4, 5], 3)
    expect(result[0]).toBeNull()
    expect(result[1]).toBeNull()
    expect(result[2]).not.toBeNull()
  })

  it('[1,2,3,4,5] period=3: seed value at index 2 is SMA of first 3 prices', () => {
    const result = refEMA([1, 2, 3, 4, 5], 3)
    // SMA([1,2,3]) = 2.0
    expect(result[2]).toBeCloseTo(2.0)
  })

  it('[1,2,3,4,5] period=3: index 3 follows EMA formula', () => {
    // k = 2/(3+1) = 0.5; ema3 = 4*0.5 + 2*(0.5) = 3.0
    const result = refEMA([1, 2, 3, 4, 5], 3)
    expect(result[3]).toBeCloseTo(3.0)
  })

  it('[1,2,3,4,5] period=3: index 4 follows EMA formula', () => {
    // ema4 = 5*0.5 + 3.0*0.5 = 4.0
    const result = refEMA([1, 2, 3, 4, 5], 3)
    expect(result[4]).toBeCloseTo(4.0)
  })

  it('period larger than data returns all nulls', () => {
    const result = refEMA([1, 2], 5)
    expect(result.every((v) => v === null)).toBe(true)
  })

  it('EMA reacts faster than SMA on a sudden price spike', () => {
    // Flat prices then a sharp jump — EMA should converge toward the new level
    // faster than SMA, so it should be strictly greater at the last point.
    const prices = [10, 10, 10, 10, 10, 10, 100, 100, 100, 100]
    const sma = refSMA(prices, 5)
    const ema = refEMA(prices, 5)
    const last = prices.length - 1
    expect(ema[last]).toBeGreaterThan(sma[last]!)
  })
})

// ── RSI tests ─────────────────────────────────────────────────────────────────

describe('RSI', () => {
  it('returns null for the first `period` values', () => {
    const prices = Array.from({ length: 20 }, (_, i) => i + 1)
    const result = refRSI(prices, 14)
    for (let i = 0; i < 14; i++) {
      expect(result[i]).toBeNull()
    }
    expect(result[14]).not.toBeNull()
  })

  it('all-up moves: RSI approaches 100', () => {
    // 30 strictly increasing prices — all gains, no losses
    const prices = Array.from({ length: 30 }, (_, i) => i + 1)
    const result = refRSI(prices, 14)
    const lastNonNull = result.filter((v): v is number => v !== null)
    const last = lastNonNull[lastNonNull.length - 1]
    // With pure gains, RSI should be 100
    expect(last).toBeCloseTo(100, 0)
  })

  it('all-down moves: RSI approaches 0', () => {
    // 30 strictly decreasing prices — all losses, no gains
    const prices = Array.from({ length: 30 }, (_, i) => 30 - i)
    const result = refRSI(prices, 14)
    const lastNonNull = result.filter((v): v is number => v !== null)
    const last = lastNonNull[lastNonNull.length - 1]
    expect(last).toBeCloseTo(0, 0)
  })

  it('RSI stays within [0, 100]', () => {
    const prices = [10, 12, 11, 13, 9, 14, 8, 15, 10, 12, 11, 14, 9, 13, 12, 11, 15, 10]
    const result = refRSI(prices, 5)
    for (const v of result) {
      if (v !== null) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(100)
      }
    }
  })
})

// ── ChartAggregationWorker.computeIndicators ──────────────────────────────────

describe('ChartAggregationWorker.computeIndicators', () => {
  it('returns the correct structure', () => {
    const history = makeHistory([1, 2, 3, 4, 5])
    const output = worker.computeIndicators({
      taskId: 'test-1',
      pair: 'XLM/USD',
      history,
      indicators: [
        { type: 'sma', period: 3, enabled: true },
        { type: 'ema', period: 3, enabled: true },
        { type: 'rsi', period: 3, enabled: true },
      ],
    })

    expect(output.taskId).toBe('test-1')
    expect(output.pair).toBe('XLM/USD')
    expect(output.series).toHaveLength(3)
    for (const s of output.series) {
      expect(s.values).toHaveLength(history.length)
    }
  })

  it('skips disabled indicators', () => {
    const history = makeHistory([1, 2, 3, 4, 5])
    const output = worker.computeIndicators({
      taskId: 'test-2',
      pair: 'XLM/USD',
      history,
      indicators: [
        { type: 'sma', period: 3, enabled: false },
        { type: 'ema', period: 3, enabled: true },
      ],
    })

    expect(output.series).toHaveLength(1)
    expect(output.series[0].type).toBe('ema')
  })

  it('SMA series values match reference implementation', () => {
    const prices = [1, 2, 3, 4, 5]
    const history = makeHistory(prices)
    const output = worker.computeIndicators({
      taskId: 'test-3',
      pair: 'XLM/USD',
      history,
      indicators: [{ type: 'sma', period: 3, enabled: true }],
    })

    const expected = refSMA(prices, 3)
    expect(output.series[0].values).toEqual(expected)
  })

  it('EMA series values match reference implementation', () => {
    const prices = [1, 2, 3, 4, 5]
    const history = makeHistory(prices)
    const output = worker.computeIndicators({
      taskId: 'test-4',
      pair: 'XLM/USD',
      history,
      indicators: [{ type: 'ema', period: 3, enabled: true }],
    })

    const expected = refEMA(prices, 3)
    expect(output.series[0].values).toHaveLength(expected.length)
    output.series[0].values.forEach((v, i) => {
      if (expected[i] === null) {
        expect(v).toBeNull()
      } else {
        expect(v).toBeCloseTo(expected[i]!, 6)
      }
    })
  })

  it('RSI series values match reference implementation', () => {
    const prices = [10, 12, 11, 13, 9, 14, 8, 15, 10, 12, 11, 14, 9, 13, 12, 11, 15, 10]
    const history = makeHistory(prices)
    const output = worker.computeIndicators({
      taskId: 'test-5',
      pair: 'XLM/USD',
      history,
      indicators: [{ type: 'rsi', period: 5, enabled: true }],
    })

    const expected = refRSI(prices, 5)
    output.series[0].values.forEach((v, i) => {
      if (expected[i] === null) {
        expect(v).toBeNull()
      } else {
        expect(v).toBeCloseTo(expected[i]!, 6)
      }
    })
  })

  it('returns progress callback calls in order', () => {
    const history = makeHistory([1, 2, 3, 4, 5])
    const calls: number[] = []
    worker.computeIndicators(
      {
        taskId: 'test-6',
        pair: 'XLM/USD',
        history,
        indicators: [{ type: 'sma', period: 3, enabled: true }],
      },
      (progress) => calls.push(progress.processed),
    )
    expect(calls[0]).toBe(0)
    expect(calls[calls.length - 1]).toBe(1)
  })

  it('returns empty series for empty indicators list', () => {
    const history = makeHistory([1, 2, 3])
    const output = worker.computeIndicators({
      taskId: 'test-7',
      pair: 'XLM/USD',
      history,
      indicators: [],
    })
    expect(output.series).toHaveLength(0)
  })

  it('handles empty history gracefully', () => {
    const output = worker.computeIndicators({
      taskId: 'test-8',
      pair: 'XLM/USD',
      history: [],
      indicators: [{ type: 'sma', period: 3, enabled: true }],
    })
    expect(output.series[0].values).toHaveLength(0)
  })
})
