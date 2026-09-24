import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { computeDivergence } from './divergence'

/** Prices on a realistic oracle scale: 1e-8 … 1e9 with fractional parts. */
const prices = fc
  .tuple(fc.integer({ min: -8, max: 9 }), fc.integer({ min: 100_000, max: 999_999 }))
  .map(([exp, mantissa]) => (mantissa / 1e5) * 10 ** exp)

const thresholds = fc.double({ min: 0.0001, max: 50, noNaN: true })

describe('computeDivergence properties', () => {
  it('always returns a finite percentageDelta and a valid status', () => {
    fc.assert(
      fc.property(prices, prices, thresholds, (offChain, onChain, threshold) => {
        const d = computeDivergence(offChain, onChain, threshold)
        expect(Number.isFinite(d.percentageDelta)).toBe(true)
        expect(['in-sync', 'warning', 'breached']).toContain(d.status)
      }),
      { numRuns: 1000 },
    )
  })

  it('reports in-sync exactly when |Δ%| is below half the threshold (band boundaries)', () => {
    fc.assert(
      fc.property(prices, prices, thresholds, (offChain, onChain, threshold) => {
        const d = computeDivergence(offChain, onChain, threshold)
        const magnitude = Math.abs(d.percentageDelta)
        if (d.status === 'in-sync') {
          expect(magnitude).toBeLessThan(threshold / 2)
        } else {
          expect(magnitude).toBeGreaterThanOrEqual(threshold / 2)
        }
      }),
      { numRuns: 1000 },
    )
  })

  it('reports breached exactly when |Δ%| is at or above the full threshold', () => {
    fc.assert(
      fc.property(prices, prices, thresholds, (offChain, onChain, threshold) => {
        const d = computeDivergence(offChain, onChain, threshold)
        const magnitude = Math.abs(d.percentageDelta)
        if (d.status === 'breached') {
          expect(magnitude).toBeGreaterThanOrEqual(threshold)
        } else {
          expect(magnitude).toBeLessThan(threshold)
        }
      }),
      { numRuns: 1000 },
    )
  })

  it('matches the documented band mapping exactly', () => {
    fc.assert(
      fc.property(prices, prices, thresholds, (offChain, onChain, threshold) => {
        const d = computeDivergence(offChain, onChain, threshold)
        const magnitude = Math.abs(d.percentageDelta)
        const expected = magnitude >= threshold ? 'breached' : magnitude >= threshold / 2 ? 'warning' : 'in-sync'
        expect(d.status).toBe(expected)
      }),
      { numRuns: 1000 },
    )
  })

  it('has the sign of the raw difference: off-chain above → positive Δ%', () => {
    fc.assert(
      fc.property(prices, prices, thresholds, (offChain, onChain, threshold) => {
        fc.pre(onChain !== 0)
        const d = computeDivergence(offChain, onChain, threshold)
        expect(Math.sign(d.percentageDelta)).toBe(Math.sign(offChain - onChain))
      }),
      { numRuns: 600 },
    )
  })

  it('has an antisymmetric absoluteDelta — swapping prices negates the raw difference exactly', () => {
    // NB: percentageDelta is deliberately NOT asserted antisymmetric — a percent
    // change of a over b, (a-b)/b, is a different quantity than -(b-a)/a unless
    // a = b. Only the raw difference flips sign under the swap.
    fc.assert(
      fc.property(prices, prices, thresholds, (a, b, threshold) => {
        const forward = computeDivergence(a, b, threshold)
        const backward = computeDivergence(b, a, threshold)
        expect(forward.absoluteDelta).toBe(-backward.absoluteDelta)
      }),
      { numRuns: 600 },
    )
  })

  it('is monotone in magnitude: widening the gap can only push the status toward breached', () => {
    fc.assert(
      fc.property(prices, prices, thresholds, prices, (offChain, onChain, threshold, spread) => {
        fc.pre(onChain !== 0)
        const near = computeDivergence(offChain, onChain, threshold)
        const far = computeDivergence(onChain + (onChain - offChain) * (1 + spread), onChain, threshold)
        const rank = { 'in-sync': 0, warning: 1, breached: 2 } as const
        expect(rank[far.status]).toBeGreaterThanOrEqual(rank[near.status])
      }),
      { numRuns: 600 },
    )
  })

  it('preserves the inputs verbatim in the result', () => {
    fc.assert(
      fc.property(prices, prices, thresholds, (offChain, onChain, threshold) => {
        const d = computeDivergence(offChain, onChain, threshold)
        expect(d.offChainPrice).toBe(offChain)
        expect(d.onChainPrice).toBe(onChain)
        expect(d.absoluteDelta).toBe(offChain - onChain)
      }),
      { numRuns: 500 },
    )
  })

  it('treats any nonzero off-chain price against a zero on-chain price as breached', () => {
    fc.assert(
      fc.property(prices, thresholds, (offChain, threshold) => {
        fc.pre(offChain !== 0)
        const d = computeDivergence(offChain, 0, threshold)
        expect(d.percentageDelta).toBe(100)
        expect(d.status).toBe('breached')
      }),
      { numRuns: 300 },
    )
  })

  it('treats both prices zero as perfectly in sync for every threshold', () => {
    fc.assert(
      fc.property(thresholds, (threshold) => {
        const d = computeDivergence(0, 0, threshold)
        expect(d.percentageDelta).toBe(0)
        expect(d.status).toBe('in-sync')
      }),
      { numRuns: 200 },
    )
  })
})
