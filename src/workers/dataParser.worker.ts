/**
 * Data Parsing Worker — `src/workers/dataParser.worker.ts`
 *
 * Normalises raw API responses into typed {@link PriceData} and
 * {@link PriceHistoryEntry} objects on a background thread so the main thread
 * is not blocked during large payload processing.
 *
 * Exposed via Comlink so the main thread can call the methods as if they were
 * regular async functions.
 */

import { expose } from 'comlink'
import type { PriceData, PriceHistoryEntry } from '../types'
import type {
  ParsePricesInput,
  ParsePricesOutput,
  NormaliseHistoryInput,
  NormaliseHistoryOutput,
  WorkerProgress,
} from './types'

// Batch size for emitting progress events so we don't overwhelm the channel.
const PROGRESS_BATCH = 200

/**
 * Coerces a value to a finite number. Returns NaN if the coercion fails or the
 * result is not finite.
 */
function toNumber(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : NaN
}

/**
 * Coerces a sources field to a `string[]`. Handles the common cases where the
 * API returns a comma-separated string or an already-parsed array.
 */
function toSources(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String)
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean)
  return []
}

export class DataParserWorker {
  /**
   * Parses and validates an array of raw price entries.
   * Invalid entries are skipped and their original indices reported in `skipped`.
   *
   * Reports progress via the `onProgress` callback every {@link PROGRESS_BATCH} items.
   */
  parsePrices(
    input: ParsePricesInput,
    onProgress?: (progress: WorkerProgress) => void,
  ): ParsePricesOutput {
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

      if (onProgress && (i + 1) % PROGRESS_BATCH === 0) {
        onProgress({ taskId: input.taskId, processed: i + 1, total })
      }
    }

    if (onProgress) {
      onProgress({ taskId: input.taskId, processed: total, total })
    }

    return { taskId: input.taskId, prices, skipped }
  }

  /**
   * Normalises raw price history entries for a single asset pair.
   * Entries missing required numeric fields are skipped.
   */
  normaliseHistory(
    input: NormaliseHistoryInput,
    onProgress?: (progress: WorkerProgress) => void,
  ): NormaliseHistoryOutput {
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

      if (onProgress && (i + 1) % PROGRESS_BATCH === 0) {
        onProgress({ taskId: input.taskId, processed: i + 1, total })
      }
    }

    if (onProgress) {
      onProgress({ taskId: input.taskId, processed: total, total })
    }

    return { taskId: input.taskId, pair: input.pair, history, skipped }
  }
}

expose(new DataParserWorker())
