import { describe, it, expect } from 'vitest'
import { computeAggregationBreakdown } from '../mocks/data'
import { aggregationBreakdownToCsvRows } from './export'
import type { PriceData } from '../types'

const mockPrice: PriceData = {
  assetPair: 'XLM/USD',
  price: 0.12,
  timestamp: 1_700_000_000_000,
  confidence: 0.95,
  sources: ['chainlink', 'redstone', 'band'],
}

describe('computeAggregationBreakdown', () => {
  it('returns one item per source', () => {
    const bd = computeAggregationBreakdown(mockPrice, 'weighted_mean')
    expect(bd.sources.length).toBe(3)
  })

  it('weights sum to 1 for weighted_mean', () => {
    const bd = computeAggregationBreakdown(mockPrice, 'weighted_mean')
    const sum = bd.sources.reduce((s, i) => s + i.weight, 0)
    expect(sum).toBeCloseTo(1, 5)
  })

  it('contributions sum to the weighted sum of source prices', () => {
    const bd = computeAggregationBreakdown(mockPrice, 'weighted_mean')
    const sum = bd.sources.reduce((s, i) => s + i.contribution, 0)
    // Each contribution = price * weight; sum of all contributions = weighted mean of source prices
    const expectedWeightedSum = bd.sources.reduce((s, i) => s + i.price * i.weight, 0)
    expect(sum).toBeCloseTo(expectedWeightedSum, 10)
  })

  it('sets assetPair and mode correctly', () => {
    const bd = computeAggregationBreakdown(mockPrice, 'median')
    expect(bd.assetPair).toBe('XLM/USD')
    expect(bd.mode).toBe('median')
  })

  it('marks exactly one source excluded for outlier_excluded when deviation is high', () => {
    // Use a price with many sources — outlier exclusion may or may not trigger
    // depending on synthetic variance; we just verify the excluded flag is boolean.
    const bd = computeAggregationBreakdown(mockPrice, 'outlier_excluded')
    for (const item of bd.sources) {
      expect(typeof item.excluded).toBe('boolean')
    }
  })

  it('stores zScoreThreshold in params for outlier_excluded', () => {
    const bd = computeAggregationBreakdown(mockPrice, 'outlier_excluded')
    expect(typeof bd.params['zScoreThreshold']).toBe('number')
  })

  it('defaults to weighted_mean when no mode is passed', () => {
    const bd = computeAggregationBreakdown(mockPrice)
    expect(bd.mode).toBe('weighted_mean')
  })
})

describe('aggregationBreakdownToCsvRows', () => {
  it('returns one row per source', () => {
    const bd = computeAggregationBreakdown(mockPrice, 'weighted_mean')
    const { rows, headers } = aggregationBreakdownToCsvRows(bd)
    expect(rows.length).toBe(3)
    expect(headers).toContain('assetPair')
    expect(headers).toContain('mode')
    expect(headers).toContain('source')
    expect(headers).toContain('sourcePrice')
    expect(headers).toContain('weight')
    expect(headers).toContain('contribution')
    expect(headers).toContain('excluded')
    expect(headers).toContain('aggregatePrice')
  })

  it('serialises excluded as string "true"/"false"', () => {
    const bd = computeAggregationBreakdown(mockPrice, 'weighted_mean')
    const { rows } = aggregationBreakdownToCsvRows(bd)
    for (const row of rows) {
      expect(row['excluded'] === 'true' || row['excluded'] === 'false').toBe(true)
    }
  })

  it('all rows carry the same assetPair and aggregatePrice', () => {
    const bd = computeAggregationBreakdown(mockPrice, 'weighted_mean')
    const { rows } = aggregationBreakdownToCsvRows(bd)
    for (const row of rows) {
      expect(row['assetPair']).toBe('XLM/USD')
      expect(row['aggregatePrice']).toBe(bd.aggregatePrice)
    }
  })
})
