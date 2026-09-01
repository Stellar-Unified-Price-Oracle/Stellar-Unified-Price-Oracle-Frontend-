/**
 * useSavedViews — React hook for managing persisted dashboard views.
 *
 * Views are stored in the `preferences` IndexedDB store under the key
 * `'saved-views'`. Reads use `useIdbQuery` (reactive, cache-first); writes use
 * `useIdbMutation` (fire-and-forget async). Success and error states are
 * surfaced via the app's toast system.
 *
 * @example
 * const { views, saveView, deleteView, activateView } = useSavedViews()
 */

import { useCallback, useMemo } from 'react'
import { useIdbQuery, useIdbMutation } from './useIdbQuery'
import { useToast } from '../context/ToastContext'
import { savedViewToUrlParams } from '../services/indexedDB'
import type { SavedView } from '../services/indexedDB'

const STORE = 'preferences' as const
const KEY = 'saved-views'

export interface UseSavedViewsReturn {
  /** All persisted views, sorted newest-first */
  views: SavedView[]
  /** True while the initial IndexedDB read is in-flight */
  loading: boolean
  /**
   * Persist a new view. Returns the newly created `SavedView` (with generated
   * `id`, `createdAt`, and `updatedAt`).
   */
  saveView: (view: Omit<SavedView, 'id' | 'createdAt' | 'updatedAt'>) => SavedView
  /**
   * Update mutable fields of an existing view. Silently no-ops if `id` is not
   * found.
   */
  updateView: (id: string, updates: Partial<Omit<SavedView, 'id' | 'createdAt'>>) => void
  /** Remove a view by id. Silently no-ops if not found. */
  deleteView: (id: string) => void
  /**
   * Navigate to the deep-link URL for the saved view, applying its state to
   * the current page via `window.location.assign`.
   */
  activateView: (id: string) => void
}

/** @internal Reads the raw array from IDB; falls back to empty array. */
function useRawViews(): { raw: SavedView[]; loading: boolean } {
  const { data, loading } = useIdbQuery<SavedView[]>(STORE, KEY)
  const raw = useMemo(() => (Array.isArray(data) ? data : []), [data])
  return { raw, loading }
}

export function useSavedViews(): UseSavedViewsReturn {
  const { raw, loading } = useRawViews()
  const mutation = useIdbMutation()
  const { addToast } = useToast()

  /**
   * Derive a stable, newest-first list so callers don't need to sort
   * themselves. `raw` already triggers re-renders via the IDB subscription.
   */
  const views = useMemo(
    () => [...raw].sort((a, b) => b.createdAt - a.createdAt),
    [raw],
  )

  const saveView = useCallback(
    (view: Omit<SavedView, 'id' | 'createdAt' | 'updatedAt'>): SavedView => {
      const now = Date.now()
      const newView: SavedView = {
        ...view,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      }

      const next = [...raw, newView]

      mutation
        .set(STORE, KEY, next)
        .then(() => {
          addToast({ type: 'success', message: `View "${newView.name}" saved` })
        })
        .catch(() => {
          addToast({ type: 'error', message: 'Failed to save view — please try again' })
        })

      return newView
    },
    [raw, mutation, addToast],
  )

  const updateView = useCallback(
    (id: string, updates: Partial<Omit<SavedView, 'id' | 'createdAt'>>): void => {
      const idx = raw.findIndex((v) => v.id === id)
      if (idx === -1) return

      const updated: SavedView = {
        ...raw[idx],
        ...updates,
        updatedAt: Date.now(),
      }
      const next = [...raw.slice(0, idx), updated, ...raw.slice(idx + 1)]

      mutation
        .set(STORE, KEY, next)
        .then(() => {
          addToast({ type: 'success', message: `View "${updated.name}" updated` })
        })
        .catch(() => {
          addToast({ type: 'error', message: 'Failed to update view — please try again' })
        })
    },
    [raw, mutation, addToast],
  )

  const deleteView = useCallback(
    (id: string): void => {
      const view = raw.find((v) => v.id === id)
      const next = raw.filter((v) => v.id !== id)

      mutation
        .set(STORE, KEY, next)
        .then(() => {
          if (view) {
            addToast({ type: 'success', message: `View "${view.name}" deleted` })
          }
        })
        .catch(() => {
          addToast({ type: 'error', message: 'Failed to delete view — please try again' })
        })
    },
    [raw, mutation, addToast],
  )

  const activateView = useCallback(
    (id: string): void => {
      const view = raw.find((v) => v.id === id)
      if (!view) {
        addToast({ type: 'error', message: 'View not found' })
        return
      }
      const qs = savedViewToUrlParams(view)
      window.location.assign(`/?${qs}`)
    },
    [raw, addToast],
  )

  return { views, loading, saveView, updateView, deleteView, activateView }
}
