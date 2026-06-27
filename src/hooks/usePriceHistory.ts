import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchPriceHistory } from '../api/rest'
import type { PriceHistoryEntry } from '../types'

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
 */
export function usePriceHistory(
  pair: string | null,
  options: PriceHistoryOptions = {},
): PriceHistoryState {
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

  // Fetch initial data
  const refetch = useCallback(async () => {
    if (!pair) return

    try {
      setLoading(true)
      setError(null)
      offsetRef.current = 0

      const res = await fetchPriceHistory(pair, pageSize, 0)

      if (!isMountedRef.current) return

      setHistory(res.history)
      const hasMore = res.history.length === pageSize
      setHasMore(hasMore)
      hasMoreRef.current = hasMore
      offsetRef.current = pageSize
    } catch (err) {
      if (!isMountedRef.current) return
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      onError?.(error)
    } finally {
      if (isMountedRef.current) {
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

    try {
      loadingMoreRef.current = true
      setLoadingMore(true)
      setError(null)

      const res = await fetchPriceHistory(pair, pageSize, offsetRef.current)

      if (!isMountedRef.current) return

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
      if (!isMountedRef.current) return
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      onError?.(error)
    } finally {
      if (isMountedRef.current) {
        loadingMoreRef.current = false
        setLoadingMore(false)
      }
    }
  }, [pair, pageSize, onError])

  // Initial fetch and refresh interval
  useEffect(() => {
    refetch()
    intervalRef.current = setInterval(refetch, refreshInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [refetch, refreshInterval])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  return { history, loading, loadingMore, error, hasMore, loadMore, refetch }
}
