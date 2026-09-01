/** Column definitions for the price data export (#317). */

export type ExportColumnKey = 'assetPair' | 'price' | 'timestamp' | 'confidence' | 'sources'

export interface ExportColumnDef {
  key: ExportColumnKey
  label: string
}

/** All columns available for price data exports, in their default order. */
export const EXPORT_COLUMNS: ExportColumnDef[] = [
  { key: 'assetPair', label: 'Asset Pair' },
  { key: 'price', label: 'Price' },
  { key: 'timestamp', label: 'Timestamp' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'sources', label: 'Sources' },
]

export const EXPORT_COLUMN_KEYS: ExportColumnKey[] = EXPORT_COLUMNS.map((c) => c.key)

export type ColumnPresetName = 'minimal' | 'standard' | 'full'

export const COLUMN_PRESETS: Record<ColumnPresetName, ExportColumnKey[]> = {
  minimal: ['assetPair', 'price'],
  standard: ['assetPair', 'price', 'timestamp', 'confidence'],
  full: ['assetPair', 'price', 'timestamp', 'confidence', 'sources'],
}

/** Keeps only recognised column keys, in the order supplied. Falls back to all columns when empty/invalid. */
export function sanitizeColumns(columns: string[] | undefined | null): ExportColumnKey[] {
  if (!columns || columns.length === 0) return EXPORT_COLUMN_KEYS
  const valid = columns.filter((c): c is ExportColumnKey => EXPORT_COLUMN_KEYS.includes(c as ExportColumnKey))
  return valid.length > 0 ? valid : EXPORT_COLUMN_KEYS
}
