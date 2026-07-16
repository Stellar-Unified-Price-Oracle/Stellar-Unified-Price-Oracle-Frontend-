import { useCallback } from 'react'
import type { PriceData } from '../types'
import { toCsv, priceDataToCsvRows, downloadFile, exportFilename } from '../utils/export'

export type ExportFormat = 'csv' | 'json'

export function useExport() {
  const exportCSV = useCallback((items: PriceData[]) => {
    const { rows, headers } = priceDataToCsvRows(items)
    const csv = toCsv(rows, headers)
    downloadFile(csv, exportFilename('oracle-prices', 'csv'), 'text/csv')
  }, [])

  return { exportCSV }
}
