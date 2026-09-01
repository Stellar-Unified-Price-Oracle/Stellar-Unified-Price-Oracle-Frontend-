/**
 * Export Worker — `src/workers/export.worker.ts`
 *
 * Generates CSV, JSON, and XLSX export payloads on a background thread.
 * The main thread receives a transferable {@link ExportOutput} containing the
 * data and metadata needed to trigger a browser download.
 */

import { expose } from 'comlink'
import {
  toCsv,
  priceDataToCsvRows,
  historyToCsvRows,
  alertHistoryToCsvRows,
  exportFilename,
  buildXlsx,
  priceDataToXlsx,
  historyToXlsx,
} from '../utils/export'
import type {
  ExportPricesInput,
  ExportHistoryInput,
  ExportAlertHistoryInput,
  ExportOutput,
  WorkerProgress,
} from './types'

export class ExportWorker {
  /**
   * Generates an export file for an array of {@link PriceData}.
   * Reports one progress event after completion.
   */
  exportPrices(
    input: ExportPricesInput,
    onProgress?: (progress: WorkerProgress) => void,
  ): ExportOutput {
    const { taskId, format, prices } = input
    const filename = exportFilename('prices', format)

    onProgress?.({ taskId, processed: 0, total: prices.length, message: 'generating export…' })

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

    onProgress?.({ taskId, processed: prices.length, total: prices.length, message: 'done' })

    return { taskId, data, filename, mimeType }
  }

  /**
   * Generates an export file for a pair's price history.
   */
  exportHistory(
    input: ExportHistoryInput,
    onProgress?: (progress: WorkerProgress) => void,
  ): ExportOutput {
    const { taskId, format, pair, history } = input
    const filename = exportFilename(pair, format)

    onProgress?.({ taskId, processed: 0, total: history.length, message: 'generating export…' })

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

    onProgress?.({ taskId, processed: history.length, total: history.length, message: 'done' })

    return { taskId, data, filename, mimeType }
  }

  /**
   * Generates an export file for the alert history log.
   */
  exportAlertHistory(
    input: ExportAlertHistoryInput,
    onProgress?: (progress: WorkerProgress) => void,
  ): ExportOutput {
    const { taskId, format, entries } = input
    const filename = exportFilename('alert-history', format)

    onProgress?.({ taskId, processed: 0, total: entries.length, message: 'generating export…' })

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

    onProgress?.({ taskId, processed: entries.length, total: entries.length, message: 'done' })

    return { taskId, data, filename, mimeType }
  }
}

expose(new ExportWorker())
