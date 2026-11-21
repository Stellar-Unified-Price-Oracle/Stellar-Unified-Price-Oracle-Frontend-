import { useState, useEffect, useCallback } from 'react'

export interface UseLocalStorageOptions<T> {
  /** Serializer for writing to localStorage. Defaults to JSON.stringify. */
  serialize?: (value: T) => string
  /** Deserializer for reading from localStorage. Defaults to JSON.parse. */
  deserialize?: (value: string) => T
  /** Called when a read/write/remove operation fails (e.g. quota exceeded). */
  onError?: (error: Error) => void
}

export interface UseLocalStorageResult<T> {
  /** The current stored value */
  value: T
  /** Update the stored value */
  setValue: (value: T | ((prev: T) => T)) => void
  /** Remove the key from localStorage */
  remove: () => void
  /** Error message if a read/write operation failed, or null */
  error: string | null
}

/**
 * Returns true when the given error is a storage quota-exceeded error.
 */
export function isQuotaExceededError(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    (e as { code?: number }).code === 22 ||
    (e as { code?: number }).code === 1014
  )
}

/**
 * Syncs a state value with localStorage under the given key.
 *
 * Handles read errors (e.g. corrupt data), write errors (e.g. quota exceeded),
 * and cross-tab synchronisation via the `storage` event.
 *
 * @param key - localStorage key to read/write
 * @param initialValue - Fallback value when no stored value exists or on read error
 * @param options - Optional serialize/deserialize overrides and error callback
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: UseLocalStorageOptions<T> = {},
): UseLocalStorageResult<T> {
  const { serialize = JSON.stringify, deserialize = JSON.parse, onError } = options
  const [error, setError] = useState<string | null>(null)

  const reportError = useCallback(
    (e: unknown, fallback: string) => {
      const err = e instanceof Error ? e : new Error(fallback)
      const msg = isQuotaExceededError(e)
        ? 'Storage quota exceeded. Your changes were not saved.'
        : err.message || fallback
      setError(msg)
      onError?.(err)
    },
    [onError],
  )

  const read = useCallback((): T => {
    try {
      const item = localStorage.getItem(key)
      if (item === null) return initialValue
      return deserialize(item) as T
    } catch (e) {
      reportError(e, 'Failed to read from localStorage')
      return initialValue
    }
  }, [key, initialValue, deserialize, reportError])

  const [value, setValueInternal] = useState<T>(read)

  // Sync on key change
  useEffect(() => {
    setValueInternal(read())
  }, [key, read])

  // Listen for cross-tab changes
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key) {
        setValueInternal(read())
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [key, read])

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setError(null)
      setValueInternal((prev) => {
        const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next
        try {
          localStorage.setItem(key, serialize(resolved))
        } catch (e) {
          reportError(e, 'Failed to write to localStorage')
        }
        return resolved
      })
    },
    [key, serialize, reportError],
  )

  const remove = useCallback(() => {
    try {
      localStorage.removeItem(key)
      setValueInternal(initialValue)
    } catch (e) {
      reportError(e, 'Failed to remove from localStorage')
    }
  }, [key, initialValue, reportError])

  return { value, setValue, remove, error }
}
