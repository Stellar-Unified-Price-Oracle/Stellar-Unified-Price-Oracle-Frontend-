/**
 * Shared types for the Web Worker layer.
 *
 * All task inputs and outputs must be transferable (structured-cloneable) so
 * they cross the Worker boundary without being serialised to JSON.
 */

import type { PriceData, PriceHistoryEntry, AlertHistoryEntry } from '../types'

// ── Progress reporting ────────────────────────────────────────────────────────

/** A progress update delivered from a worker task back to the main thread. */
export interface WorkerProgress {
  /** Task identifier supplied by the caller. */
  taskId: string
  /** Number of items processed so far. */
  processed: number
  /** Total number of items to process, or null if unknown. */
  total: number | null
  /** Optional human-readable status message. */
  message?: string
}

// ── Data parsing worker ───────────────────────────────────────────────────────

/** Raw price entry as it arrives from the API (before normalisation). */
export interface RawPriceEntry {
  assetPair: string
  price: number | string
  timestamp: number | string
  confidence: number | string
  sources: string | string[]
}

export interface ParsePricesInput {
  taskId: string
  raw: RawPriceEntry[]
}

export interface ParsePricesOutput {
  taskId: string
  prices: PriceData[]
  /** Indices of entries that failed validation (skipped). */
  skipped: number[]
}

export interface NormaliseHistoryInput {
  taskId: string
  pair: string
  raw: Array<{ price: number | string; timestamp: number | string; confidence?: number | string; sources?: string[] }>
}

export interface NormaliseHistoryOutput {
  taskId: string
  pair: string
  history: PriceHistoryEntry[]
  skipped: number[]
}

// ── Export worker ─────────────────────────────────────────────────────────────

export type ExportFormat = 'csv' | 'json' | 'xlsx'

export interface ExportPricesInput {
  taskId: string
  format: ExportFormat
  prices: PriceData[]
}

export interface ExportHistoryInput {
  taskId: string
  format: ExportFormat
  pair: string
  history: PriceHistoryEntry[]
}

export interface ExportAlertHistoryInput {
  taskId: string
  format: ExportFormat
  entries: AlertHistoryEntry[]
}

export interface ExportOutput {
  taskId: string
  /** UTF-8 encoded text (CSV, JSON) or binary blob (XLSX) as a Uint8Array. */
  data: string | Uint8Array
  filename: string
  mimeType: string
}

// ── Chart aggregation worker ──────────────────────────────────────────────────

export type AggregationInterval = '1min' | '5min' | '15min' | '1hr' | '4hr' | '1d'

export interface AggregatedCandle {
  /** Bucket start timestamp (ms). */
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  /** Average confidence across entries in this bucket. */
  avgConfidence: number
  /** Number of data points in this candle. */
  count: number
}

export interface AggregateChartInput {
  taskId: string
  pair: string
  history: PriceHistoryEntry[]
  interval: AggregationInterval
}

export interface AggregateChartOutput {
  taskId: string
  pair: string
  candles: AggregatedCandle[]
  interval: AggregationInterval
}

export interface ResampleInput {
  taskId: string
  pair: string
  history: PriceHistoryEntry[]
  /** Target number of data points (LTTB downsampling). */
  targetPoints: number
}

export interface ResampleOutput {
  taskId: string
  pair: string
  history: PriceHistoryEntry[]
}

// ── Technical indicators ──────────────────────────────────────────────────────

export type IndicatorType = 'sma' | 'ema' | 'rsi'

export interface IndicatorConfig {
  type: IndicatorType
  period: number
  enabled: boolean
}

export interface ComputeIndicatorsInput {
  taskId: string
  pair: string
  history: PriceHistoryEntry[]
  indicators: IndicatorConfig[]
}

export interface IndicatorSeries {
  type: IndicatorType
  period: number
  /** Parallel to the input history array. null for points before the indicator has enough data. */
  values: (number | null)[]
}

export interface ComputeIndicatorsOutput {
  taskId: string
  pair: string
  series: IndicatorSeries[]
}
