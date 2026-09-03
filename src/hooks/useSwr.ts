import { useCallback, useEffect, useRef, useState } from 'react'

/** In-memory cache entry storing the last fetched value and the time it was stored. */
interface CacheEntry {
  data: unknown
  timestamp: number
}

const cache = new Map<string, CacheEntry>()

/**
 * In-flight deduplication map.
 * Maps a cache key → the single Promise that is currently resolving it.
 * All concurrent callers with the same key share this Promise.
 */
const inFlight = new Map<string, Promise<unknown>>()

/** Configuration options for {@link useSwr}. */
export interface SwrOptions {
  /** Interval in ms between automatic background refetches. 0 disables polling. */
  refreshInterval?: number
  /** Time in ms before a cached value is considered stale and triggers a background revalidation. */
  staleTime?: number
  /** Number of additional attempts after the first failure before settling on an error state. */
  retryCount?: number
  /** Set to false to skip fetching entirely (e.g. while a dependency is not yet ready). */
  enabled?: boolean
  /**
   * Callback invoked on every fetch error (after all retries are exhausted).
   * Useful for wiring into an {@link ErrorReporter} without a render-phase boundary.
   */
  onError?: (error: Error) => void
}

/** Return value of {@link useSwr}. */
export interface SwrResult<T> {
  /** The most recently fetched data, or `undefined` while loading for the first time. */
  data: T | undefined
  /** Error object from the last failed fetch, or `null` when the last fetch succeeded. */
  error: Error | null
  /** The error message string, kept for backward-compatibility with existing consumers. */
  errorMessage: string | null
  /** `true` only on the initial fetch before any data is available. */
  loading: boolean
  /** `true` whenever a background revalidation is in progress (data may already be visible). */
  isValidating: boolean
  /** Trigger an immediate refetch outside of the normal polling cycle. */
  refetch: () => void
}

/**
 * Minimal stale-while-revalidate hook for data fetching.
 *
 * Key improvements over the original implementation:
 *
 * - **Request deduplication** – concurrent callers with the same `key` share one
 *   in-flight fetch instead of firing duplicate network requests.
 * - **Race-condition protection** – responses for a superseded fetch (after key
 *   change or component unmount) are discarded via a per-execution sequence number.
 * - **Structured error exposure** – the `error` field is now an `Error` object so
 *   callers can inspect `.message`, `.stack`, or any custom properties.
 * - **`onError` callback** – fires after all retries for out-of-band reporting
 *   (e.g. feeding an {@link ErrorReporterProvider}).
 *
 * ## Infinite re-render loop protection
 *
 * Fetcher functions that return a **new reference on every call** (e.g. via
 * `.map()`, `.filter()`, or object spread) would ordinarily trigger an infinite
 * cycle when consumers place the returned data in a `useEffect` dependency
 * array:
 *
 *   new reference → effect re-runs → re-fetch → new reference → …
 *
 * This is prevented by a ref-based identity check: the `data` state is only
 * updated when the incoming value differs from the previous one using
 * `JSON.stringify` comparison. Primitive values and objects that are
 * structurally identical across fetches therefore keep the same React state
 * reference, eliminating the spurious re-render cycle.
 *
 * @param key - Unique string key for this request. Changing the key resets state and re-fetches.
 * @param fetcher - Async function that returns the data. Re-created each render; the hook always calls the latest version.
 * @param options - Optional behaviour overrides (see {@link SwrOptions}).
 */
export function useSwr<T>(
  key: string,
  fetcher: (signal?: AbortSignal) => Promise<T>,
  options: SwrOptions = {},
): SwrResult<T> {
  const {
    refreshInterval = 0,
    staleTime = 0,
    retryCount = 0,
    enabled = true,
    onError,
  } = options

  const cached = cache.get(key) as CacheEntry | undefined

  const [data, setData] = useState<T | undefined>(() => cached?.data as T | undefined)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(!cached)
  const [isValidating, setIsValidating] = useState(false)

  // Monotonically-increasing sequence counter to detect stale responses
  const execSeqRef = useRef(0)
  const retries = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const keyRef = useRef(key)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  /**
   * Writes `value` to `data` state only when its serialised form differs from
   * the last written value. This keeps the reference stable across fetches that
   * return structurally equal data, preventing spurious downstream effects.
   */
  const setStableData = useCallback((value: T) => {
    const next = JSON.stringify(value)
    if (next !== lastDataJsonRef.current) {
      lastDataJsonRef.current = next
      setData(value)
    }
  }, [])

  const execute = useCallback(async () => {
    if (!enabled) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    // Capture the sequence number for this execution; discard if superseded
    execSeqRef.current += 1
    const thisSeq = execSeqRef.current

    setIsValidating(true)

    try {
      let resultPromise = inFlight.get(keyRef.current) as Promise<T> | undefined

      if (!resultPromise) {
        resultPromise = fetcherRef.current(controller.signal)
        inFlight.set(keyRef.current, resultPromise as Promise<unknown>)
        resultPromise.finally(() => inFlight.delete(keyRef.current))
      }

      const result = await resultPromise

      // Discard stale response (key changed or component unmounted)
      if (!mountedRef.current || controller.signal.aborted) return
      if (execSeqRef.current !== thisSeq) return

      cache.set(keyRef.current, { data: result as unknown, timestamp: Date.now() })
      setStableData(result)
      setError(null)
      retries.current = 0
    } catch (e) {
      if (!mountedRef.current || controller.signal.aborted) return
      if (execSeqRef.current !== thisSeq) return
      if (e instanceof Error && e.name === 'AbortError') return

      if (retries.current < retryCount) {
        retries.current++
        const delay = Math.min(1000 * 2 ** retries.current, 30_000)
        setTimeout(execute, delay)
        return
      }

      const err = e instanceof Error ? e : new Error(String(e))
      setError(err)
      onErrorRef.current?.(err)
    } finally {
      if (mountedRef.current && !controller.signal.aborted) {
        setIsValidating(false)
        setLoading(false)
      }
    }
  }, [enabled, retryCount, setStableData])

  useEffect(() => {
    mountedRef.current = true
    keyRef.current = key
    // Reset sequence so any in-flight response from the old key is discarded
    execSeqRef.current = 0

    const entry = cache.get(key) as CacheEntry | undefined
    const isStale = !entry || Date.now() - entry.timestamp > staleTime

    if (entry && !isStale) {
      setStableData(entry.data as T)
      setLoading(false)
      setIsValidating(false)
    } else if (entry && isStale) {
      setStableData(entry.data as T)
      setLoading(false)
      execute()
    } else {
      setLoading(true)
      execute()
    }

    if (refreshInterval > 0) {
      const interval = setInterval(() => execute(), refreshInterval)
      return () => {
        clearInterval(interval)
        mountedRef.current = false
        abortRef.current?.abort()
      }
    }

    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [key, staleTime, refreshInterval, execute, setStableData])

  const refetch = useCallback(() => execute(), [execute])

  return {
    data,
    error,
    // Backward-compat: keep errorMessage as a string | null
    errorMessage: error?.message ?? null,
    loading,
    isValidating,
    refetch,
  }
}
