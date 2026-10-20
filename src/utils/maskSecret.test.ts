import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { maskSecret } from './maskSecret'

describe('maskSecret', () => {
  it('returns an empty string for an empty value', () => {
    expect(maskSecret('')).toBe('')
  })

  it('keeps only the last four characters by default', () => {
    expect(maskSecret('https://discord.com/api/webhooks/123/abcdef-TOKEN')).toBe('••••OKEN')
  })

  it('fully hides values no longer than the visible window', () => {
    expect(maskSecret('abc')).toBe('••••')
    expect(maskSecret('abcd')).toBe('••••')
  })

  it('respects a custom visible count', () => {
    expect(maskSecret('supersecret', 2)).toBe('••••et')
  })

  it('never reveals more than the visible tail', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 200 }), fc.integer({ min: 0, max: 8 }), (value, visible) => {
        const masked = maskSecret(value, visible)
        const revealed = masked.slice(4)
        expect(masked.startsWith('••••')).toBe(true)
        expect(revealed.length).toBeLessThanOrEqual(visible)
        expect(value.endsWith(revealed)).toBe(true)
      }),
    )
  })
})
