import { useState, useEffect, useCallback } from 'react'

export interface UseLocalStorageOptions<T> {
  /** Serializer for writing to localStorage. Defaults to JSON.stringify. */
  serialize?: (value: T) => string
  /** Deserializer for reading from localStorage. Defaults to JSON.parse. */
  deserialize?: (value: string) => T
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
 * Syncs a state value with localStorage under the given key.
 *
 * Handles read errors (e.g. corrupt data), write errors (e.g. quota exceeded),
 * and cross-tab synchronisation via the `storage` event.
 *
 * @param key - localStorage key to read/write
 * @param initialValue - Fallback value when no stored value exists or on read error
 * @param options - Optional serialize/deserialize overrides
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: UseLocalStorageOptions<T> = {},
): UseLocalStorageResult<T> {
  const { serialize = JSON.stringify, deserialize = JSON.parse } = options
  const [error, setError] = useState<string | null>(null)

  const read = useCallback((): T => {
    try {
      const item = localStorage.getItem(key)
      if (item === null) return initialValue
      return deserialize(item) as T
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to read from localStorage'
      setError(msg)
      return initialValue
    }
  }, [key, initialValue, deserialize])

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
          const msg = e instanceof Error ? e.message : 'Failed to write to localStorage'
          setError(msg)
        }
        return resolved
      })
    },
    [key, serialize],
  )

  const remove = useCallback(() => {
    try {
      localStorage.removeItem(key)
      setValueInternal(initialValue)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to remove from localStorage'
      setError(msg)
    }
  }, [key, initialValue])

  return { value, setValue, remove, error }
}
