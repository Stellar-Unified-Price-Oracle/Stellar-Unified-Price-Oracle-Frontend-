/**
 * @file useWatchedParameters hook (#852).
 *
 * Manages subscribed/watched system parameters with persistent local storage,
 * automatic change detection across data refreshes, in-app notifications via ToastContext,
 * and pending change review banners.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import type { ParameterRecord } from '../types'
import { useOptionalToast } from '../context/ToastContext'
import {
  getStoredWatchedKeys,
  setStoredWatchedKeys,
  getStoredSnapshots,
  setStoredSnapshots,
  detectWatchedChanges,
  type ParameterSnapshot,
  type WatchedParameterChange,
} from '../utils/parameterNotifications'

export interface UseWatchedParametersReturn {
  watchedKeys: ReadonlySet<string>
  isWatched: (key: string) => boolean
  toggleWatch: (record: ParameterRecord) => void
  unacknowledgedChanges: WatchedParameterChange[]
  dismissChange: (key: string) => void
  dismissAllChanges: () => void
  watchedCount: number
}

export function useWatchedParameters(
  records: readonly ParameterRecord[] = [],
): UseWatchedParametersReturn {
  const [watchedKeys, setWatchedKeys] = useState<Set<string>>(() => new Set(getStoredWatchedKeys()))
  const [unacknowledgedChanges, setUnacknowledgedChanges] = useState<WatchedParameterChange[]>([])
  const snapshotsRef = useRef<Record<string, ParameterSnapshot>>(getStoredSnapshots())
  const toast = useOptionalToast()

  // Keep persistent storage in sync when watchedKeys change
  const updateWatchedKeys = useCallback((newSet: Set<string>) => {
    setWatchedKeys(newSet)
    setStoredWatchedKeys(Array.from(newSet))
  }, [])

  const toggleWatch = useCallback(
    (record: ParameterRecord) => {
      setWatchedKeys((prev) => {
        const next = new Set(prev)
        if (next.has(record.key)) {
          next.delete(record.key)
          // Also clear from unacknowledged changes if any
          setUnacknowledgedChanges((changes) => changes.filter((c) => c.key !== record.key))
        } else {
          next.add(record.key)
          // Snapshot current value on subscribe so no instant false notification fires
          const currentSnapshot: ParameterSnapshot = {
            lastChangedAt: record.lastChangedAt,
            currentValue: record.currentValue,
            label: record.label,
          }
          snapshotsRef.current = {
            ...snapshotsRef.current,
            [record.key]: currentSnapshot,
          }
          setStoredSnapshots(snapshotsRef.current)
        }
        setStoredWatchedKeys(Array.from(next))
        return next
      })
    },
    [],
  )

  const isWatched = useCallback(
    (key: string) => watchedKeys.has(key),
    [watchedKeys],
  )

  const dismissChange = useCallback((key: string) => {
    setUnacknowledgedChanges((prev) => prev.filter((c) => c.key !== key))
  }, [])

  const dismissAllChanges = useCallback(() => {
    setUnacknowledgedChanges([])
  }, [])

  // Detect changes whenever records are updated / refetched
  useEffect(() => {
    if (records.length === 0 || watchedKeys.size === 0) return

    const { changes, updatedSnapshots } = detectWatchedChanges(
      records,
      watchedKeys,
      snapshotsRef.current,
    )

    if (changes.length > 0) {
      setUnacknowledgedChanges((prev) => {
        const existingKeys = new Set(prev.map((p) => p.key))
        const newOnes = changes.filter((c) => !existingKeys.has(c.key))
        return [...newOnes, ...prev]
      })

      // Dispatch toast for each changed parameter
      if (toast) {
        for (const change of changes) {
          toast.addToast({
            type: 'info',
            message: `Watched parameter updated: ${change.label}`,
            description: `${change.previousValue} → ${change.newValue}`,
            duration: 6000,
          })
        }
      }
    }

    snapshotsRef.current = updatedSnapshots
    setStoredSnapshots(updatedSnapshots)
  }, [records, watchedKeys, toast])

  return {
    watchedKeys,
    isWatched,
    toggleWatch,
    unacknowledgedChanges,
    dismissChange,
    dismissAllChanges,
    watchedCount: watchedKeys.size,
  }
}
