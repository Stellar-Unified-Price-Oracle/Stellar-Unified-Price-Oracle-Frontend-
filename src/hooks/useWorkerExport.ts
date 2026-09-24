/**
 * useWorkerExport — React hook for offloading export generation to a Web Worker.
 *
 * Falls back to synchronous main-thread execution when Web Workers are
 * unavailable (legacy browsers, test environments).
 *
 * Progress callbacks are supported for both the worker and fallback paths so
 * the UI can display progress regardless of which path is taken.
 */

import { useCallback, useRef } from 'react'
import { proxy } from 'comlink'
import {
  toCsv,
  priceDataToCsvRows,
  historyToCsvRows,
  alertHistoryToCsvRows,
  exportFilename,
  priceDataToXlsx,
  historyToXlsx,
  buildXlsx,
} from '../utils/export'
import { exportPool, withWorker } from '../workers'
import type {
  ExportPricesInput,
  ExportHistoryInput,
  ExportAlertHistoryInput,
  ExportOutput,
  WorkerProgress,
} from '../workers/types'

type ProgressCallback = (progress: WorkerProgress) => void

// ── Synchronous fallbacks ─────────────────────────────────────────────────────
// Used when Workers are unavailable. The logic mirrors the worker implementations
// so the public API is identical regardless of which path is taken.

function syncExportPrices(input: ExportPricesInput, onProgress?: ProgressCallback): ExportOutput {
  const { taskId, format, prices } = input
  onProgress?.({ taskId, processed: 0, total: prices.length })

  let data: string | Uint8Array
  let mimeType: string

  if (format === 'json') {
    data = JSON.stringify(prices, null, 2)
    mimeType = 'application/json'
  } else if (format === 'xlsx') {
    data = priceDataToXlsx(prices)
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  } else {
    const { rows, headers } = priceDataToCsvRows(prices)
    data = toCsv(rows, headers)
    mimeType = 'text/csv'
  }

  onProgress?.({ taskId, processed: prices.length, total: prices.length })
  return { taskId, data, filename: exportFilename('prices', format), mimeType }
}

function syncExportHistory(input: ExportHistoryInput, onProgress?: ProgressCallback): ExportOutput {
  const { taskId, format, pair, history } = input
  onProgress?.({ taskId, processed: 0, total: history.length })

  let data: string | Uint8Array
  let mimeType: string

  if (format === 'json') {
    data = JSON.stringify({ pair, history }, null, 2)
    mimeType = 'application/json'
  } else if (format === 'xlsx') {
    data = historyToXlsx(pair, history)
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  } else {
    const { rows, headers } = historyToCsvRows(pair, history)
    data = toCsv(rows, headers)
    mimeType = 'text/csv'
  }

  onProgress?.({ taskId, processed: history.length, total: history.length })
  return { taskId, data, filename: exportFilename(pair, format), mimeType }
}

function syncExportAlertHistory(input: ExportAlertHistoryInput, onProgress?: ProgressCallback): ExportOutput {
  const { taskId, format, entries } = input
  onProgress?.({ taskId, processed: 0, total: entries.length })

  let data: string | Uint8Array
  let mimeType: string

  if (format === 'json') {
    data = JSON.stringify(entries, null, 2)
    mimeType = 'application/json'
  } else if (format === 'xlsx') {
    const { rows, headers } = alertHistoryToCsvRows(entries)
    data = buildXlsx([{ name: 'Alert History', headers, rows }])
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  } else {
    const { rows, headers } = alertHistoryToCsvRows(entries)
    data = toCsv(rows, headers)
    mimeType = 'text/csv'
  }

  onProgress?.({ taskId, processed: entries.length, total: entries.length })
  return { taskId, data, filename: exportFilename('alert-history', format), mimeType }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseWorkerExportReturn {
  /** True when the export worker pool is available. */
  workerAvailable: boolean
  exportPrices: (input: ExportPricesInput, onProgress?: ProgressCallback) => Promise<ExportOutput>
  exportHistory: (input: ExportHistoryInput, onProgress?: ProgressCallback) => Promise<ExportOutput>
  exportAlertHistory: (input: ExportAlertHistoryInput, onProgress?: ProgressCallback) => Promise<ExportOutput>
}

export function useWorkerExport(): UseWorkerExportReturn {
  const workerAvailable = exportPool !== null
  // Stable ref to avoid re-creating callbacks on every render
  const poolRef = useRef(exportPool)

  const exportPrices = useCallback(
    async (input: ExportPricesInput, onProgress?: ProgressCallback): Promise<ExportOutput> => {
      if (!poolRef.current) return syncExportPrices(input, onProgress)
      return withWorker(poolRef.current, (w) =>
        w.exportPrices(input, onProgress ? proxy(onProgress) : undefined),
      )
    },
    [],
  )

  const exportHistory = useCallback(
    async (input: ExportHistoryInput, onProgress?: ProgressCallback): Promise<ExportOutput> => {
      if (!poolRef.current) return syncExportHistory(input, onProgress)
      return withWorker(poolRef.current, (w) =>
        w.exportHistory(input, onProgress ? proxy(onProgress) : undefined),
      )
    },
    [],
  )

  const exportAlertHistory = useCallback(
    async (input: ExportAlertHistoryInput, onProgress?: ProgressCallback): Promise<ExportOutput> => {
      if (!poolRef.current) return syncExportAlertHistory(input, onProgress)
      return withWorker(poolRef.current, (w) =>
        w.exportAlertHistory(input, onProgress ? proxy(onProgress) : undefined),
      )
    },
    [],
  )

  return { workerAvailable, exportPrices, exportHistory, exportAlertHistory }
}
