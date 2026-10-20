/**
 * @file Parameter watch & subscription notifications helper (#852).
 *
 * Provides persistence and change detection for system parameter watch subscriptions.
 * Enables users to subscribe to critical governance/tuning parameters and receive
 * immediate notifications when their values or timestamps advance.
 */
import type { ParameterRecord } from '../types'

export const WATCHED_PARAMS_STORAGE_KEY = 'stellar_watched_parameters'
export const WATCHED_SNAPSHOTS_STORAGE_KEY = 'stellar_watched_parameter_snapshots'

export interface ParameterSnapshot {
  lastChangedAt: number | null
  currentValue: string
  label: string
}

export interface WatchedParameterChange {
  key: string
  label: string
  previousValue: string
  newValue: string
  changedAt: number | null
  detectedAt: number
}

function safeGetItem(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    window.localStorage.setItem(key, value)
  } catch {
    // Ignore storage quota or access errors
  }
}

/**
 * Loads the list of watched parameter keys from persistent storage.
 */
export function getStoredWatchedKeys(): string[] {
  const raw = safeGetItem(WATCHED_PARAMS_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : []
  } catch {
    return []
  }
}

/**
 * Persists the list of watched parameter keys to storage.
 */
export function setStoredWatchedKeys(keys: string[]): void {
  safeSetItem(WATCHED_PARAMS_STORAGE_KEY, JSON.stringify(Array.from(new Set(keys))))
}

/**
 * Loads cached parameter snapshots from persistent storage.
 */
export function getStoredSnapshots(): Record<string, ParameterSnapshot> {
  const raw = safeGetItem(WATCHED_SNAPSHOTS_STORAGE_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Persists parameter snapshots to storage.
 */
export function setStoredSnapshots(snapshots: Record<string, ParameterSnapshot>): void {
  safeSetItem(WATCHED_SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshots))
}

/**
 * Compares current parameter records against stored snapshots for all watched parameters.
 *
 * Returns:
 * - `changes`: List of detected changes for watched parameters.
 * - `updatedSnapshots`: The updated snapshot map reflecting current values.
 */
export function detectWatchedChanges(
  records: readonly ParameterRecord[],
  watchedKeys: ReadonlySet<string>,
  previousSnapshots: Record<string, ParameterSnapshot>,
  detectedAt: number = Date.now(),
): {
  changes: WatchedParameterChange[]
  updatedSnapshots: Record<string, ParameterSnapshot>
} {
  const changes: WatchedParameterChange[] = []
  const updatedSnapshots: Record<string, ParameterSnapshot> = { ...previousSnapshots }

  for (const record of records) {
    if (!watchedKeys.has(record.key)) {
      continue
    }

    const prev = previousSnapshots[record.key]
    const currentSnapshot: ParameterSnapshot = {
      lastChangedAt: record.lastChangedAt,
      currentValue: record.currentValue,
      label: record.label,
    }

    if (prev) {
      const valueChanged = prev.currentValue !== record.currentValue
      const timeChanged =
        record.lastChangedAt !== null &&
        prev.lastChangedAt !== null &&
        record.lastChangedAt > prev.lastChangedAt

      if (valueChanged || timeChanged) {
        changes.push({
          key: record.key,
          label: record.label,
          previousValue: prev.currentValue,
          newValue: record.currentValue,
          changedAt: record.lastChangedAt,
          detectedAt,
        })
      }
    }

    // Always update the snapshot to latest observed state
    updatedSnapshots[record.key] = currentSnapshot
  }

  return { changes, updatedSnapshots }
}
