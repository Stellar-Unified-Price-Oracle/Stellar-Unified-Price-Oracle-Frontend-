import { describe, it, expect } from 'vitest'
import { maskSecret } from './maskSecret'

describe('maskSecret', () => {
  it('returns an empty string for an empty value', () => {
    expect(maskSecret('')).toBe('')
  })

  it('keeps only the last four characters of a long secret', () => {
    expect(maskSecret('abcdefgh1234')).toBe('••••••••1234')
  })

  it('fully masks a value no longer than the visible suffix', () => {
    expect(maskSecret('abc')).toBe('•••')
    expect(maskSecret('abcd')).toBe('••••')
  })

  it('reveals only the suffix when one character longer than the visible length', () => {
    expect(maskSecret('abcde')).toBe('•bcde')
  })

  it('honours a custom visible length', () => {
    expect(maskSecret('abcdefgh', 2)).toBe('••••••gh')
  })
})
