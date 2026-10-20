import { describe, expect, it } from 'vitest'
import { invertPair, invertPrice, previewPairInversion } from './pairInversion'

describe('invertPair', () => {
  it('swaps base and quote and keeps the separator', () => {
    expect(invertPair('XLM/USD')).toBe('USD/XLM')
    expect(invertPair('USD-XLM')).toBe('XLM-USD')
  })

  it('returns null for a pair without a single separator', () => {
    expect(invertPair('XLMUSD')).toBeNull()
    expect(invertPair('XLM/USD/EUR')).toBeNull()
    expect(invertPair('')).toBeNull()
  })
})

describe('invertPrice', () => {
  it('returns the reciprocal of a positive finite price', () => {
    expect(invertPrice(0.25)).toBe(4)
    expect(invertPrice(2)).toBe(0.5)
  })

  it('refuses prices that have no meaningful reciprocal', () => {
    expect(invertPrice(0)).toBeNull()
    expect(invertPrice(-1)).toBeNull()
    expect(invertPrice(Number.NaN)).toBeNull()
    expect(invertPrice(Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('previewPairInversion', () => {
  it('marks the inverted pair as tracked only when the app knows it', () => {
    expect(previewPairInversion('USD/XLM', 8)).toEqual({
      from: 'USD/XLM',
      to: 'XLM/USD',
      invertedPrice: 0.125,
      tracked: true,
    })
    expect(previewPairInversion('XLM/USD', 0.12)).toMatchObject({ to: 'USD/XLM', tracked: false })
  })

  it('has no inverted price when the current price is missing or unusable', () => {
    expect(previewPairInversion('USD/XLM', null)?.invertedPrice).toBeNull()
    expect(previewPairInversion('USD/XLM', undefined)?.invertedPrice).toBeNull()
    expect(previewPairInversion('USD/XLM', 0)?.invertedPrice).toBeNull()
  })

  it('returns null for a malformed pair', () => {
    expect(previewPairInversion('XLM', 1)).toBeNull()
  })
})
