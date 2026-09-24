import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import fc from 'fast-check'
import type { PriceData } from '../types'
import { selectSortedPrices, selectAverageConfidence, selectTopMovers, selectStaleAssets } from './priceSelectors'
import { createSelector } from './createSelector'

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const NOW = 1_800_000_000_000

/** Unique asset pairs so localeCompare ties never make order assertions ambiguous. */
function priceDataArb(maxLength = 20): fc.Arbitrary<PriceData[]> {
  return fc.uniqueArray(
    fc.record({
      assetPair: fc
        .tuple(fc.constantFrom('BTC', 'ETH', 'XLM', 'SOL', 'XRP', 'ADA'), fc.constantFrom('USD', 'EUR', 'USDC'))
        .map(([base, quote]) => `${base}/${quote}`),
      price: fc.double({ min: 0.000001, max: 1_000_000, noNaN: true }),
      timestamp: fc.integer({ min: NOW - 30 * 60_000, max: NOW }),
      confidence: fc.double({ min: 0, max: 1, noNaN: true }),
      sources: fc.array(fc.constantFrom('chainlink', 'redstone', 'band', 'reflector'), { maxLength: 4 }),
    }),
    { minLength: 0, maxLength, selector: (p) => p.assetPair },
  )
}

// ---------------------------------------------------------------------------
// selectSortedPrices
// ---------------------------------------------------------------------------

