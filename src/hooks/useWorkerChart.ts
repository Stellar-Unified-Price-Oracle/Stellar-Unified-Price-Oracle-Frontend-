/**
 * useWorkerChart — React hook for offloading chart data aggregation to a Web Worker.
 *
 * Falls back to synchronous main-thread execution when Web Workers are
 * unavailable.
 */

import { useCallback, useRef } from 'react'
import { proxy } from 'comlink'
import type { PriceHistoryEntry } from '../types'
import { chartPool, withWorker } from '../workers'
import type {
  AggregateChartInput,
  AggregateChartOutput,
  AggregatedCandle,
  AggregationInterval,
  ResampleInput,
  ResampleOutput,
  WorkerProgress,
} from '../workers/types'

type ProgressCallback = (progress: WorkerProgress) => void

/** Interval bucket sizes in milliseconds (mirrors the worker implementation). */
const INTERVAL_MS: Record<AggregationInterval, number> = {
  '1min':  60_000,
  '5min':  300_000,
  '15min': 900_000,
  '1hr':   3_600_000,
  '4hr':   14_400_000,
  '1d':    86_400_000,
}

// ── Synchronous fallbacks ─────────────────────────────────────────────────────

function syncBuildCandles(history: PriceHistoryEntry[], bucketMs: number): AggregatedCandle[] {
  if (history.length === 0) return []
  const sorted = history.slice().sort((a, b) => a.timestamp - b.timestamp)
  const candles: AggregatedCandle[] = []
  let bucketStart = Math.floor(sorted[0].timestamp / bucketMs) * bucketMs
  let open = sorted[0].price
  let high = sorted[0].price
  let low = sorted[0].price
  let close = sorted[0].price
  let confSum = sorted[0].confidence
  let count = 1

  for (let i = 1; i < sorted.length; i++) {
    const e = sorted[i]
    const b = Math.floor(e.timestamp / bucketMs) * bucketMs
    if (b === bucketStart) {
      if (e.price > high) high = e.price
      if (e.price < low) low = e.price
      close = e.price
      confSum += e.confidence
      count++
    } else {
      candles.push({ timestamp: bucketStart, open, high, low, close, avgConfidence: confSum / count, count })
      let next = bucketStart + bucketMs
      while (next < b) {
        candles.push({ timestamp: next, open: close, high: close, low: close, close, avgConfidence: close, count: 0 })
        next += bucketMs
      }
      bucketStart = b
      open = e.price
      high = e.price
      low = e.price
      close = e.price
      confSum = e.confidence
      count = 1
    }
  }
  candles.push({ timestamp: bucketStart, open, high, low, close, avgConfidence: confSum / count, count })
  return candles
}

function syncLttb(data: PriceHistoryEntry[], targetPoints: number): PriceHistoryEntry[] {
  const n = data.length
  if (n <= targetPoints || targetPoints < 3) return data
  const sampled: PriceHistoryEntry[] = [data[0]]
  const bucketSize = (n - 2) / (targetPoints - 2)
  let prevIdx = 0

  for (let i = 0; i < targetPoints - 2; i++) {
    const nextStart = Math.floor((i + 1) * bucketSize) + 1
    const nextEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, n)
    let avgTs = 0, avgP = 0
    const nb = nextEnd - nextStart
    for (let j = nextStart; j < nextEnd; j++) { avgTs += data[j].timestamp; avgP += data[j].price }
    avgTs /= nb; avgP /= nb

    const curStart = Math.floor(i * bucketSize) + 1
    const curEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, n)
    const prev = data[prevIdx]
    let maxArea = -1, maxIdx = curStart

    for (let j = curStart; j < curEnd; j++) {
      const area = Math.abs(
        (prev.timestamp - avgTs) * (data[j].price - prev.price) -
        (prev.timestamp - data[j].timestamp) * (avgP - prev.price),
      ) * 0.5
      if (area > maxArea) { maxArea = area; maxIdx = j }
    }
    sampled.push(data[maxIdx])
    prevIdx = maxIdx
  }
  sampled.push(data[n - 1])
  return sampled
}

function syncAggregateChart(input: AggregateChartInput, onProgress?: ProgressCallback): AggregateChartOutput {
  const { taskId, pair, history, interval } = input
  onProgress?.({ taskId, processed: 0, total: history.length })
  const candles = syncBuildCandles(history, INTERVAL_MS[interval])
  onProgress?.({ taskId, processed: history.length, total: history.length })
  return { taskId, pair, candles, interval }
}

function syncResample(input: ResampleInput, onProgress?: ProgressCallback): ResampleOutput {
  const { taskId, pair, history, targetPoints } = input
  onProgress?.({ taskId, processed: 0, total: history.length })
  const sampled = syncLttb(history, targetPoints)
  onProgress?.({ taskId, processed: history.length, total: history.length })
  return { taskId, pair, history: sampled }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseWorkerChartReturn {
  /** True when the chart worker pool is available. */
  workerAvailable: boolean
  aggregateChart: (input: AggregateChartInput, onProgress?: ProgressCallback) => Promise<AggregateChartOutput>
  resample: (input: ResampleInput, onProgress?: ProgressCallback) => Promise<ResampleOutput>
}

export function useWorkerChart(): UseWorkerChartReturn {
  const workerAvailable = chartPool !== null
  const poolRef = useRef(chartPool)

  const aggregateChart = useCallback(
    async (input: AggregateChartInput, onProgress?: ProgressCallback): Promise<AggregateChartOutput> => {
      if (!poolRef.current) return syncAggregateChart(input, onProgress)
      return withWorker(poolRef.current, (w) =>
        w.aggregateChart(input, onProgress ? proxy(onProgress) : undefined),
      )
    },
    [],
  )

  const resample = useCallback(
    async (input: ResampleInput, onProgress?: ProgressCallback): Promise<ResampleOutput> => {
      if (!poolRef.current) return syncResample(input, onProgress)
      return withWorker(poolRef.current, (w) =>
        w.resample(input, onProgress ? proxy(onProgress) : undefined),
      )
    },
    [],
  )

  return { workerAvailable, aggregateChart, resample }
}
