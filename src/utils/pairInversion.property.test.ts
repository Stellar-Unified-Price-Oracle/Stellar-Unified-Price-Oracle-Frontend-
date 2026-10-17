import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { invertPair, invertPrice } from './pairInversion'

// Asset codes and separators the app's pair names use. Prices are generated
// across 1e-8 to 1e12 because that is the span the aggregator produces.
const assetCode = fc.stringMatching(/^[A-Z0-9]{1,8}$/)
const separator = fc.constantFrom('/', '-')
const pair = fc.tuple(assetCode, separator, assetCode).map(([base, sep, quote]) => `${base}${sep}${quote}`)
const price = fc.double({ min: 1e-8, max: 1e12, noNaN: true, noDefaultInfinity: true })

describe('pair inversion invariants', () => {
  it('inverting a pair twice returns the original pair', () => {
    fc.assert(
      fc.property(pair, (p) => {
        expect(invertPair(invertPair(p) ?? '')).toBe(p)
      }),
    )
  })

  it('keeps the separator and both asset codes when inverting', () => {
    fc.assert(
      fc.property(pair, (p) => {
        const inverted = invertPair(p)
        expect(inverted).not.toBeNull()
        expect(inverted).toHaveLength(p.length)
        const sep = p.includes('/') ? '/' : '-'
        const [base, quote] = p.split(sep)
        expect(inverted).toBe(`${quote}${sep}${base}`)
      }),
    )
  })

  it('inverting a price twice returns the original within a relative tolerance', () => {
    fc.assert(
      fc.property(price, (x) => {
        const once = invertPrice(x)
        expect(once).not.toBeNull()
        const twice = invertPrice(once as number)
        // Relative tolerance: fixed-decimal comparison is fp noise at these magnitudes.
        expect(Math.abs((twice as number) - x)).toBeLessThanOrEqual(1e-12 * x)
      }),
    )
  })

  it('never inverts a price that is zero or negative', () => {
    fc.assert(
      fc.property(fc.double({ max: 0, noNaN: true, noDefaultInfinity: true }), (x) => {
        expect(invertPrice(x)).toBeNull()
      }),
    )
  })
})
