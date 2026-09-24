/**
 * useWorkerDataParser — React hook for offloading data parsing/normalisation
 * to a Web Worker.
 *
 * Falls back to synchronous main-thread execution when Web Workers are
 * unavailable.
 */

import { useCallback, useRef } from 'react'
import { proxy } from 'comlink'
import type { PriceData, PriceHistoryEntry } from '../types'
import { dataParserPool, withWorker } from '../workers'
import type {
  ParsePricesInput,
  ParsePricesOutput,
  NormaliseHistoryInput,
  NormaliseHistoryOutput,
  RawPriceEntry,
  WorkerProgress,
} from '../workers/types'

type ProgressCallback = (progress: WorkerProgress) => void

// ── Synchronous fallbacks ─────────────────────────────────────────────────────

function toNumber(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : NaN
}

function toSources(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String)
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean)
  return []
}

function syncParsePrices(input: ParsePricesInput, onProgress?: ProgressCallback): ParsePricesOutput {
  const prices: PriceData[] = []
  const skipped: number[] = []
  const total = input.raw.length

  for (let i = 0; i < total; i++) {
    const r = input.raw[i]
    const price = toNumber(r.price)
    const timestamp = toNumber(r.timestamp)
    const confidence = toNumber(r.confidence)
    const sources = toSources(r.sources)

    const valid =
      typeof r.assetPair === 'string' &&
      r.assetPair.length > 0 &&
      !Number.isNaN(price) &&
      !Number.isNaN(timestamp) &&
      !Number.isNaN(confidence) &&
      sources.length > 0

    if (valid) {
      prices.push({ assetPair: r.assetPair, price, timestamp, confidence, sources })
    } else {
      skipped.push(i)
    }
  }

  onProgress?.({ taskId: input.taskId, processed: total, total })
  return { taskId: input.taskId, prices, skipped }
}

function syncNormaliseHistory(input: NormaliseHistoryInput, onProgress?: ProgressCallback): NormaliseHistoryOutput {
  const history: PriceHistoryEntry[] = []
  const skipped: number[] = []
  const total = input.raw.length

  for (let i = 0; i < total; i++) {
    const r = input.raw[i]
    const price = toNumber(r.price)
    const timestamp = toNumber(r.timestamp)
    const confidence = r.confidence !== undefined ? toNumber(r.confidence) : 1
    const sources = r.sources ?? []

    if (!Number.isNaN(price) && !Number.isNaN(timestamp)) {
      history.push({ price, timestamp, confidence: Number.isNaN(confidence) ? 1 : confidence, sources })
    } else {
      skipped.push(i)
    }
  }

  onProgress?.({ taskId: input.taskId, processed: total, total })
  return { taskId: input.taskId, pair: input.pair, history, skipped }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseWorkerDataParserReturn {
  /** True when the data parser worker pool is available. */
  workerAvailable: boolean
  parsePrices: (input: ParsePricesInput, onProgress?: ProgressCallback) => Promise<ParsePricesOutput>
  normaliseHistory: (input: NormaliseHistoryInput, onProgress?: ProgressCallback) => Promise<NormaliseHistoryOutput>
}

// Re-export raw entry type so callers don't need to import from workers/types
export type { RawPriceEntry }

export function useWorkerDataParser(): UseWorkerDataParserReturn {
  const workerAvailable = dataParserPool !== null
  const poolRef = useRef(dataParserPool)

  const parsePrices = useCallback(
    async (input: ParsePricesInput, onProgress?: ProgressCallback): Promise<ParsePricesOutput> => {
      if (!poolRef.current) return syncParsePrices(input, onProgress)
      return withWorker(poolRef.current, (w) =>
        w.parsePrices(input, onProgress ? proxy(onProgress) : undefined),
      )
    },
    [],
  )

  const normaliseHistory = useCallback(
    async (input: NormaliseHistoryInput, onProgress?: ProgressCallback): Promise<NormaliseHistoryOutput> => {
      if (!poolRef.current) return syncNormaliseHistory(input, onProgress)
      return withWorker(poolRef.current, (w) =>
        w.normaliseHistory(input, onProgress ? proxy(onProgress) : undefined),
      )
    },
    [],
  )

  return { workerAvailable, parsePrices, normaliseHistory }
}
