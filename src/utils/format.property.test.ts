import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import fc from 'fast-check'
import { formatPrice, formatPriceShort, formatChartPrice, timeAgo } from './format'

const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'es-ES', 'ja-JP', 'pt-BR', 'en-GB'] as const
const localeArb = fc.constantFrom(...LOCALES)

/** Prices spanning 1e-6 … 1e6 with fractional parts, sweeping all three tiers. */
const priceArb = fc
  .tuple(fc.integer({ min: -6, max: 6 }), fc.integer({ min: 100_000, max: 999_999 }))
  .map(([exp, mantissa]) => (mantissa / 1e5) * 10 ** exp)

/**
 * Extracts the fraction digits from a formatted number regardless of locale
 * separators (de-DE uses "." for thousands, "," for decimals; fr-FR uses a
 * (narrow no-break) space for groups). The decimal separator is always the
 * last non-digit run boundary before the trailing digit block.
 */
function fractionDigits(formatted: string): string {
  const match = formatted.match(/[.,](\d+)$/)
  return match ? match[1] : ''
}

describe('formatPrice properties', () => {
  it('always returns a non-empty string with no NaN/infinity text, in every locale', () => {
    fc.assert(
      fc.property(priceArb, localeArb, (price, locale) => {
        const out = formatPrice(price, locale)
        expect(out.length).toBeGreaterThan(0)
        expect(out.toLowerCase()).not.toContain('nan')
        expect(out.toLowerCase()).not.toContain('infinity')
      }),
      { numRuns: 800 },
    )
  })

  it('emits exactly the documented fraction-digit count for its tier, in every locale', () => {
    fc.assert(
      fc.property(priceArb, localeArb, (price, locale) => {
        const frac = fractionDigits(formatPrice(price, locale)).length
        if (price >= 1000) expect(frac).toBe(2)
        else if (price >= 1) expect(frac).toBe(4)
        else expect(frac).toBe(6)
      }),
      { numRuns: 800 },
    )
  })

  it('reformats stably: parsing the en-US output and re-formatting is a fixed point', () => {
    fc.assert(
      fc.property(priceArb, (price) => {
        const once = formatPrice(price, 'en-US')
        const parsed = Number(once.replace(/,/g, ''))
        expect(Number.isFinite(parsed)).toBe(true)
        expect(formatPrice(parsed, 'en-US')).toBe(once)
      }),
      { numRuns: 800 },
    )
  })

  it('is monotone within the ≥1000 tier: a larger price never formats to a smaller value', () => {
    fc.assert(
      fc.property(priceArb, priceArb, (a, b) => {
        fc.pre(a < b && a >= 1000 && b >= 1000)
        const pa = Number(formatPrice(a, 'en-US').replace(/,/g, ''))
        const pb = Number(formatPrice(b, 'en-US').replace(/,/g, ''))
        expect(pb).toBeGreaterThanOrEqual(pa)
      }),
      { numRuns: 600 },
    )
  })
})

describe('formatPriceShort properties', () => {
  it('keeps at least as many fraction digits as formatPrice (the "unrounded" guarantee)', () => {
    fc.assert(
      fc.property(priceArb, (price) => {
        const shortFrac = fractionDigits(formatPriceShort(price, 'en-US')).length
        const fixedFrac = fractionDigits(formatPrice(price, 'en-US')).length
        expect(shortFrac).toBeGreaterThanOrEqual(fixedFrac)
      }),
      { numRuns: 800 },
    )
  })

  it('reformats stably for the sub-1000 prices it exists to serve', () => {
    fc.assert(
      fc.property(priceArb, (price) => {
        fc.pre(price > 0 && price < 1000)
        const once = formatPriceShort(price, 'en-US')
        const parsed = Number(once.replace(/,/g, ''))
        expect(Number.isFinite(parsed)).toBe(true)
        expect(formatPriceShort(parsed, 'en-US')).toBe(once)
      }),
      { numRuns: 600 },
    )
  })
})

