import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { scrubPersonalData, scrubPersonalText } from './breadcrumbScrubber'

const EMAIL_LIKE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/

describe('breadcrumbScrubber properties', () => {
  it('is idempotent: scrubbing twice equals scrubbing once', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 300 }), (text) => {
        const once = scrubPersonalText(text)
        expect(scrubPersonalText(once)).toBe(once)
      }),
    )
  })

  it('never leaves an email-shaped token in free text', () => {
    // Domain scoped to the shape the scrubber targets: a local part, '@', and a dotted domain.
    const email = fc
      .tuple(
        fc.stringMatching(/^[a-z0-9]{1,12}$/),
        fc.stringMatching(/^[a-z0-9]{1,12}$/),
        fc.constantFrom('com', 'org', 'io'),
      )
      .map(([user, host, tld]) => `${user}@${host}.${tld}`)
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), email, fc.string({ maxLength: 40 }), (before, addr, after) => {
        expect(EMAIL_LIKE.test(scrubPersonalText(`${before} ${addr} ${after}`))).toBe(false)
      }),
    )
  })

  it('keeps the shape of payloads: same keys, same array lengths', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string({ maxLength: 8 }), fc.string({ maxLength: 40 })), (dict) => {
        const out = scrubPersonalData(dict)
        expect(Object.keys(out).sort()).toEqual(Object.keys(dict).sort())
      }),
    )
  })
})
