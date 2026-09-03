import { useCallback, useEffect, useState } from 'react'
import { idbCache } from './useIndexedDB'
import type { StoreName } from './useIndexedDB'

export { type StoreName }

const TTL_MS = 5 * 60 * 1000

interface UseIdbQueryResult<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * React hook that subscribes to an IndexedDB key and re-renders on changes.
 * Supports cache-first strategy by default.
 */
export function useIdbQuery<T>(
  store: StoreName,
  key: string,
  ttl = TTL_MS,
): UseIdbQueryResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    idbCache
      .get<T>(store, key, ttl)
      .then((value) => {
        if (!cancelled) {
          setData(value)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load')
          setLoading(false)
        }
      })

    const unsubscribe = idbCache.subscribe(store, key, (value) => {
      if (!cancelled) {
        setData(value as T | null)
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [store, key, ttl])

  return { data, loading, error }
}

interface UseIdbMutationReturn {
  set: <T>(store: StoreName, key: string, value: T) => Promise<void>
  /** Batches multiple writes into a single transaction (#510) — prefer this
   * over calling `set` in a loop for bulk writes. */
  setMany: <T>(store: StoreName, entries: Array<{ key: string; value: T }>) => Promise<void>
  remove: (store: StoreName, key: string) => Promise<void>
  clear: (store: StoreName) => Promise<void>
}

/**
 * Provides a setter that writes to IndexedDB and notifies subscribers.
 */
export function useIdbMutation(): UseIdbMutationReturn {
  const set = useCallback(
    async <T>(store: StoreName, key: string, value: T) => {
      await idbCache.set(store, key, value)
    },
    [],
  )

  const setMany = useCallback(
    async <T>(store: StoreName, entries: Array<{ key: string; value: T }>) => {
      await idbCache.setMany(store, entries)
    },
    [],
  )

  const remove = useCallback(async (store: StoreName, key: string) => {
    await idbCache.delete(store, key)
  }, [])

  const clear = useCallback(async (store: StoreName) => {
    await idbCache.clear(store)
  }, [])

  return { set, setMany, remove, clear }
}
