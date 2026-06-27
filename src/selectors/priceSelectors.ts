import { createSelector } from './createSelector'
import type { PriceData } from '../types'

const STALE_THRESHOLD_MS = 5 * 60 * 1000

export const selectSortedPrices = createSelector<PriceData[], PriceData[]>(
  [(prices) => prices],
  (prices) => [...(prices as PriceData[])].sort((a, b) => a.assetPair.localeCompare(b.assetPair)),
)

export const selectAverageConfidence = createSelector<PriceData[], number>(
  [(prices) => prices],
  (prices) => {
    const arr = prices as PriceData[]
    if (arr.length === 0) return 0
    return arr.reduce((sum, p) => sum + p.confidence, 0) / arr.length
  },
)

export function selectTopMovers(prices: PriceData[], count: number): PriceData[] {
  return [...prices].sort((a, b) => b.confidence - a.confidence).slice(0, count)
}

export function selectStaleAssets(
  prices: PriceData[],
  thresholdMs: number = STALE_THRESHOLD_MS,
): PriceData[] {
  const now = Date.now()
  return prices.filter((p) => now - p.timestamp > thresholdMs)
}
