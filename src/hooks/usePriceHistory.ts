import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchPriceHistory } from '../api/rest'
import type { PriceHistoryEntry } from '../types'

export interface PriceHistoryOptions {
  limit?: number
  startTs?: number
  endTs?: number
}

export function usePriceHistory(pair: string | null, options: PriceHistoryOptions = {}) {
  const { limit = 100, startTs, endTs } = options
  const [history, setHistory] = useState<PriceHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)
  const abortRef = useRef<AbortController>(undefined)

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!pair) return
    setLoading(true)
    try {
      const res = await fetchPriceHistory(pair, limit, 0, startTs, endTs, signal)
      setHistory(res.history)
      setError(null)
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'Failed to fetch history')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [pair, limit, startTs, endTs])

  useEffect(() => {
    abortRef.current = new AbortController()
    load(abortRef.current.signal)
    intervalRef.current = setInterval(() => {
      abortRef.current = new AbortController()
      load(abortRef.current.signal)
    }, 30_000)
    return () => {
      abortRef.current?.abort()
      clearInterval(intervalRef.current)
    }
  }, [load])

  return { history, loading, error, refetch: () => load() }
}
