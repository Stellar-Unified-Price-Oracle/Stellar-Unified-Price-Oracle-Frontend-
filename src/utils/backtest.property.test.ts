import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { PriceHistoryEntry } from '../types'
import { aggregatePrices, runBacktest, type BacktestConfig } from './backtest'

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Positive prices spanning 1 to ~1e18 — above 2^53 consecutive doubles no longer
 * exist, so algebraic properties are asserted with a relative tolerance. */
const positivePrices = fc
  .integer({ min: 0, max: 12 })
  .chain((exp) => fc.integer({ min: 1, max: 999_999 }).map((mantissa) => mantissa * 10 ** exp))

/** Exact-equality consensus prices: integer, and small enough that n·p stays exact. */
const consensusPrices = fc.integer({ min: 1, max: 1_000_000_000_000 })

/** Equality up to floating-point relative error — the honest form of these
 * algebraic properties over IEEE doubles. */
function expectCloseRelative(actual: number, expected: number, epsilon = 1e-12): void {
  const scale = Math.max(Math.abs(actual), Math.abs(expected), 1)
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(epsilon * scale)
}

const confidences = fc.double({ min: 0, max: 1, noNaN: true })

const configArb: fc.Arbitrary<BacktestConfig> = fc.record({
  mode: fc.constantFrom('median', 'weighted_mean', 'mean', 'trimmed_mean', 'vwap'),
  outlierThresholdPercent: fc.double({ min: 1e-6, max: 1000, noNaN: true }),
  minSources: fc.integer({ min: 0, max: 5 }),
  confidenceWeighting: fc.boolean(),
  maxStalenessSec: fc.integer({ min: 0, max: 3_600 }),
})

/** (price, confidence) pairs kept together so permutations preserve pairing. */
const sourcePairs = fc.tuple(positivePrices, confidences).map(([price, conf]) => ({ price, conf }))

const historyArb: fc.Arbitrary<PriceHistoryEntry[]> = fc
  .array(
    fc.record({
      price: positivePrices,
      confidence: confidences,
      sources: fc.array(fc.constantFrom('chainlink', 'redstone', 'band', 'reflector'), { maxLength: 4 }),
    }),
    { minLength: 1, maxLength: 12 },
  )
  .map((entries) => entries.map((e, i) => ({ ...e, timestamp: 1_700_000_000_000 + i * 60_000 })))

// ---------------------------------------------------------------------------
// aggregatePrices — the pure aggregation kernel
// ---------------------------------------------------------------------------

