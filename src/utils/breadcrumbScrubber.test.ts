import { describe, it, expect } from 'vitest'
import { scrubBreadcrumb, scrubPersonalData, scrubPersonalText } from './breadcrumbScrubber'

const ACCOUNT = 'GCZST3XJKCCWLZ2TNSKZ3Z6ZXVRVN4UWP6BGFSIEZHMUWDPVTK5SGZOQ'

describe('scrubPersonalText', () => {
  it('replaces email addresses', () => {
    expect(scrubPersonalText('signed in as ada@example.com')).toBe('signed in as [email]')
  })

  it('replaces Stellar account addresses', () => {
    expect(scrubPersonalText(`paid from ${ACCOUNT}`)).toBe('paid from [account]')
  })

  it('replaces IPv4 addresses', () => {
    expect(scrubPersonalText('client 203.0.113.42 timed out')).toBe('client [ip] timed out')
  })

  it('redacts credential query parameters but keeps the rest of the URL', () => {
    expect(scrubPersonalText('GET /data?symbol=XLM&access_token=abc123&limit=5')).toBe(
      'GET /data?symbol=XLM&access_token=[redacted]&limit=5',
    )
  })

  it('leaves ordinary text untouched', () => {
    expect(scrubPersonalText('Starting operation: fetchPrices')).toBe('Starting operation: fetchPrices')
  })
})

describe('scrubPersonalData', () => {
  it('redacts personal keys wholesale, whatever their value', () => {
    expect(scrubPersonalData({ email: 'x', username: 'ada', ok: true })).toEqual({
      email: '[redacted]',
      username: '[redacted]',
      ok: true,
    })
  })

  it('scrubs strings nested inside objects and arrays', () => {
    expect(scrubPersonalData({ notes: ['from ada@example.com', { detail: 'ip 10.0.0.1' }] })).toEqual({
      notes: ['from [email]', { detail: 'ip [ip]' }],
    })
  })

  it('does not mutate its input', () => {
    const input = { email: 'ada@example.com', nested: { text: 'ada@example.com' } }
    scrubPersonalData(input)
    expect(input).toEqual({ email: 'ada@example.com', nested: { text: 'ada@example.com' } })
  })

  it('drops payloads nested deeper than the limit instead of passing them through', () => {
    let deep: unknown = 'ada@example.com'
    for (let i = 0; i < 10; i++) deep = { next: deep }
    expect(JSON.stringify(scrubPersonalData(deep))).not.toContain('ada@example.com')
  })
})

describe('scrubBreadcrumb', () => {
  it('scrubs the message and data of a breadcrumb', () => {
    const crumb = {
      category: 'user-action',
      message: 'Error: could not save for ada@example.com',
      data: { wallet: ACCOUNT, status: 500 },
    }

    expect(scrubBreadcrumb(crumb)).toEqual({
      category: 'user-action',
      message: 'Error: could not save for [email]',
      data: { wallet: '[account]', status: 500 },
    })
  })

  it('passes a breadcrumb without message or data through unchanged', () => {
    expect(scrubBreadcrumb({ category: 'navigation' })).toEqual({ category: 'navigation' })
  })
})
