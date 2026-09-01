/**
 * Chart Aggregation Worker — `src/workers/chartAggregation.worker.ts`
 *
 * Aggregates raw price history into OHLC candles and performs LTTB (Largest
 * Triangle Three Buckets) downsampling for chart rendering, entirely on a
 * background thread.
 */

import { expose } from 'comlink'
import type { PriceHistoryEntry } from '../types'
import type {
  AggregateChartInput,
  AggregateChartOutput,
  AggregatedCandle,
  AggregationInterval,
  ResampleInput,
  ResampleOutput,
  WorkerProgress,
  ComputeIndicatorsInput,
  ComputeIndicatorsOutput,
  IndicatorSeries,
} from './types'

/** Interval bucket sizes in milliseconds. */
const INTERVAL_MS: Record<AggregationInterval, number> = {
  '1min':  60_000,
  '5min':  300_000,
  '15min': 900_000,
  '1hr':   3_600_000,
  '4hr':   14_400_000,
  '1d':    86_400_000,
}

/**
 * Buckets history entries into fixed-width time intervals and reduces each
 * bucket to an OHLC candle.
 */
function buildCandles(
  history: PriceHistoryEntry[],
  bucketMs: number,
): AggregatedCandle[] {
  if (history.length === 0) return []

  // Sort ascending by timestamp (in-place on a copy)
  const sorted = history.slice().sort((a, b) => a.timestamp - b.timestamp)

  const candles: AggregatedCandle[] = []
  let bucketStart = Math.floor(sorted[0].timestamp / bucketMs) * bucketMs
  let open = sorted[0].price
  let high = sorted[0].price
  let low = sorted[0].price
  let close = sorted[0].price
  let confidenceSum = sorted[0].confidence
  let count = 1

  for (let i = 1; i < sorted.length; i++) {
    const entry = sorted[i]
    const entryBucket = Math.floor(entry.timestamp / bucketMs) * bucketMs

    if (entryBucket === bucketStart) {
      // Same bucket — update OHLC
      if (entry.price > high) high = entry.price
      if (entry.price < low) low = entry.price
      close = entry.price
      confidenceSum += entry.confidence
      count++
    } else {
      // Emit the completed candle
      candles.push({ timestamp: bucketStart, open, high, low, close, avgConfidence: confidenceSum / count, count })

      // Fill gaps between buckets with flat candles (same close → open)
      let nextBucket = bucketStart + bucketMs
      while (nextBucket < entryBucket) {
        candles.push({ timestamp: nextBucket, open: close, high: close, low: close, close, avgConfidence: close, count: 0 })
        nextBucket += bucketMs
      }

      // Start new bucket
      bucketStart = entryBucket
      open = entry.price
      high = entry.price
      low = entry.price
      close = entry.price
      confidenceSum = entry.confidence
      count = 1
    }
  }

  // Emit the final (possibly partial) candle
  candles.push({ timestamp: bucketStart, open, high, low, close, avgConfidence: confidenceSum / count, count })

  return candles
}

/**
 * Largest Triangle Three Buckets (LTTB) downsampling algorithm.
 * Preserves the visual shape of a time-series while reducing the number of
 * points to {@link targetPoints}.
 *
 * Reference: Sveinn Steinarsson, "Downsampling Time Series for Visual
 * Representation", Reykjavík University, 2013.
 */
