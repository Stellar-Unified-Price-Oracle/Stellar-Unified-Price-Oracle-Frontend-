/**
 * Worker Registry — `src/workers/index.ts`
 *
 * Singleton worker pools for each worker type. Import the typed pools from
 * here rather than constructing workers directly in components.
 *
 * Graceful degradation
 * --------------------
 * If `Worker` is not available in the current environment (e.g. some legacy
 * browsers, test environments) the pools are not created and callers should
 * use the synchronous fallback functions exported alongside each pool.
 *
 * Usage
 * -----
 * ```ts
 * import { useWorkerExport } from '../workers'
 *
 * const { exportHistory } = useWorkerExport()
 * const output = await exportHistory({ taskId, format: 'csv', pair, history })
 * ```
 */

import { WorkerPool } from './workerPool'
import type { DataParserWorker } from './dataParser.worker'
import type { ExportWorker } from './export.worker'
import type { ChartAggregationWorker } from './chartAggregation.worker'

// Re-export pool utilities for callers that need fine-grained control
export { WorkerPool, withWorker, getAdaptivePoolSize, getWorkerPoolDiagnostics } from './workerPool'
export type { WorkerPoolOptions, WorkerPoolDiagnostics } from './workerPool'

// Re-export all worker types
export type { DataParserWorker } from './dataParser.worker'
export type { ExportWorker } from './export.worker'
export type { ChartAggregationWorker } from './chartAggregation.worker'
export * from './types'

// ── Singleton pools ───────────────────────────────────────────────────────────

/**
 * Pool of data parser workers.
 * Null when the environment does not support Web Workers.
 */
export const dataParserPool: WorkerPool<DataParserWorker> | null =
  WorkerPool.supported
    ? new WorkerPool<DataParserWorker>(
        () =>
          new Worker(new URL('./dataParser.worker.ts', import.meta.url), { type: 'module' }),
        { label: 'dataParser' },
      )
    : null

/**
 * Pool of export workers (CSV / JSON / XLSX generation).
 * Null when the environment does not support Web Workers.
 */
export const exportPool: WorkerPool<ExportWorker> | null =
  WorkerPool.supported
    ? new WorkerPool<ExportWorker>(
        () =>
          new Worker(new URL('./export.worker.ts', import.meta.url), { type: 'module' }),
        { label: 'export' },
      )
    : null

/**
 * Pool of chart aggregation workers (OHLC candles, LTTB downsampling).
 * Null when the environment does not support Web Workers.
 */
export const chartPool: WorkerPool<ChartAggregationWorker> | null =
  WorkerPool.supported
    ? new WorkerPool<ChartAggregationWorker>(
        () =>
          new Worker(new URL('./chartAggregation.worker.ts', import.meta.url), {
            type: 'module',
          }),
        { label: 'chartAggregation' },
      )
    : null

/**
 * Terminates all worker pools. Call during app teardown or in tests to prevent
 * dangling worker threads.
 */
export function terminateAllPools(): void {
  dataParserPool?.terminate()
  exportPool?.terminate()
  chartPool?.terminate()
}