describe('aggregatePrices properties', () => {
  it('always returns a finite number (never NaN or ±Infinity)', () => {
    fc.assert(
      fc.property(
        fc.array(positivePrices, { minLength: 0, maxLength: 20 }),
        fc.array(confidences, { minLength: 0, maxLength: 20 }),
        configArb,
        (prices, confs, config) => {
          const result = aggregatePrices(prices, confs, config)
          expect(Number.isFinite(result)).toBe(true)
        },
      ),
      { numRuns: 500 },
    )
  })

  it('stays inside the convex hull of the inputs: min ≤ result ≤ max', () => {
    fc.assert(
      fc.property(fc.array(sourcePairs, { minLength: 1, maxLength: 20 }), configArb, (pairs, config) => {
        const prices = pairs.map((p) => p.price)
        const confs = pairs.map((p) => p.conf)
        const result = aggregatePrices(prices, confs, config)
        expect(result).toBeGreaterThanOrEqual(Math.min(...prices))
        expect(result).toBeLessThanOrEqual(Math.max(...prices))
      }),
      { numRuns: 500 },
    )
  })

  it('is permutation-invariant — reordering (price, confidence) pairs cannot change the aggregate', () => {
    fc.assert(
      fc.property(
        fc.array(sourcePairs, { minLength: 1, maxLength: 12 }),
        configArb,
        fc.constantFrom('identity', 'reversed', 'sorted') as fc.Arbitrary<'identity' | 'reversed' | 'sorted'>,
        (pairs, config, permutation) => {
          const original = pairs.map((p) => p.price)
          const originalConfs = pairs.map((p) => p.conf)
          const permuted = [...pairs]
          if (permutation === 'reversed') permuted.reverse()
          if (permutation === 'sorted') permuted.sort((a, b) => a.price - b.price)

          const a = aggregatePrices(original, originalConfs, config)
          const b = aggregatePrices(
            permuted.map((p) => p.price),
            permuted.map((p) => p.conf),
            config,
          )
          expectCloseRelative(a, b)
        },
      ),
      { numRuns: 400 },
    )
  })

  it('collapses to the consensus price when all sources agree, for any group size (exact)', () => {
    fc.assert(
      fc.property(consensusPrices, configArb, fc.integer({ min: 1, max: 10 }), (price, config, n) => {
        // n·p ≤ 1e13 and conf 0.5 keeps every intermediate sum exact, so the
        // correctly-rounded result must be exactly the consensus price.
        const result = aggregatePrices(Array(n).fill(price), Array(n).fill(0.5), config)
        expect(result).toBe(price)
      }),
      { numRuns: 400 },
    )
  })

  it('collapses to the consensus price regardless of the confidence values attached', () => {
    fc.assert(
      fc.property(
        positivePrices,
        fc.array(confidences, { minLength: 1, maxLength: 10 }),
        configArb,
        (price, confs, config) => {
          const result = aggregatePrices(Array(confs.length).fill(price), confs, config)
          expectCloseRelative(result, price)
        },
      ),
      { numRuns: 300 },
    )
  })

  it('rejects a single extreme outlier: with a 3+ source consensus, one source at 10× the deviation threshold cannot move the aggregate', () => {
    fc.assert(
      fc.property(positivePrices, configArb, fc.integer({ min: 3, max: 8 }), (price, config, n) => {
        fc.pre(n >= config.minSources)
        // One source deviates by 10× the configured threshold — always rejected.
        const outlierPrice = price * (1 + (config.outlierThresholdPercent / 100) * 10)
        const prices = Array(n - 1)
          .fill(price)
          .concat([outlierPrice])
        const confs = Array(n).fill(0.9)

        const result = aggregatePrices(prices, confs, config)
        expectCloseRelative(result, price)
      }),
      { numRuns: 300 },
    )
  })
})

// ---------------------------------------------------------------------------
// runBacktest — aggregation over a synthetic history
// ---------------------------------------------------------------------------

describe('runBacktest properties', () => {
  it('produces one point per history entry with preserved timestamps', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 10 }), historyArb, configArb, (pair, history, config) => {
        const result = runBacktest(pair, history, config)
        expect(result.pair).toBe(pair)
        expect(result.points).toHaveLength(history.length)
        result.points.forEach((p, i) => expect(p.timestamp).toBe(history[i].timestamp))
      }),
    )
  })

  it('flags isAnomaly exactly when deviationPercent exceeds the outlier threshold, and the summary counts agree', () => {
    fc.assert(
      fc.property(historyArb, configArb, (history, config) => {
        const result = runBacktest('BTC/USD', history, config)
        let expectedAnomalies = 0
        result.points.forEach((p) => {
          const shouldBeAnomaly = p.deviationPercent > config.outlierThresholdPercent
          expect(p.isAnomaly).toBe(shouldBeAnomaly)
          if (shouldBeAnomaly) expectedAnomalies++
        })
        expect(result.anomalyCount).toBe(expectedAnomalies)
        expect(result.anomalyRatePercent).toBeCloseTo((expectedAnomalies / history.length) * 100, 10)
      }),
    )
  })

  it('deviation statistics are internally consistent (mean ≥ 0, max ≥ mean, stdDev ≥ 0, max ≤ 100)', () => {
    fc.assert(
      fc.property(historyArb, configArb, (history, config) => {
        const result = runBacktest('XLM/USD', history, config)
        expect(result.meanDeviationPercent).toBeGreaterThanOrEqual(0)
        expect(result.maxDeviationPercent).toBeGreaterThanOrEqual(result.meanDeviationPercent)
        expect(result.stdDevDeviation).toBeGreaterThanOrEqual(0)
        result.points.forEach((p) => expect(p.deviationPercent).toBeLessThanOrEqual(100))
      }),
    )
  })

  it('is deterministic — identical inputs produce identical results', () => {
    fc.assert(
      fc.property(historyArb, configArb, (history, config) => {
        const a = runBacktest('BTC/USD', history, config)
        const b = runBacktest('BTC/USD', history, config)
        expect(a).toEqual(b)
      }),
    )
  })
})
