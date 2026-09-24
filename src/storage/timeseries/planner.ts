/**
 * Query planner for the time-series engine.
 *
 * A range query never has to be answered from raw points: the planner picks the
 * cheapest tier that still answers the requested window. It defaults by span
 * (short windows want raw detail, long windows are only retained as rollups)
 * and then coarsens further when a `maxPoints` budget demands it.
 *
 * Pure and synchronous so it can be unit-tested without IndexedDB.
 */

import { DAY_MS, HOUR_MS } from './rollup'
import type { QueryPlan, QuerySpec, TsTier } from './types'

/** Tiers ordered finest → coarsest. */
export const TIERS: readonly TsTier[] = ['raw', 'hourly', 'daily']

/** Nominal spacing of a raw point, used only to estimate scan sizes. */
const RAW_NOMINAL_MS = 1000
/** Spans up to this are answered from raw points. */
const RAW_MAX_SPAN_MS = 2 * HOUR_MS
/** Spans up to this are answered from hourly rollups; longer spans use daily. */
const HOURLY_MAX_SPAN_MS = 45 * DAY_MS

/** Nominal bucket width for a tier, in ms. Raw is an estimate, not a guarantee. */
export function tierIntervalMs(tier: TsTier): number {
  switch (tier) {
    case 'hourly':
      return HOUR_MS
    case 'daily':
      return DAY_MS
    default:
      return RAW_NOMINAL_MS
  }
}

/** Estimated number of points a scan of `spanMs` reads from `tier`. */
export function estimatePoints(tier: TsTier, spanMs: number): number {
  if (spanMs <= 0) return 1
  return Math.max(1, Math.ceil(spanMs / tierIntervalMs(tier)))
}

/**
 * Chooses the physical tier for a query. An explicit `spec.tier` always wins;
 * otherwise the tier is chosen by span and optionally coarsened to honour
 * `maxPoints`.
 */
export function planQuery(spec: QuerySpec): QueryPlan {
  const from = Math.min(spec.from, spec.to)
  const to = Math.max(spec.from, spec.to)
  const span = to - from

  let tier: TsTier
  if (spec.tier) {
    tier = spec.tier
  } else if (span <= RAW_MAX_SPAN_MS) {
    tier = 'raw'
  } else if (span <= HOURLY_MAX_SPAN_MS) {
    tier = 'hourly'
  } else {
    tier = 'daily'
  }

  if (spec.maxPoints && spec.maxPoints > 0) {
    let index = TIERS.indexOf(tier)
    while (index < TIERS.length - 1 && estimatePoints(TIERS[index], span) > spec.maxPoints) {
      index += 1
    }
    tier = TIERS[index]
  }

  return { series: spec.series, tier, from, to, estimatedPoints: estimatePoints(tier, span) }
}
