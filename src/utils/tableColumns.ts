import { TOGGLEABLE_TABLE_COLUMNS } from '../preferences/constants'
import type { ToggleableTableColumn } from '../preferences/types'

/**
 * Normalises a stored hidden-columns value (#813).
 *
 * Preferences are loaded from IndexedDB without a schema check, so unknown keys, duplicates,
 * and non-arrays are dropped here. The result is always in display order.
 */
export function sanitizeHiddenTableColumns(value: unknown): ToggleableTableColumn[] {
  if (!Array.isArray(value)) return []
  return TOGGLEABLE_TABLE_COLUMNS.filter((key) => value.includes(key))
}
