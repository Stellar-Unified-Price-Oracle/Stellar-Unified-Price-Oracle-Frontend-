import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchPriceHistory } from '../api/rest'
import { registerMemoryProbe } from '../utils/memoryProfiler'
import type { PriceHistoryEntry, PriceHistoryResponse } from '../types'
import { SERIES_IDS, timeSeries } from '../storage/timeseries'
import { idbCache } from './useIndexedDB'

// Cross-session cache TTL for the first page of history, per #321's endpoint
// TTL tiers (history: 2 min). Pagination (loadMore) always hits the network.
const HISTORY_CACHE_TTL_MS = 2 * 60 * 1000

let legacyPriceHistoryImported = false

/**
 * One-time backfill: projects price-history response blobs cached by the older
 * format into durable `price-history:<pair>` time-series. Idempotent (points are
 * keyed by `(series, tier, timestamp)`), guarded to a single pass per session.
 */
async function importLegacyPriceHistory(): Promise<void> {
  if (legacyPriceHistoryImported) return
  legacyPriceHistoryImported = true
  await timeSeries.initialize()
  const cached = await idbCache.getAll<PriceHistoryResponse>('history')
  for (const response of cached) {
    if (!response?.pair || !Array.isArray(response.history) || response.history.length === 0) continue
    await timeSeries.appendMany(SERIES_IDS.priceHistory(response.pair), response.history)
  }
}

export interface PriceHistoryOptions {
  pageSize?: number
  refreshInterval?: number
  onError?: (error: Error) => void
}

interface PriceHistoryState {
  history: PriceHistoryEntry[]
  loading: boolean
  loadingMore: boolean
  error: Error | null
  hasMore: boolean
  loadMore: () => Promise<void>
  refetch: () => Promise<void>
}

/**
 * Hook for managing paginated price history with infinite scroll support.
 * Fetches historical price data for a given pair with pagination capabilities.
 * Includes a refresh interval to keep the latest data updated.
 * Defers fetching until the page is visible using the Page Visibility API.
 */
export function usePriceHistory(pair: string | null, options: PriceHistoryOptions = {}): PriceHistoryState {
  const { pageSize = 100, refreshInterval = 30_000, onError } = options

  const [history, setHistory] = useState<PriceHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const offsetRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const isMountedRef = useRef(true)
  const loadingMoreRef = useRef(false)
  const hasMoreRef = useRef(true)
  const hasFetchedRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  // Track page visibility
  const isVisibleRef = useRef(typeof document !== 'undefined' ? !document.hidden : true)

  // Fetch initial data
  const refetch = useCallback(async () => {
    if (!pair) return

    // Cancel any in-flight request for this pair (duplicate call, e.g. from a
    // refresh interval firing before the previous fetch settled).
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      setLoading(true)
      setError(null)
      offsetRef.current = 0

      const cacheKey = `${pair}:${pageSize}`
      const cached = await idbCache.get<PriceHistoryResponse>('history', cacheKey, HISTORY_CACHE_TTL_MS)

      let res: PriceHistoryResponse
      if (cached !== null) {
        res = cached
      } else {
        res = await fetchPriceHistory(pair, pageSize, 0, undefined, undefined, controller.signal)
        if (isMountedRef.current && !controller.signal.aborted) {
          void idbCache.set('history', cacheKey, res)
          // Project onto the durable time-series so long-term history gets
          // retention + rollups rather than living only in a 2-minute cache.
          void timeSeries.appendMany(SERIES_IDS.priceHistory(pair), res.history)
        }
      }

      if (!isMountedRef.current || controller.signal.aborted) return

      setHistory(res.history)
      const hasMore = res.history.length === pageSize
      setHasMore(hasMore)
      hasMoreRef.current = hasMore
      offsetRef.current = pageSize
      hasFetchedRef.current = true
    } catch (err) {
      if (!isMountedRef.current || controller.signal.aborted) return
      if (err instanceof DOMException && err.name === 'AbortError') return
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      onError?.(error)
    } finally {
      if (isMountedRef.current && !controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [pair, pageSize, onError])

  // Load more pages (pagination)
  const loadMore = useCallback(async () => {
    // Check refs to avoid stale closures
    if (!pair || loadingMoreRef.current || !hasMoreRef.current) {
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      loadingMoreRef.current = true
      setLoadingMore(true)
      setError(null)

      const res = await fetchPriceHistory(pair, pageSize, offsetRef.current, undefined, undefined, controller.signal)

      if (!isMountedRef.current || controller.signal.aborted) return

      void timeSeries.appendMany(SERIES_IDS.priceHistory(pair), res.history)

      if (res.history.length === 0) {
        hasMoreRef.current = false
        setHasMore(false)
      } else {
        setHistory((prev) => [...prev, ...res.history])
        const hasMore = res.history.length === pageSize
        hasMoreRef.current = hasMore
        setHasMore(hasMore)
        offsetRef.current += res.history.length
      }
    } catch (err) {
      if (!isMountedRef.current || controller.signal.aborted) return
      if (err instanceof DOMException && err.name === 'AbortError') return
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      onError?.(error)
    } finally {
      if (isMountedRef.current && !controller.signal.aborted) {
        loadingMoreRef.current = false
        setLoadingMore(false)
      }
    }
  }, [pair, pageSize, onError])

  // Project previously-cached history blobs into the time-series once.
  useEffect(() => {
    void importLegacyPriceHistory()
  }, [])

  // Initial fetch and refresh interval with visibility deferral
  useEffect(() => {
    if (!pair) return

    // Defer initial fetch until page is visible
    if (isVisibleRef.current) {
      refetch()
    }

    // Set up refresh interval
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        if (isVisibleRef.current) {
          refetch()
        }
      }, refreshInterval)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [pair, refetch, refreshInterval])

  // Page Visibility API: pause/resume fetching
  useEffect(() => {
    if (typeof document === 'undefined') return

    const handleVisibilityChange = () => {
      const visible = !document.hidden
      isVisibleRef.current = visible

      // When becoming visible and haven't fetched yet, fetch now
      if (visible && !hasFetchedRef.current && pair) {
        refetch()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [pair, refetch])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  // #504 — report this instance's buffered point count to the memory
  // profiling harness ("chart buffers" subsystem). Several chart components
  // may mount their own history hook at once; probes summed by subsystem.
  const historyRef = useRef(history)
  historyRef.current = history
  useEffect(() => registerMemoryProbe('chartBuffers', () => historyRef.current.length), [])

  return { history, loading, loadingMore, error, hasMore, loadMore, refetch }
}
