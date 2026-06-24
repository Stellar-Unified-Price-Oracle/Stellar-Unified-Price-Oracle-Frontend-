import { useCallback, useEffect, useRef, useState } from 'react'

interface CacheEntry {
  data: unknown
  timestamp: number
}

const cache = new Map<string, CacheEntry>()

export interface SwrOptions {
  refreshInterval?: number
  staleTime?: number
  retryCount?: number
  enabled?: boolean
}

export interface SwrResult<T> {
  data: T | undefined
  error: string | null
  loading: boolean
  isValidating: boolean
  refetch: () => void
}

export function useSwr<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: SwrOptions = {},
): SwrResult<T> {
  const {
    refreshInterval = 0,
    staleTime = 0,
    retryCount = 0,
    enabled = true,
  } = options

  const cached = cache.get(key) as CacheEntry | undefined

  const [data, setData] = useState<T | undefined>(
    () => cached?.data as T | undefined,
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!cached)
  const [isValidating, setIsValidating] = useState(false)

  const retries = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const keyRef = useRef(key)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const execute = useCallback(async () => {
    if (!enabled) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsValidating(true)

    try {
      const result = await fetcherRef.current()
      if (!mountedRef.current || controller.signal.aborted) return

      cache.set(keyRef.current, { data: result as unknown, timestamp: Date.now() })
      setData(result)
      setError(null)
      retries.current = 0
    } catch (e) {
      if (!mountedRef.current || controller.signal.aborted) return

      if (retries.current < retryCount) {
        retries.current++
        const delay = Math.min(1000 * 2 ** retries.current, 30000)
        setTimeout(execute, delay)
        return
      }

      setError(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      if (mountedRef.current && !controller.signal.aborted) {
        setIsValidating(false)
        setLoading(false)
      }
    }
  }, [enabled, retryCount])

  useEffect(() => {
    mountedRef.current = true
    keyRef.current = key

    const entry = cache.get(key) as CacheEntry | undefined
    const isStale = !entry || Date.now() - entry.timestamp > staleTime

    if (entry && !isStale) {
      setData(entry.data as T)
      setLoading(false)
      setIsValidating(false)
    } else if (entry && isStale) {
      setData(entry.data as T)
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
  }, [key, staleTime, refreshInterval, execute])

  const refetch = useCallback(() => execute(), [execute])

  return { data, error, loading, isValidating, refetch }
}
