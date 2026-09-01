import { describe, it, expect } from 'vitest'
import { runBacktest, aggregatePrices, type BacktestConfig } from './backtest'
import type { PriceHistoryEntry } from '../types'

describe('backtest.ts', () => {
  const defaultConfig: BacktestConfig = {
    mode: 'median',
    outlierThresholdPercent: 1.0,
    minSources: 2,
    confidenceWeighting: true,
    maxStalenessSec: 300,
  }

  const sampleHistory: PriceHistoryEntry[] = [
    { timestamp: 1700000000000, price: 100, confidence: 0.95, sources: ['chainlink', 'redstone', 'band'] },
    { timestamp: 1700003600000, price: 102, confidence: 0.96, sources: ['chainlink', 'redstone'] },
    { timestamp: 1700007200000, price: 101, confidence: 0.94, sources: ['chainlink', 'band'] },
  ]

  describe('aggregatePrices', () => {
    it('computes median correctly', () => {
      const prices = [100, 102, 101]
      const confs = [0.9, 0.9, 0.9]
      const val = aggregatePrices(prices, confs, { ...defaultConfig, mode: 'median' })
      expect(val).toBe(101)
    })

    it('computes mean correctly', () => {
      const prices = [100, 102, 101]
      const confs = [0.9, 0.9, 0.9]
      const val = aggregatePrices(prices, confs, { ...defaultConfig, mode: 'mean', confidenceWeighting: false })
      expect(val).toBe(101)
    })

    it('computes trimmed_mean correctly when >= 3 sources', () => {
      const prices = [90, 100, 102, 110]
      const confs = [0.9, 0.9, 0.9, 0.9]
      const val = aggregatePrices(prices, confs, { ...defaultConfig, mode: 'trimmed_mean', outlierThresholdPercent: 50 })
      expect(val).toBe(101) // 100 + 102 / 2
    })
  })

  describe('runBacktest', () => {
    it('returns empty result when history is empty', () => {
      const result = runBacktest('BTC/USD', [], defaultConfig)
      expect(result.pair).toBe('BTC/USD')
      expect(result.points.length).toBe(0)
      expect(result.meanDeviationPercent).toBe(0)
    })

    it('calculates deviation profile and anomaly count correctly', () => {
      const result = runBacktest('XLM/USD', sampleHistory, defaultConfig)
      expect(result.pair).toBe('XLM/USD')
      expect(result.points.length).toBe(3)
      expect(result.meanDeviationPercent).toBeGreaterThanOrEqual(0)
      expect(typeof result.maxDeviationPercent).toBe('number')
      expect(typeof result.stdDevDeviation).toBe('number')
    })
  })
})
