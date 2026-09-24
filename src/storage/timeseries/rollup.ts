/**
 * Pure rollup/aggregation helpers for the time-series engine.
 *
 * Kept free of IndexedDB so the compaction math can be unit-tested directly
 * (see `rollup.test.ts`). The engine calls these inside a single transaction.
 */

import type { TsAggregation, TsPoint, TsTier } from './types'

/** Milliseconds in an hour — the raw → hourly bucket width. */
export const HOUR_MS = 60 * 60 * 1000
/** Milliseconds in a day — the hourly → daily bucket width. */
export const DAY_MS = 24 * HOUR_MS

/** Floors a timestamp to the start of its bucket (UTC, epoch-aligned). */
export function bucketStart(t: number, intervalMs: number): number {
  return Math.floor(t / intervalMs) * intervalMs
}

/**
 * Reduces a set of points to one rolled-up value.
 *
 * `avg` weights by each point's observation count `n`, so rolling up
 * already-averaged hourly points into a daily average stays correct.
 */
export function aggregate(points: readonly TsPoint[], kind: TsAggregation): number {
  if (points.length === 0) return 0
  switch (kind) {
    case 'count':
      return points.reduce((sum, p) => sum + p.n, 0)
    case 'sum':
      return points.reduce((sum, p) => sum + p.v, 0)
    case 'min':
      return points.reduce((min, p) => Math.min(min, p.v), Infinity)
    case 'max':
      return points.reduce((max, p) => Math.max(max, p.v), -Infinity)
    case 'last':
      return points.reduce((last, p) => (p.t >= last.t ? p : last), points[0]).v
    case 'avg': {
      const weight = points.reduce((sum, p) => sum + p.n, 0)
      const total = points.reduce((sum, p) => sum + p.v * p.n, 0)
      return weight > 0 ? total / weight : points.reduce((sum, p) => sum + p.v, 0) / points.length
    }
    default:
      return points[0].v
  }
}

/**
 * Groups points into fixed-width buckets and aggregates each bucket.
 *
 * All input points must belong to the same series. The output tier is
 * `targetTier`, so `rollupPoints(rawPoints, HOUR_MS, 'avg', 'hourly')` produces
 * the hourly tier. Output is sorted oldest → newest.
 */
export function rollupPoints(
  points: readonly TsPoint[],
  intervalMs: number,
  kind: TsAggregation,
  targetTier: TsTier,
): TsPoint[] {
  if (points.length === 0) return []

  const buckets = new Map<number, TsPoint[]>()
  for (const point of points) {
    const bucket = bucketStart(point.t, intervalMs)
    const list = buckets.get(bucket)
    if (list) list.push(point)
    else buckets.set(bucket, [point])
  }

  const rolled: TsPoint[] = []
  for (const [t, list] of buckets) {
    list.sort((a, b) => a.t - b.t)
    const newest = list[list.length - 1]
    rolled.push({
      series: points[0].series,
      tier: targetTier,
      t,
      v: aggregate(list, kind),
      n: list.reduce((sum, p) => sum + p.n, 0),
      ...(newest.meta ? { meta: newest.meta } : {}),
    })
  }

  rolled.sort((a, b) => a.t - b.t)
  return rolled
}
