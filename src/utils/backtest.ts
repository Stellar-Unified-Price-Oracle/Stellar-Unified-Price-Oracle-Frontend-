/**
 * @file backtest.ts
 *
 * Client-side Backtesting Tool logic for testing oracle price aggregation modes
 * and outlier thresholds against historical feed data (#464).
 */
import type { PriceHistoryEntry } from '../types'
import { downloadFile, toCsv } from './export'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AggregationMode = 'median' | 'weighted_mean' | 'mean' | 'trimmed_mean' | 'vwap'

export interface BacktestConfig {
  mode: AggregationMode
  outlierThresholdPercent: number
  minSources: number
  confidenceWeighting: boolean
  maxStalenessSec: number
}

export interface BacktestPreset {
  id: string
  name: string
  config: BacktestConfig
}

export interface BacktestPoint {
  timestamp: number
  rawPrice: number
  baselinePrice: number
  backtestedPrice: number
  deviationPercent: number
  isOutlier: boolean
  isAnomaly: boolean
}

export interface BacktestResult {
  pair: string
  config: BacktestConfig
  points: BacktestPoint[]
  meanDeviationPercent: number
  maxDeviationPercent: number
  stdDevDeviation: number
  anomalyCount: number
  anomalyRatePercent: number
  outliersFilteredCount: number
}

// ── Pure Aggregation Functions ────────────────────────────────────────────────

/**
 * Calculates aggregated price for a single set of source prices based on configuration.
 */
export function aggregatePrices(
  prices: number[],
  confidences: number[],
  config: BacktestConfig,
): number {
  if (prices.length === 0) return 0
  if (prices.length < config.minSources) {
    // Fallback to simple average if below minimum required sources
    return prices.reduce((a, b) => a + b, 0) / prices.length
  }

  const { mode, confidenceWeighting, outlierThresholdPercent } = config

  // Outlier detection: filter out values that deviate more than threshold from median
  const sorted = [...prices].sort((a, b) => a - b)
  const medianVal =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)]

  const filteredPairs = prices
    .map((p, i) => ({ price: p, conf: confidences[i] ?? 1.0 }))
    .filter((item) => {
      if (medianVal === 0) return true
      const dev = Math.abs((item.price - medianVal) / medianVal) * 100
      return dev <= outlierThresholdPercent
    })

  const active = filteredPairs.length > 0 ? filteredPairs : prices.map((p, i) => ({ price: p, conf: confidences[i] ?? 1.0 }))

  if (mode === 'median') {
    const s = active.map((a) => a.price).sort((a, b) => a - b)
    const mid = Math.floor(s.length / 2)
    return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
  }

  if (mode === 'trimmed_mean') {
    const s = active.map((a) => a.price).sort((a, b) => a - b)
    if (s.length >= 3) {
      // Trim lowest and highest value
      const trimmed = s.slice(1, -1)
      return trimmed.reduce((a, b) => a + b, 0) / trimmed.length
    }
    return s.reduce((a, b) => a + b, 0) / s.length
  }

  if (mode === 'weighted_mean' || (confidenceWeighting && (mode === 'mean' || mode === 'vwap'))) {
    let weightSum = 0
    let weightedValSum = 0
    for (const item of active) {
      const w = Math.max(0.01, item.conf)
      weightSum += w
      weightedValSum += item.price * w
    }
    return weightSum > 0 ? weightedValSum / weightSum : active[0].price
  }

  // Default arithmetic mean
  const sum = active.reduce((acc, curr) => acc + curr.price, 0)
  return sum / active.length
}

// ── Backtest Execution ────────────────────────────────────────────────────────

/**
 * Runs a client-side backtest over historical price entries for a given asset pair.
 */
