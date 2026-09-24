/**
 * Core types for the time-series storage engine.
 *
 * The engine keeps every logical series in up to three resolution tiers
 * (`raw` → `hourly` → `daily`). New observations land in `raw`; maintenance
 * compacts complete buckets into the coarser tiers and trims each tier to its
 * retention window. Queries go through a planner that picks the cheapest tier
 * that can answer the requested time range.
 */

/** Resolution tier. Finer tiers are compacted into coarser ones. */
export type TsTier = 'raw' | 'hourly' | 'daily'

/** Aggregation applied when compacting one tier into the next. */
export type TsAggregation = 'avg' | 'min' | 'max' | 'sum' | 'count' | 'last'

/** A single timestamped measurement stored by the engine. */
export interface TsPoint {
  /** Series id, e.g. `alert-events` or `price-history:BTC/USD`. */
  series: string
  /** Resolution tier this point belongs to. */
  tier: TsTier
  /** Bucket start timestamp in ms (UTC). Unique within `(series, tier)`. */
  t: number
  /** Rolled-up (or raw) numeric measure. */
  v: number
  /** Number of raw observations aggregated into this point (1 for raw). */
  n: number
  /** Optional payload carried over from the newest observation in the bucket. */
  meta?: Record<string, unknown>
}

/** How long each tier is retained, in ms, measured back from "now". */
export interface RetentionPolicy {
  raw: number
  hourly: number
  daily: number
}

/** How each tier is aggregated into the next coarser tier. */
export interface RollupPolicy {
  rawToHourly: TsAggregation
  hourlyToDaily: TsAggregation
}

/** The engine-facing shape of one appended observation. */
export interface TsObservation {
  /** Timestamp in ms. */
  t: number
  /** Numeric measure. */
  v: number
  /** Optional payload stored alongside the point. */
  meta?: Record<string, unknown>
}

/**
 * Describes one logical series the engine manages. Descriptors are registered
 * in code (never persisted), so they may carry functions.
 *
 * A descriptor whose `id` has no `:` acts as the default for a *family*: appending
 * to `price-history:BTC/USD` resolves to the `price-history` descriptor.
 */
export interface SeriesDescriptor<TPayload = unknown> {
  /** Stable id (or family prefix), e.g. `alert-events`. */
  id: string
  /** Overrides for the default retention policy. */
  retention?: Partial<RetentionPolicy>
  /** Overrides for the default rollup policy. */
  rollup?: Partial<RollupPolicy>
  /** Converts a domain payload into a `{ t, v, meta }` observation. */
  toObservation: (payload: TPayload) => TsObservation
}

/** Declarative query request; the planner turns it into a physical tier. */
export interface QuerySpec {
  series: string
  from: number
  to: number
  /** Forces a tier instead of letting the planner choose one. */
  tier?: TsTier
  /** Soft budget; the planner coarsens tiers until the scan fits. */
  maxPoints?: number
}

/** Physical plan chosen by the planner for a {@link QuerySpec}. */
export interface QueryPlan {
  series: string
  tier: TsTier
  from: number
  to: number
  /** Estimated number of points the scan will read. */
  estimatedPoints: number
}

/** Per-series occupancy, for diagnostics and the storage UI. */
export interface SeriesStats {
  series: string
  retention: RetentionPolicy
  points: Record<TsTier, number>
  oldest: number | null
  newest: number | null
}
