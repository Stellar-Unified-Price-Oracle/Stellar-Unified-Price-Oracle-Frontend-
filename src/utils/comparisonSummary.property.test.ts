import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { PriceHistoryEntry } from '../types'
import { summarizePairRange } from './comparisonSummary'

// Prices are generated in the range the dashboard receives (positive, finite). Zero and
// negative prices are handled by the zero-start guard, which has its own example test.
const entryArb = fc
  .record({
    timestamp: fc.integer({ min: 0, max: 1_000_000 }),
    price: fc.double({ min: 0.000001, max: 1e9, noNaN: true, noDefaultInfinity: true }),
  })
  .map(({ timestamp, price }): PriceHistoryEntry => ({ timestamp, price, confidence: 0.99, sources: ['chainlink'] }))

describe('summarizePairRange invariants', () => {
  it('points equals the count of entries in the window, and low <= high', () => {
    fc.assert(
      fc.property(fc.array(entryArb, { maxLength: 50 }), fc.integer({ min: 0, max: 1_000_000 }), (entries, start) => {
        const end = start + 500_000
        const s = summarizePairRange('X', entries, start, end)
        const inWindow = entries.filter((e) => e.timestamp >= start && e.timestamp <= end)
        expect(s.points).toBe(inWindow.length)
        if (s.points > 0) {
          expect(s.low).not.toBeNull()
          expect(s.high).not.toBeNull()
          expect((s.low as number) <= (s.high as number)).toBe(true)
          expect((s.from as number) <= (s.to as number)).toBe(true)
        }
      }),
    )
  })

  it('order of input does not change the summary', () => {
    fc.assert(
      fc.property(fc.array(entryArb, { minLength: 1, maxLength: 30 }), (entries) => {
        const forward = summarizePairRange('X', entries)
        const reversed = summarizePairRange('X', [...entries].reverse())
        expect(reversed).toEqual(forward)
      }),
    )
  })
})