export function runBacktest(
  pair: string,
  history: PriceHistoryEntry[],
  config: BacktestConfig,
): BacktestResult {
  if (history.length === 0) {
    return {
      pair,
      config,
      points: [],
      meanDeviationPercent: 0,
      maxDeviationPercent: 0,
      stdDevDeviation: 0,
      anomalyCount: 0,
      anomalyRatePercent: 0,
      outliersFilteredCount: 0,
    }
  }

  let outliersFilteredCount = 0
  let anomalyCount = 0

  const points: BacktestPoint[] = history.map((entry) => {
    const rawPrice = entry.price
    const baselinePrice = entry.price

    // Synthesize source variations around entry.price for realistic multi-source simulation
    const sourceCount = Math.max(1, entry.sources.length)
    const mockPrices: number[] = []
    const mockConfs: number[] = []

    for (let i = 0; i < sourceCount; i++) {
      // Generate slight source variance (-0.4% to +0.4%)
      const variance = (i % 2 === 0 ? 1 : -1) * (i * 0.002)
      let srcPrice = rawPrice * (1 + variance)

      // Inject synthetic outlier on 5% of historical points for testing outlier filtering
      const isSyntheticOutlier = (entry.timestamp + i) % 20 === 0
      if (isSyntheticOutlier) {
        srcPrice = srcPrice * 1.03 // +3% spike
        outliersFilteredCount++
      }

      mockPrices.push(srcPrice)
      mockConfs.push(entry.confidence)
    }

    const backtestedPrice = aggregatePrices(mockPrices, mockConfs, config)

    const deviationPercent = baselinePrice !== 0
      ? Math.abs((backtestedPrice - baselinePrice) / baselinePrice) * 100
      : 0

    const isAnomaly = deviationPercent > config.outlierThresholdPercent
    if (isAnomaly) {
      anomalyCount++
    }

    return {
      timestamp: entry.timestamp,
      rawPrice,
      baselinePrice,
      backtestedPrice,
      deviationPercent,
      isOutlier: mockPrices.length !== sourceCount,
      isAnomaly,
    }
  })

  // Summary statistical calculations
  const totalDev = points.reduce((acc, p) => acc + p.deviationPercent, 0)
  const meanDeviationPercent = points.length > 0 ? totalDev / points.length : 0
  const maxDeviationPercent = points.length > 0 ? Math.max(...points.map((p) => p.deviationPercent)) : 0

  const varianceSum = points.reduce(
    (acc, p) => acc + Math.pow(p.deviationPercent - meanDeviationPercent, 2),
    0,
  )
  const stdDevDeviation = points.length > 0 ? Math.sqrt(varianceSum / points.length) : 0
  const anomalyRatePercent = points.length > 0 ? (anomalyCount / points.length) * 100 : 0

  return {
    pair,
    config,
    points,
    meanDeviationPercent,
    maxDeviationPercent,
    stdDevDeviation,
    anomalyCount,
    anomalyRatePercent,
    outliersFilteredCount,
  }
}

// ── Export Helpers ────────────────────────────────────────────────────────────

/**
 * Triggers a CSV download of the backtest summary and point-by-point comparison.
 */
export function exportBacktestCsv(result: BacktestResult): void {
  const headers = [
    'timestamp',
    'baselinePrice',
    'backtestedPrice',
    'deviationPercent',
    'isAnomaly',
  ]

  const rows = result.points.map((p) => ({
    timestamp: new Date(p.timestamp).toISOString(),
    baselinePrice: p.baselinePrice,
    backtestedPrice: p.backtestedPrice,
    deviationPercent: parseFloat(p.deviationPercent.toFixed(4)),
    isAnomaly: p.isAnomaly ? 'YES' : 'NO',
  }))

  const safePair = result.pair.replace(/\//g, '-')
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  const filename = `backtest_${safePair}_${result.config.mode}_${ts}.csv`
  downloadFile(toCsv(rows, headers), filename, 'text/csv')
}

/**
 * Triggers a JSON download of the backtest summary and configuration.
 */
export function exportBacktestJson(result: BacktestResult): void {
  const payload = {
    pair: result.pair,
    config: result.config,
    summary: {
      totalPoints: result.points.length,
      meanDeviationPercent: parseFloat(result.meanDeviationPercent.toFixed(4)),
      maxDeviationPercent: parseFloat(result.maxDeviationPercent.toFixed(4)),
      stdDevDeviation: parseFloat(result.stdDevDeviation.toFixed(4)),
      anomalyCount: result.anomalyCount,
      anomalyRatePercent: parseFloat(result.anomalyRatePercent.toFixed(2)),
      outliersFilteredCount: result.outliersFilteredCount,
    },
    points: result.points.map((p) => ({
      timestamp: p.timestamp,
      baselinePrice: p.baselinePrice,
      backtestedPrice: p.backtestedPrice,
      deviationPercent: parseFloat(p.deviationPercent.toFixed(4)),
      isAnomaly: p.isAnomaly,
    })),
  }

  const safePair = result.pair.replace(/\//g, '-')
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  const filename = `backtest_${safePair}_${result.config.mode}_${ts}.json`
  downloadFile(JSON.stringify(payload, null, 2), filename, 'application/json')
}
