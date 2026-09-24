/**
 * Series registry and default policy for the time-series engine.
 *
 * Everything the engine stores is declared here, so the set of retained series
 * (and their windows) is greppable in one place. Payload types are defined as
 * narrow structural interfaces rather than imported from their feature modules,
 * which keeps the engine free of upward dependencies; the call sites pass the
 * full domain objects, which satisfy these shapes.
 */

import { DAY_MS } from './rollup'
import type { RetentionPolicy, RollupPolicy, SeriesDescriptor } from './types'

/** Default tier retentions: 24h raw → 30d hourly → 1y daily. */
export const DEFAULT_RETENTION: RetentionPolicy = {
  raw: DAY_MS,
  hourly: 30 * DAY_MS,
  daily: 365 * DAY_MS,
}

/** Default rollup aggregations. */
export const DEFAULT_ROLLUP: RollupPolicy = {
  rawToHourly: 'avg',
  hourlyToDaily: 'avg',
}

/** Tunables for how eagerly writes are compacted and trimmed. */
export const MAINTENANCE = {
  /** Coalesces a burst of writes into a single compaction/retention pass. */
  debounceMs: 2000,
}

// ── alert-events ────────────────────────────────────────────────────────────

/** Structural shape of a fired-alert history entry (`src/types`). */
export interface AlertEventPayload {
  id: string
  alertId: string
  assetPair: string
  triggeredAt: number
  price: number
  escalation?: { stepId: string; channel: string; delayMinutes: number } | null
  retest?: unknown
}

/**
 * Fired alerts and escalation steps (#309, #487). Rolled up as a *count*: the
 * meaningful long-term metric is how often a pair fires, not the price level
 * (which is per-event detail preserved in `raw`).
 */
export const ALERT_EVENTS_SERIES: SeriesDescriptor<AlertEventPayload> = {
  id: 'alert-events',
  retention: { raw: 30 * DAY_MS, hourly: 180 * DAY_MS, daily: 365 * DAY_MS },
  rollup: { rawToHourly: 'count', hourlyToDaily: 'count' },
  toObservation: (entry) => ({
    t: entry.triggeredAt,
    v: entry.price,
    meta: {
      alertId: entry.alertId,
      assetPair: entry.assetPair,
      escalated: Boolean(entry.escalation),
      entry,
    },
  }),
}

// ── export-runs ─────────────────────────────────────────────────────────────

/** Structural shape of a scheduled-export run (`useScheduledExports`). */
export interface ExportRunPayload {
  id: string
  scheduleId: string
  scheduleLabel: string
  ranAt: number
  format: string
  pairCount: number
  trigger: 'scheduled' | 'manual'
}

/**
 * Scheduled/manual export runs (#318). Kept for a long window because they are
 * low-volume and users expect to see months of history.
 */
export const EXPORT_RUNS_SERIES: SeriesDescriptor<ExportRunPayload> = {
  id: 'export-runs',
  retention: { raw: 90 * DAY_MS, hourly: 365 * DAY_MS, daily: 3650 * DAY_MS },
  rollup: { rawToHourly: 'count', hourlyToDaily: 'count' },
  toObservation: (entry) => ({
    t: entry.ranAt,
    v: entry.pairCount,
    meta: { entry },
  }),
}

// ── price-history (family) ─────────────────────────────────────────────────

/** Structural shape of an API price-history point. */
export interface PriceHistoryPayload {
  timestamp: number
  price: number
  confidence: number
  sources: unknown[]
}

/**
 * Long-lived projection of fetched price history, one series per asset pair
 * (`price-history:BTC/USD`). This is the dataset that otherwise only lives as
 * short-TTL response blobs, so it is the one that most needs retention and
 * rollups.
 */
export const PRICE_HISTORY_SERIES: SeriesDescriptor<PriceHistoryPayload> = {
  id: 'price-history',
  retention: { raw: 7 * DAY_MS, hourly: 90 * DAY_MS, daily: 365 * DAY_MS },
  rollup: { rawToHourly: 'avg', hourlyToDaily: 'avg' },
  toObservation: (entry) => ({
    t: entry.timestamp,
    v: entry.price,
    meta: {
      confidence: entry.confidence,
      sourceCount: Array.isArray(entry.sources) ? entry.sources.length : 0,
    },
  }),
}

/** Every descriptor the app registers at boot. */
export const SERIES_DESCRIPTORS: ReadonlyArray<SeriesDescriptor<never>> = [
  ALERT_EVENTS_SERIES,
  EXPORT_RUNS_SERIES,
  PRICE_HISTORY_SERIES,
] as ReadonlyArray<SeriesDescriptor<never>>

/** Convenience ids for call sites. */
export const SERIES_IDS = {
  alertEvents: ALERT_EVENTS_SERIES.id,
  exportRuns: EXPORT_RUNS_SERIES.id,
  priceHistory: (pair: string) => `${PRICE_HISTORY_SERIES.id}:${pair}`,
} as const
