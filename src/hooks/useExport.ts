import { useCallback } from 'react'
import type { PriceData } from '../types'
import { loadExportUtils } from '../utils/deferredExports'
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

/** File name stem used for exported price data. */
const EXPORT_BASENAME = 'oracle-prices'

/**
 * Provides CSV, JSON, and XLSX export helpers.
 * All exports share a single sliding-window rate limiter:
 * max {@link RATE_LIMIT_CONFIGS}.export per minute (default 3).
 * `exportAllowed` and `exportCooldownSec` are exposed so callers can
 * disable buttons and display countdown labels during the cooldown period.
 *
 * The actual generators (`utils/export.ts`) are code-split and only loaded
 * once an export is triggered (see `utils/deferredExports.ts`).
 */
export function useExport(): UseExportReturn {
  const { allowed: exportAllowed, cooldownSec: exportCooldownSec, consume } = useRateLimit('export')

  const runExport = useCallback(async (format: ExportFormat, items: PriceData[], columns?: string[]) => {
    // Export generators (csv/xlsx encoding, file download plumbing) are only
    // pulled into a chunk once the user actually triggers an export.
    const {
      downloadBinaryFile,
      downloadFile,
      exportFilename,
      priceDataToCsvRows,
      priceDataToJsonRows,
      priceDataToXlsx,
      toCsv,
    } = await loadExportUtils()

    if (format === 'json') {
      const json = JSON.stringify(priceDataToJsonRows(items, columns), null, 2)
      downloadFile(json, exportFilename(EXPORT_BASENAME, 'json'), 'application/json')
    } else if (format === 'xlsx') {
      const xlsx = priceDataToXlsx(items, columns)
      downloadBinaryFile(
        xlsx,
        exportFilename(EXPORT_BASENAME, 'xlsx'),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
    } else {
      const { rows, headers } = priceDataToCsvRows(items, columns)
      downloadFile(toCsv(rows, headers), exportFilename(EXPORT_BASENAME, 'csv'), 'text/csv')
    }
  }, [])

  // Returns the (possibly pending) export promise so callers can await the
  // code-split module load + download; returns `undefined` when rate-limited.
  const exportData = useCallback(
    (format: ExportFormat, items: PriceData[], columns?: string[]): Promise<void> | undefined => {
      // Consume a single token for the aggregated exportData call so callers
      // using exportData directly are also rate-limited.
      if (!consume()) return undefined
      return runExport(format, items, columns)
    },
    [consume, runExport],
  )

  const exportCSV = useCallback(
    (items: PriceData[], columns?: string[]) => exportData('csv', items, columns),
    [exportData],
  )

  const exportJSON = useCallback(
    (items: PriceData[], columns?: string[]) => exportData('json', items, columns),
    [exportData],
  )

  const exportXLSX = useCallback(
    (items: PriceData[], columns?: string[]) => exportData('xlsx', items, columns),
    [exportData],
  )

  return { exportCSV, exportJSON, exportXLSX, exportData, exportAllowed, exportCooldownSec }
}