describe('formatChartPrice properties', () => {
  it('never exceeds its tier maximum of 2 / 4 / 8 fraction digits after the decimal separator', () => {
    fc.assert(
      fc.property(priceArb, (price) => {
        const out = formatChartPrice(price, 'en-US')
        // Only digits after the actual decimal point count; a possible thousands
        // separator ("1,000.12") must not be mistaken for one.
        const point = out.lastIndexOf('.')
        const frac = point === -1 ? '' : out.slice(point + 1)
        if (price >= 1000) expect(frac.length).toBeLessThanOrEqual(2)
        else if (price >= 1) expect(frac.length).toBeLessThanOrEqual(4)
        else expect(frac.length).toBeLessThanOrEqual(8)
      }),
      { numRuns: 800 },
    )
  })

  it('is monotone within the ≥1000 tier', () => {
    fc.assert(
      fc.property(priceArb, priceArb, (a, b) => {
        fc.pre(a < b && a >= 1000 && b >= 1000)
        const pa = Number(formatChartPrice(a, 'en-US').replace(/,/g, ''))
        const pb = Number(formatChartPrice(b, 'en-US').replace(/,/g, ''))
        expect(pb).toBeGreaterThanOrEqual(pa)
      }),
      { numRuns: 600 },
    )
  })
})

describe('cross-formatter properties', () => {
  it('no formatter ever emits NaN text for a finite price', () => {
    fc.assert(
      fc.property(priceArb, (price) => {
        for (const out of [
          formatPrice(price, 'en-US'),
          formatPriceShort(price, 'en-US'),
          formatChartPrice(price, 'en-US'),
        ]) {
          expect(out.toLowerCase()).not.toContain('nan')
        }
      }),
      { numRuns: 500 },
    )
  })

  it('locale choice changes separators but not the digit sequence at a fixed rounding (≥1000 tier)', () => {
    fc.assert(
      fc.property(priceArb, (price) => {
        fc.pre(price >= 1000)
        const digits = (s: string) => s.replace(/[^0-9]/g, '')
        expect(digits(formatPrice(price, 'de-DE'))).toBe(digits(formatPrice(price, 'en-US')))
      }),
      { numRuns: 500 },
    )
  })
})

describe('timeAgo properties', () => {
  // timeAgo reads Date.now() internally; the fake clock is installed at module
  // scope so it is already active when fc.assert generates values.
  const NOW = 1_800_000_000_000

  beforeAll(() => {
    vi.useFakeTimers({ now: NOW })
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  it('always matches one of the documented "Xs|Xm|Xh ago" shapes', () => {
    fc.assert(
      // Domain note: timeAgo floors (Date.now() - ts)/1000, so a future ts
      // yields a negative count — "-3s ago". Its real callers only pass
      // past timestamps, so the property is scoped to the supported domain.
      fc.property(fc.integer({ min: NOW - 100 * 3_600_000, max: NOW }), (ts) => {
        expect(timeAgo(ts)).toMatch(/^\d+[smh] ago$/)
      }),
      { numRuns: 800 },
    )
  })

  it('never emits a negative count for a past timestamp', () => {
    fc.assert(
      fc.property(fc.integer({ min: NOW - 100 * 3_600_000, max: NOW }), (ts) => {
        expect(timeAgo(ts)).not.toMatch(/^-/)
      }),
      { numRuns: 400 },
    )
  })

  it('escalates the unit exactly at the documented boundaries (60s, 60m)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 * 3_600_000 }), (ageMs) => {
        const out = timeAgo(NOW - ageMs)
        if (ageMs < 60_000) expect(out).toMatch(/s ago$/)
        else if (ageMs < 3_600_000) expect(out).toMatch(/m ago$/)
        else expect(out).toMatch(/h ago$/)
      }),
      { numRuns: 600 },
    )
  })
})