function lttb(data: PriceHistoryEntry[], targetPoints: number): PriceHistoryEntry[] {
  const n = data.length
  if (n <= targetPoints || targetPoints < 3) return data

  const sampled: PriceHistoryEntry[] = [data[0]]
  const bucketSize = (n - 2) / (targetPoints - 2)

  let prevIdx = 0

  for (let i = 0; i < targetPoints - 2; i++) {
    // Calculate the range of the next bucket
    const nextBucketStart = Math.floor((i + 1) * bucketSize) + 1
    const nextBucketEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, n)

    // Average point in the next bucket
    let avgTimestamp = 0
    let avgPrice = 0
    const nextBucketSize = nextBucketEnd - nextBucketStart
    for (let j = nextBucketStart; j < nextBucketEnd; j++) {
      avgTimestamp += data[j].timestamp
      avgPrice += data[j].price
    }
    avgTimestamp /= nextBucketSize
    avgPrice /= nextBucketSize

    // Current bucket range
    const currentBucketStart = Math.floor(i * bucketSize) + 1
    const currentBucketEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, n)

    const prev = data[prevIdx]
    let maxArea = -1
    let maxIdx = currentBucketStart

    for (let j = currentBucketStart; j < currentBucketEnd; j++) {
      // Triangle area between prev, current candidate, and next-bucket average
      const area = Math.abs(
        (prev.timestamp - avgTimestamp) * (data[j].price - prev.price) -
        (prev.timestamp - data[j].timestamp) * (avgPrice - prev.price),
      ) * 0.5

      if (area > maxArea) {
        maxArea = area
        maxIdx = j
      }
    }

    sampled.push(data[maxIdx])
    prevIdx = maxIdx
  }

  sampled.push(data[n - 1])
  return sampled
}

function computeSMA(prices: number[], period: number): (number | null)[] {
  return prices.map((_, i) => {
    if (i < period - 1) return null
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += prices[j]
    return sum / period
  })
}

function computeEMA(prices: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1)
  const result: (number | null)[] = new Array(prices.length).fill(null)
  if (prices.length < period) return result
  // Seed with first SMA
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
  result[period - 1] = ema
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k)
    result[i] = ema
  }
  return result
}

function computeRSI(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(prices.length).fill(null)
  if (prices.length < period + 1) return result
  let gains = 0
  let losses = 0
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1]
    if (diff > 0) gains += diff
    else losses -= diff
  }
  let avgGain = gains / period
  let avgLoss = losses / period
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return result
}

export class ChartAggregationWorker {
  /**
   * Aggregates price history into OHLC candles for the given interval.
   * Reports progress once after completing.
   */
  aggregateChart(
    input: AggregateChartInput,
    onProgress?: (progress: WorkerProgress) => void,
  ): AggregateChartOutput {
    const { taskId, pair, history, interval } = input
    onProgress?.({ taskId, processed: 0, total: history.length, message: 'aggregating…' })

    const bucketMs = INTERVAL_MS[interval]
    const candles = buildCandles(history, bucketMs)

    onProgress?.({ taskId, processed: history.length, total: history.length, message: 'done' })

    return { taskId, pair, candles, interval }
  }

  /**
   * Downsamples price history to {@link ResampleInput.targetPoints} using LTTB.
   * Preserves the first and last entries.
   */
  resample(
    input: ResampleInput,
    onProgress?: (progress: WorkerProgress) => void,
  ): ResampleOutput {
    const { taskId, pair, history, targetPoints } = input
    onProgress?.({ taskId, processed: 0, total: history.length, message: 'resampling…' })

    const sampled = lttb(history, targetPoints)

    onProgress?.({ taskId, processed: history.length, total: history.length, message: 'done' })

    return { taskId, pair, history: sampled }
  }

  /**
   * Computes one or more technical indicators (SMA, EMA, RSI) over a price
   * history. Each indicator series is parallel to the input history array,
   * with null values for points before the indicator has enough data.
   */
  computeIndicators(
    input: ComputeIndicatorsInput,
    onProgress?: (progress: WorkerProgress) => void,
  ): ComputeIndicatorsOutput {
    const { taskId, pair, history, indicators } = input
    onProgress?.({ taskId, processed: 0, total: indicators.length, message: 'computing indicators…' })

    const prices = history.map((h) => h.price)
    const series: IndicatorSeries[] = []

    for (const cfg of indicators) {
      if (!cfg.enabled) continue
      let values: (number | null)[]
      if (cfg.type === 'sma') {
        values = computeSMA(prices, cfg.period)
      } else if (cfg.type === 'ema') {
        values = computeEMA(prices, cfg.period)
      } else {
        values = computeRSI(prices, cfg.period)
      }
      series.push({ type: cfg.type, period: cfg.period, values })
    }

    onProgress?.({ taskId, processed: indicators.length, total: indicators.length, message: 'done' })
    return { taskId, pair, series }
  }
}

expose(new ChartAggregationWorker())
