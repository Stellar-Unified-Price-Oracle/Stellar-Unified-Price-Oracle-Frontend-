import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PriceData } from '../types'
import {
  selectSortedPrices,
  selectAverageConfidence,
  selectTopMovers,
  selectStaleAssets,
} from './priceSelectors'
import { createSelector } from './createSelector'

const mockPrices: PriceData[] = [
  { assetPair: 'ETH/USD', price: 3000, timestamp: Date.now() - 60_000, confidence: 0.95, sources: ['chainlink'] },
  { assetPair: 'BTC/USD', price: 50000, timestamp: Date.now() - 120_000, confidence: 0.99, sources: ['chainlink', 'redstone'] },
  { assetPair: 'XRP/USD', price: 0.5, timestamp: Date.now() - 10_000, confidence: 0.88, sources: ['band'] },
]

const stalePrices: PriceData[] = [
  { assetPair: 'OLD/USD', price: 1, timestamp: Date.now() - 10 * 60 * 1000, confidence: 0.5, sources: [] },
  { assetPair: 'FRESH/USD', price: 2, timestamp: Date.now() - 1000, confidence: 0.9, sources: [] },
]

describe('createSelector', () => {
  it('returns memoized result for same input reference', () => {
    const selector = createSelector<number[], number>(
      [(nums) => nums],
      (nums) => (nums as number[]).reduce((a, b) => a + b, 0),
    )
    const input = [1, 2, 3]
    const first = selector(input)
    const second = selector(input)
    expect(first).toBe(6)
    expect(second).toBe(6)
  })

  it('recomputes when input changes', () => {
    const selector = createSelector<number[], number>(
      [(nums) => nums],
      (nums) => (nums as number[]).reduce((a, b) => a + b, 0),
    )
    expect(selector([1, 2, 3])).toBe(6)
    expect(selector([4, 5, 6])).toBe(15)
  })
})

describe('selectSortedPrices', () => {
  it('returns prices sorted alphabetically by assetPair', () => {
    const result = selectSortedPrices(mockPrices)
    const pairs = result.map((p) => p.assetPair)
    expect(pairs).toEqual(['BTC/USD', 'ETH/USD', 'XRP/USD'])
  })

  it('does not mutate the original array', () => {
    const original = [...mockPrices]
    selectSortedPrices(mockPrices)
    expect(mockPrices).toEqual(original)
  })

  it('returns empty array for empty input', () => {
    expect(selectSortedPrices([])).toEqual([])
  })

  it('returns memoized result for same input reference', () => {
    const first = selectSortedPrices(mockPrices)
    const second = selectSortedPrices(mockPrices)
    expect(first).toBe(second)
  })
})

describe('selectAverageConfidence', () => {
  it('calculates average confidence', () => {
    const avg = selectAverageConfidence(mockPrices)
    const expected = (0.95 + 0.99 + 0.88) / 3
    expect(avg).toBe(expected)
  })

  it('returns 0 for empty array', () => {
    expect(selectAverageConfidence([])).toBe(0)
  })

  it('returns confidence of single price', () => {
    expect(selectAverageConfidence([mockPrices[0]])).toBe(0.95)
  })

  it('returns memoized result for same input reference', () => {
    const first = selectAverageConfidence(mockPrices)
    const second = selectAverageConfidence(mockPrices)
    expect(first).toBe(second)
  })
})

describe('selectTopMovers', () => {
  it('returns top N prices by confidence', () => {
    const result = selectTopMovers(mockPrices, 2)
    expect(result).toHaveLength(2)
    expect(result[0].assetPair).toBe('BTC/USD')
    expect(result[1].assetPair).toBe('ETH/USD')
  })

  it('returns all prices when count exceeds length', () => {
    const result = selectTopMovers(mockPrices, 10)
    expect(result).toHaveLength(3)
  })

  it('returns empty array for empty input', () => {
    expect(selectTopMovers([], 5)).toEqual([])
  })
})

describe('selectStaleAssets', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('filters assets older than threshold', () => {
    const result = selectStaleAssets(stalePrices, 5 * 60 * 1000)
    expect(result).toHaveLength(1)
    expect(result[0].assetPair).toBe('OLD/USD')
  })

  it('uses default 5min threshold when not provided', () => {
    const result = selectStaleAssets(stalePrices)
    expect(result).toHaveLength(1)
    expect(result[0].assetPair).toBe('OLD/USD')
  })

  it('returns empty array when no assets are stale', () => {
    const fresh = stalePrices.map((p) => ({ ...p, timestamp: Date.now() }))
    const result = selectStaleAssets(fresh, 5 * 60 * 1000)
    expect(result).toEqual([])
  })

  it('returns empty array for empty input', () => {
    expect(selectStaleAssets([], 5 * 60 * 1000)).toEqual([])
  })
})
