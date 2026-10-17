import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { maskSecret } from './maskSecret'

describe('maskSecret properties', () => {
  it('preserves length and reveals exactly the visible suffix of a long value', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 200 }), fc.integer({ min: 0, max: 8 }), (value, visible) => {
        fc.pre(value.length > visible)
        const masked = maskSecret(value, visible)
        expect(masked.length).toBe(value.length)
        const hidden = value.length - visible
        expect(masked.slice(0, hidden)).toBe('•'.repeat(hidden))
        expect(masked.slice(hidden)).toBe(value.slice(hidden))
      }),
    )
  })

  it('fully masks any value no longer than the visible suffix', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 8 }), fc.integer({ min: 0, max: 8 }), (value, visible) => {
        fc.pre(value.length <= visible)
        expect(maskSecret(value, visible)).toBe('•'.repeat(value.length))
      }),
    )
  })

  it('is idempotent on its own output when the suffix is the only visible part', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 200 }), (value) => {
        const once = maskSecret(value)
        expect(maskSecret(once)).toBe(once)
      }),
    )
  })
})
