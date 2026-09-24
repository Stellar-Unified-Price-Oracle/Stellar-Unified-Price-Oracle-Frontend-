/**
 * Time-series storage engine — public entry point.
 *
 * @example
 * ```ts
 * import { timeSeries, SERIES_IDS } from '../storage/timeseries'
 *
 * await timeSeries.initialize()
 * await timeSeries.append(SERIES_IDS.exportRuns, run)
 * const points = await timeSeries.query({ series: SERIES_IDS.exportRuns, from, to, tier: 'raw' })
 * ```
 */

export { createTimeSeriesEngine, timeSeries, TS_POINTS_STORE, TS_SERIES_STORE } from './engine'
export type { TimeSeriesEngine, TimeSeriesEngineOptions } from './engine'
export { useTimeSeriesQuery } from './useTimeSeriesQuery'
export type { UseTimeSeriesQueryOptions, UseTimeSeriesQueryResult } from './useTimeSeriesQuery'
export { planQuery, estimatePoints, tierIntervalMs, TIERS } from './planner'
export { aggregate, bucketStart, rollupPoints, DAY_MS, HOUR_MS } from './rollup'
export {
  DEFAULT_RETENTION,
  DEFAULT_ROLLUP,
  MAINTENANCE,
  SERIES_DESCRIPTORS,
  SERIES_IDS,
  ALERT_EVENTS_SERIES,
  EXPORT_RUNS_SERIES,
  PRICE_HISTORY_SERIES,
} from './config'
export type { AlertEventPayload, ExportRunPayload, PriceHistoryPayload } from './config'
export type {
  QueryPlan,
  QuerySpec,
  RetentionPolicy,
  RollupPolicy,
  SeriesDescriptor,
  SeriesStats,
  TsAggregation,
  TsObservation,
  TsPoint,
  TsTier,
} from './types'
