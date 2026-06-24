import { useState, useCallback } from 'react'
import type { PriceData, PriceHistoryEntry } from '../types'
import {
  toCsv,
  priceDataToCsvRows,
  historyToCsvRows,
  downloadFile,
  exportFilename,
} from '../utils/export'

export type ExportFormat = 'csv' | 'json'

export function useExport() {
  const [exporting, setExporting] = useState(false)

  const exportPrices = useCallback(async (prices: PriceData[], format: ExportFormat) => {
    setExporting(true)
    try {
      const filename = exportFilename('all-prices', format)
      if (format === 'json') {
        const data = prices.map((p) => ({ ...p, timestamp: new Date(p.timestamp).toISOString() }))
        downloadFile(JSON.stringify(data, null, 2), filename, 'application/json')
      } else {
        const { rows, headers } = priceDataToCsvRows(prices)
        downloadFile(toCsv(rows, headers), filename, 'text/csv')
      }
    } finally {
      setExporting(false)
    }
  }, [])

  const exportHistory = useCallback(async (pair: string, history: PriceHistoryEntry[], format: ExportFormat) => {
    setExporting(true)
    try {
      const filename = exportFilename(pair, format)
      if (format === 'json') {
        const data = history.map((h) => ({ ...h, assetPair: pair, timestamp: new Date(h.timestamp).toISOString() }))
        downloadFile(JSON.stringify(data, null, 2), filename, 'application/json')
      } else {
        const { rows, headers } = historyToCsvRows(pair, history)
        downloadFile(toCsv(rows, headers), filename, 'text/csv')
      }
    } finally {
      setExporting(false)
    }
  }, [])

  return { exporting, exportPrices, exportHistory }
}
