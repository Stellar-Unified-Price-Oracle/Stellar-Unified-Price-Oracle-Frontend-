import { useCallback, useEffect, useState } from 'react'
import {
  COLUMN_PRESETS,
  EXPORT_COLUMN_KEYS,
  sanitizeColumns,
  type ColumnPresetName,
  type ExportColumnKey,
} from '../utils/exportColumns'
import { useIdbQuery, useIdbMutation } from './useIdbQuery'

export interface UseColumnSelectionReturn {
  columns: ExportColumnKey[]
  setColumns: (columns: ExportColumnKey[]) => void
  applyPreset: (preset: ColumnPresetName) => void
  loading: boolean
}

/**
 * Persists the user's selected/ordered export columns per export format
 * (#317) in IndexedDB, following the same `useIdbQuery`/`useIdbMutation`
 * pattern as other per-user preferences.
 */
export function useColumnSelection(format: string): UseColumnSelectionReturn {
  const idbKey = `export-columns-${format}`
  const { data, loading } = useIdbQuery<ExportColumnKey[]>('preferences', idbKey)
  const { set } = useIdbMutation()
  const [columns, setColumnsState] = useState<ExportColumnKey[]>(EXPORT_COLUMN_KEYS)

  useEffect(() => {
    if (!loading) setColumnsState(sanitizeColumns(data ?? undefined))
  }, [data, loading])

  const setColumns = useCallback(
    (next: ExportColumnKey[]) => {
      const sanitized = sanitizeColumns(next)
      setColumnsState(sanitized)
      void set('preferences', idbKey, sanitized)
    },
    [idbKey, set],
  )

  const applyPreset = useCallback(
    (preset: ColumnPresetName) => setColumns(COLUMN_PRESETS[preset]),
    [setColumns],
  )

  return { columns, setColumns, applyPreset, loading }
}