describe('selectSortedPrices properties', () => {
  it('always returns the pairs in non-decreasing localeCompare order', () => {
    fc.assert(
      fc.property(priceDataArb(), (prices) => {
        const out = selectSortedPrices(prices)
        for (let i = 1; i < out.length; i++) {
          expect(out[i - 1].assetPair.localeCompare(out[i].assetPair)).toBeLessThanOrEqual(0)
        }
      }),
    )
  })

  it('is a faithful permutation of the input: same length, same multiset', () => {
    fc.assert(
      fc.property(priceDataArb(), (prices) => {
        const out = selectSortedPrices(prices)
        expect(out).toHaveLength(prices.length)
        const counts = (arr: PriceData[]) => {
          const m = new Map<string, number>()
          for (const p of arr) m.set(p.assetPair, (m.get(p.assetPair) ?? 0) + 1)
          return m
        }
        expect(counts(out)).toEqual(counts(prices))
      }),
    )
  })

  it('never mutates the input array', () => {
    fc.assert(
      fc.property(priceDataArb(), (prices) => {
        const snapshot = structuredClone(prices)
        selectSortedPrices(prices)
        expect(prices).toEqual(snapshot)
      }),
    )
  })

  it('is idempotent: sorting an already-sorted list changes nothing', () => {
    fc.assert(
      fc.property(priceDataArb(), (prices) => {
        const once = selectSortedPrices(prices)
        expect(selectSortedPrices(once)).toEqual(once)
      }),
    )
  })

  it('is reference-memoized: the same input array yields the identical output object', () => {
    fc.assert(
      fc.property(priceDataArb(5), (prices) => {
        expect(selectSortedPrices(prices)).toBe(selectSortedPrices(prices))
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// selectAverageConfidence
// ---------------------------------------------------------------------------

describe('selectAverageConfidence properties', () => {
  it('returns 0 for the empty list and stays in [0, 1] otherwise (confidence is a 0–1 decimal)', () => {
    fc.assert(
      fc.property(priceDataArb(), (prices) => {
        const avg = selectAverageConfidence(prices)
        if (prices.length === 0) {
          expect(avg).toBe(0)
        } else {
          expect(avg).toBeGreaterThanOrEqual(0)
          expect(avg).toBeLessThanOrEqual(1)
        }
      }),
    )
  })

  it('an average can never escape its inputs: min ≤ avg ≤ max confidence', () => {
    fc.assert(
      fc.property(priceDataArb(), (prices) => {
        fc.pre(prices.length > 0)
        const avg = selectAverageConfidence(prices)
        const confidences = prices.map((p) => p.confidence)
        expect(avg).toBeGreaterThanOrEqual(Math.min(...confidences) - 1e-12)
        expect(avg).toBeLessThanOrEqual(Math.max(...confidences) + 1e-12)
      }),
    )
  })

  it('is permutation-invariant up to floating-point associativity', () => {
    fc.assert(
      fc.property(
        priceDataArb(),
        fc.constantFrom('identity', 'reversed', 'sorted') as fc.Arbitrary<'identity' | 'reversed' | 'sorted'>,
        (prices, permutation) => {
          const permuted = [...prices]
          if (permutation === 'reversed') permuted.reverse()
          if (permutation === 'sorted') permuted.sort((a, b) => a.confidence - b.confidence)
          expect(selectAverageConfidence(permuted)).toBeCloseTo(selectAverageConfidence(prices), 12)
        },
      ),
    )
  })
})

// ---------------------------------------------------------------------------
// selectTopMovers
// ---------------------------------------------------------------------------

describe('selectTopMovers properties', () => {
  it('returns exactly min(count, n) items', () => {
    fc.assert(
      fc.property(priceDataArb(), fc.integer({ min: 0, max: 30 }), (prices, count) => {
        expect(selectTopMovers(prices, count)).toHaveLength(Math.min(count, prices.length))
      }),
    )
  })

  it('every returned item has confidence ≥ every excluded item (a true top-k cut)', () => {
    fc.assert(
      fc.property(priceDataArb(), fc.integer({ min: 1, max: 30 }), (prices, count) => {
        fc.pre(prices.length > count)
        const picked = selectTopMovers(prices, count)
        const pickedSet = new Set(picked)
        const excluded = prices.filter((p) => !pickedSet.has(p))
        const minPicked = Math.min(...picked.map((p) => p.confidence))
        const maxExcluded = Math.max(...excluded.map((p) => p.confidence))
        expect(minPicked).toBeGreaterThanOrEqual(maxExcluded)
      }),
    )
  })

  it('returns its picks sorted by confidence, descending', () => {
    fc.assert(
      fc.property(priceDataArb(), fc.integer({ min: 0, max: 30 }), (prices, count) => {
        const picked = selectTopMovers(prices, count)
        for (let i = 1; i < picked.length; i++) {
          expect(picked[i - 1].confidence).toBeGreaterThanOrEqual(picked[i].confidence)
        }
      }),
    )
  })

  it('is permutation-invariant when confidences are distinct (exact same picks)', () => {
    fc.assert(
      fc.property(priceDataArb(), fc.integer({ min: 1, max: 10 }), (prices, count) => {
        fc.pre(new Set(prices.map((p) => p.confidence)).size === prices.length)
        const a = selectTopMovers(prices, count).sort((x, y) => x.assetPair.localeCompare(y.assetPair))
        const b = selectTopMovers([...prices].reverse(), count).sort((x, y) => x.assetPair.localeCompare(y.assetPair))
        expect(a).toEqual(b)
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// selectStaleAssets
// ---------------------------------------------------------------------------

describe('selectStaleAssets properties', () => {
  beforeAll(() => {
    vi.useFakeTimers({ now: NOW })
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  it('selects exactly the entries older than the threshold (now − ts > threshold)', () => {
    fc.assert(
      fc.property(priceDataArb(), fc.integer({ min: 0, max: 20 * 60_000 }), (prices, threshold) => {
        const stale = selectStaleAssets(prices, threshold)
        const expected = prices.filter((p) => NOW - p.timestamp > threshold)
        expect(stale).toHaveLength(expected.length)
        for (const p of stale) expect(NOW - p.timestamp).toBeGreaterThan(threshold)
      }),
    )
  })

  it('returned elements are the original objects (reference-preserving filter)', () => {
    fc.assert(
      fc.property(priceDataArb(), (prices) => {
        const stale = selectStaleAssets(prices, 60_000)
        for (const p of stale) expect(prices).toContain(p)
      }),
    )
  })

  it('is monotone in the threshold: a larger threshold can only shrink the stale set', () => {
    fc.assert(
      fc.property(
        priceDataArb(),
        fc.integer({ min: 0, max: 10 * 60_000 }),
        fc.integer({ min: 0, max: 10 * 60_000 }),
        (prices, t1, t2) => {
          fc.pre(t1 <= t2)
          const staleAtT1 = new Set(selectStaleAssets(prices, t1).map((p) => p.assetPair))
          const staleAtT2 = selectStaleAssets(prices, t2).map((p) => p.assetPair)
          for (const pair of staleAtT2) expect(staleAtT1.has(pair)).toBe(true)
        },
      ),
    )
  })

  it('uses the documented 5-minute default when no threshold is passed', () => {
    fc.assert(
      fc.property(priceDataArb(), (prices) => {
        expect(selectStaleAssets(prices)).toEqual(selectStaleAssets(prices, 5 * 60_000))
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// createSelector memoization contract
// ---------------------------------------------------------------------------

describe('createSelector properties', () => {
  it('computes once per input reference and reuses the cached result for repeats', () => {
    fc.assert(
      fc.property(priceDataArb(6), fc.integer({ min: 1, max: 4 }), (prices, repeats) => {
        const compute = vi.fn((prices: unknown) => (prices as PriceData[]).length)
        const selector = createSelector<PriceData[], number>([(p) => p], compute)

        const results: number[] = []
        for (let i = 0; i < repeats; i++) results.push(selector(prices))

        expect(results.every((r) => r === prices.length)).toBe(true)
        expect(compute).toHaveBeenCalledTimes(1)
      }),
    )
  })

  it('never cross-contaminates the cache when alternating between two inputs', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 1, maxLength: 8 }),
        fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 1, maxLength: 8 }),
        fc.array(fc.constantFrom(0, 1) as fc.Arbitrary<0 | 1>, { minLength: 1, maxLength: 12 }),
        (a, b, order) => {
          const compute = vi.fn((nums: unknown) => (nums as number[]).reduce((x, y) => x + y, 0))
          const selector = createSelector<number[], number>([(n) => n], compute)
          const inputs = [a, b]
          for (const which of order) {
            expect(selector(inputs[which])).toBe(compute.getMockImplementation()!(inputs[which]))
          }
        },
      ),
    )
  })

  it('does not mutate the input it is given', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 10 }), (nums) => {
        const snapshot = [...nums]
        const selector = createSelector<number[], number>([(n) => n], (n) => (n as number[]).reduce((x, y) => x + y, 0))
        selector(nums)
        expect(nums).toEqual(snapshot)
      }),
    )
  })
})
