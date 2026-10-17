import { describe, expect, it } from 'vitest'
import { SAMPLE_DATA_LABEL, SAMPLE_QUOTES, formatSamplePrice } from './sampleData'

describe('sampleData', () => {
  it('keeps every sample price positive and finite so it can be displayed safely', () => {
    for (const quote of SAMPLE_QUOTES) {
      expect(Number.isFinite(quote.price)).toBe(true)
      expect(quote.price).toBeGreaterThan(0)
    }
  })

  it('names every pair in the expected BASE/QUOTE form', () => {
    for (const quote of SAMPLE_QUOTES) {
      expect(quote.assetPair).toMatch(/^[A-Z]+\/[A-Z]+$/)
    }
  })

  it('labels the data as illustrative so it is never mistaken for live prices', () => {
    expect(SAMPLE_DATA_LABEL).toMatch(/illustrative/i)
    expect(SAMPLE_DATA_LABEL).toMatch(/not live/i)
  })

  it('formats prices with a dollar sign and at least two decimals', () => {
    expect(formatSamplePrice(0.12)).toBe('$0.12')
    expect(formatSamplePrice(65000)).toBe('$65,000.00')
  })
})
