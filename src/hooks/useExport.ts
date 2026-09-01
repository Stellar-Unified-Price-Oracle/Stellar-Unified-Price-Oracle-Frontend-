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

/**
 * Provides CSV, JSON, and XLSX export helpers.
 * All exports share a single sliding-window rate limiter:
 * max {@link RATE_LIMIT_CONFIGS}.export per minute (default 3).
 * `exportAllowed` and `exportCooldownSec` are exposed so callers can
 * disable buttons and display countdown labels during the cooldown period.
 */
export function useExport(): UseExportReturn {
  const { allowed: exportAllowed, cooldownSec: exportCooldownSec, consume } = useRateLimit('export')

  const exportData = useCallback(
    async (format: ExportFormat, items: PriceData[], columns?: string[]) => {
      // Consume a single token for the aggregated exportData call so callers
      // using exportData directly are also rate-limited.
      if (!consume()) return
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
        exportJSON(items, columns)
      } else if (format === 'xlsx') {
        exportXLSX(items, columns)
      } else {
        exportCSV(items, columns)
      }
    },
    [exportCSV, exportJSON, exportXLSX],
  )

  return { exportCSV, exportJSON, exportXLSX, exportData, exportAllowed, exportCooldownSec }
}
