import { describe, it, expect, beforeEach } from 'vitest'
import fc from 'fast-check'
import { PII_DENYLIST, containsPii, validateEvent, TELEMETRY_SCHEMA_VERSION } from './schema'
import { track, readBuffer, setConsent } from './telemetry'

const HOUR = 3_600_000

const FEATURES = ['alerts', 'export', 'compare', 'onchain', 'search', 'chart', 'webhooks', 'governance'] as const
const featureArb = fc.constantFrom(...FEATURES)

/** A Stellar public key: "G" followed by 55 base32 characters. */
const stellarKeyArb = fc.stringMatching(/^G[A-Z2-7]{55}$/)

/** Safe wrapper keys that never collide with the denylist, so only the planted value can trip the check. */
const safeKeyArb = fc.constantFrom('meta', 'items', 'detail', 'extra')

/** Nests `leaf` under up to two safe wrapper levels, mixing objects and arrays. */
function nestedArb(leaf: fc.Arbitrary<unknown>): fc.Arbitrary<unknown> {
  return fc.oneof(
    leaf,
    fc.tuple(safeKeyArb, leaf).map(([k, v]) => ({ [k]: v })),
    fc.tuple(safeKeyArb, leaf).map(([k, v]) => ({ [k]: [v] })),
    fc.tuple(safeKeyArb, safeKeyArb, leaf).map(([a, b, v]) => ({ [a]: { [b]: v } })),
  )
}

beforeEach(() => localStorage.clear())

describe('telemetry classification (property)', () => {
  it('rejects any event whose props carry a denylisted key, however it is spelled', () => {
    fc.assert(
      fc.property(
        featureArb,
        fc.constantFrom(...PII_DENYLIST),
        fc.string({ maxLength: 8 }),
        fc.string({ minLength: 1, maxLength: 12 }),
        (feature, term, affix, value) => {
          // Case-insensitive substring match: upper-case the term to prove the match ignores case.
          const key = `${affix}${term.toUpperCase()}`
          const event = validateEvent({
            v: TELEMETRY_SCHEMA_VERSION,
            name: 'feature_used',
            ts: 0,
            installId: 'abcdef12-3456',
            props: { feature, [key]: value },
          })
          expect(event).toBeNull()
        },
      ),
    )
  })

  it('flags a Stellar public key planted at any nesting depth', () => {
    fc.assert(
      fc.property(nestedArb(stellarKeyArb), (value) => {
        expect(containsPii(value)).toBe(true)
      }),
    )
  })

  it('passes an allow-listed event through unchanged for any valid props', () => {
    fc.assert(
      fc.property(featureArb, fc.integer({ min: 0, max: 600_000 }), (feature, durationMs) => {
        const props = { feature }
        const event = validateEvent({
          v: TELEMETRY_SCHEMA_VERSION,
          name: 'feature_used',
          ts: 0,
          installId: 'abcdef12-3456',
          props,
        })
        expect(event?.props).toEqual(props)

        const timed = validateEvent({
          v: TELEMETRY_SCHEMA_VERSION,
          name: 'dashboard_loaded',
          ts: 0,
          installId: 'abcdef12-3456',
          props: { success: true, durationMs },
        })
        expect(timed?.props).toEqual({ success: true, durationMs })
      }),
    )
  })
})

describe('telemetry recording (property)', () => {
  it('records nothing for any props while consent is unset or denied', () => {
    fc.assert(
      fc.property(featureArb, fc.constantFrom('unset', 'denied'), (feature, consent) => {
        localStorage.clear()
        if (consent === 'denied') setConsent('denied')
        expect(track('feature_used', { feature })).toBe(false)
        expect(readBuffer()).toEqual([])
      }),
    )
  })

  it('stores timestamps truncated to the hour, never in the future', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_000_000_000_000 }), (now) => {
        localStorage.clear()
        setConsent('granted')
        expect(track('feature_used', { feature: 'alerts' }, now)).toBe(true)

        const [stored] = readBuffer()
        expect(stored.ts % HOUR).toBe(0)
        expect(stored.ts).toBeLessThanOrEqual(now)
        expect(now - stored.ts).toBeLessThan(HOUR)
      }),
    )
    setConsent('denied')
  })
})
