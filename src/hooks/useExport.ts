import { useCallback } from 'react'
import type { PriceData } from '../types'
import {
  toCsv,
  priceDataToCsvRows,
  priceDataToJsonRows,
  priceDataToXlsx,
  downloadFile,
  downloadBinaryFile,
  exportFilename,
} from '../utils/export'
import { useRateLimit } from './useRateLimit'

export type ExportFormat = 'csv' | 'json' | 'xlsx'

export interface UseExportReturn {
  exportCSV: (items: PriceData[], columns?: string[]) => void
  exportJSON: (items: PriceData[], columns?: string[]) => void
  exportXLSX: (items: PriceData[], columns?: string[]) => void
  exportData: (format: ExportFormat, items: PriceData[], columns?: string[]) => void
  /** Whether an export is currently allowed (not rate-limited). */
  exportAllowed: boolean
  /** Seconds until the rate-limit window resets (0 when allowed). */
  exportCooldownSec: number
}

/**
 * Provides CSV, JSON, and XLSX export helpers.
 * All exports share a single sliding-window rate limiter:
 * max {@link RATE_LIMIT_CONFIGS}.export per minute (default 3).
 * `exportAllowed` and `exportCooldownSec` are exposed so callers can
 * disable buttons and display countdown labels during the cooldown period.
 */
export function useExport(): UseExportReturn {
  const { allowed: exportAllowed, cooldownSec: exportCooldownSec, consume } = useRateLimit('export')

  const exportCSV = useCallback(
    (items: PriceData[], columns?: string[]) => {
      if (!consume()) return
      const { rows, headers } = priceDataToCsvRows(items, columns)
      const csv = toCsv(rows, headers)
      downloadFile(csv, exportFilename('oracle-prices', 'csv'), 'text/csv')
    },
    [consume],
  )

  const exportJSON = useCallback(
    (items: PriceData[], columns?: string[]) => {
      if (!consume()) return
      const json = JSON.stringify(priceDataToJsonRows(items, columns), null, 2)
      downloadFile(json, exportFilename('oracle-prices', 'json'), 'application/json')
    },
    [consume],
  )

  const exportXLSX = useCallback(
    (items: PriceData[], columns?: string[]) => {
      if (!consume()) return
      const xlsx = priceDataToXlsx(items, columns)
      downloadBinaryFile(
        xlsx,
        exportFilename('oracle-prices', 'xlsx'),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
    },
    [consume],
  )

  const exportData = useCallback(
    (format: ExportFormat, items: PriceData[], columns?: string[]) => {
      // Consume a single token for the aggregated exportData call so callers
      // using exportData directly are also rate-limited.
      if (!consume()) return
      const {
        downloadBinaryFile,
        downloadFile,
        exportFilename,
        priceDataToCsvRows,
        priceDataToXlsx,
        toCsv,
      } = await loadExportUtils()

      if (format === 'json') {
        const json = JSON.stringify(priceDataToJsonRows(items, columns), null, 2)
        downloadFile(json, exportFilename('oracle-prices', 'json'), 'application/json')
      } else if (format === 'xlsx') {
        const xlsx = priceDataToXlsx(items, columns)
        downloadBinaryFile(
          xlsx,
          exportFilename('oracle-prices', 'xlsx'),
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
      } else {
        const { rows, headers } = priceDataToCsvRows(items, columns)
        const csv = toCsv(rows, headers)
        downloadFile(csv, exportFilename('oracle-prices', 'csv'), 'text/csv')
      }
    },
    [consume],
  )

  const exportCSV = useCallback(
    (items: PriceData[]) => exportData('csv', items),
    [exportData],
  )
  const exportJSON = useCallback(
    (items: PriceData[]) => exportData('json', items),
    [exportData],
  )
  const exportXLSX = useCallback(
    (items: PriceData[]) => exportData('xlsx', items),
    [exportData],
  )

  return { exportCSV, exportJSON, exportXLSX, exportData, exportAllowed, exportCooldownSec }
}
