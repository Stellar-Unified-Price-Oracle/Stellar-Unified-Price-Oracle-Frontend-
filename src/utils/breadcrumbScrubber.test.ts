import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { scrubBreadcrumb, scrubBreadcrumbData, scrubString, SCRUBBED } from './breadcrumbScrubber'

describe('scrubString', () => {
  it('masks email addresses inside free text', () => {
    expect(scrubString('failed for jane.doe+ops@example.co.uk today')).toBe('failed for [email] today')
  })

  it('masks IPv4 addresses inside free text', () => {
    expect(scrubString('request from 203.0.113.42 timed out')).toBe('request from [ip] timed out')
  })

  it('leaves ordinary text untouched', () => {
    expect(scrubString('price feed stale for XLM/USD')).toBe('price feed stale for XLM/USD')
  })
})

describe('scrubBreadcrumbData', () => {
  it('drops values under personal-data keys regardless of casing or separators', () => {
    const out = scrubBreadcrumbData({ Email: 'a@b.co', phone_number: '+1555', fullName: 'Ada', ipAddress: '10.0.0.1' })
    expect(out).toEqual({ Email: SCRUBBED, phone_number: SCRUBBED, fullName: SCRUBBED, ipAddress: SCRUBBED })
  })

  it('recurses into nested objects and arrays', () => {
    const out = scrubBreadcrumbData({ req: { headers: [{ user: { email: 'x@y.io' } }] } })
    expect(out).toEqual({ req: { headers: [{ user: { email: SCRUBBED } }] } })
  })

  it('keeps non-personal fields intact', () => {
    expect(scrubBreadcrumbData({ pair: 'XLM/USD', count: 3, ok: true, n: null })).toEqual({
      pair: 'XLM/USD',
      count: 3,
      ok: true,
      n: null,
    })
  })

  it('does not mutate its input', () => {
    const input = { email: 'a@b.co', note: 'from 1.2.3.4' }
    scrubBreadcrumbData(input)
    expect(input).toEqual({ email: 'a@b.co', note: 'from 1.2.3.4' })
  })

  it('stops at a bounded depth so cyclic payloads terminate', () => {
    const cyclic: Record<string, unknown> = { label: 'loop' }
    cyclic.self = cyclic
    expect(() => scrubBreadcrumbData(cyclic)).not.toThrow()
  })
})

describe('scrubBreadcrumb', () => {
  it('scrubs both message and data and preserves other fields', () => {
    const out = scrubBreadcrumb({ message: 'user a@b.co hit 10.1.1.1', data: { password: 'x' }, category: 'ui' })
    expect(out).toEqual({ message: 'user [email] hit [ip]', data: { password: 'x' }, category: 'ui' })
  })

  it('leaves a breadcrumb without message or data as is', () => {
    expect(scrubBreadcrumb({ category: 'navigation' })).toEqual({ category: 'navigation' })
  })
})

describe('breadcrumb scrubbing invariants', () => {
  it('never leaves the value of a personal key in the output', () => {
    fc.assert(
      fc.property(fc.constantFrom('email', 'phone', 'username', 'fullName', 'ipAddress'), fc.string(), (key, value) => {
        const out = scrubBreadcrumbData({ [key]: value }) as Record<string, unknown>
        expect(out[key]).toBe(SCRUBBED)
      }),
    )
  })

  it('never emits a raw email address from free text', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{3,10}$/), fc.stringMatching(/^[a-z]{3,10}$/), (local, domain) => {
        const text = `contact ${local}@${domain}.com now`
        expect(scrubString(text)).not.toContain(`${local}@${domain}`)
      }),
    )
  })
})
