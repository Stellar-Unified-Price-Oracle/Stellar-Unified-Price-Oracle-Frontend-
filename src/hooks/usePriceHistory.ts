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

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!pair) return
    setLoading(true)
    try {
      const res = await fetchPriceHistory(pair, limit, 0, startTs, endTs)
      if (signal?.aborted) return
      setHistory(res.history)
      setError(null)
    } catch (e) {
      if (signal?.aborted || (e instanceof Error && e.name === 'AbortError')) return
      setError(e instanceof Error ? e.message : 'Failed to fetch history')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [pair, limit, startTs, endTs])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    intervalRef.current = setInterval(() => load(controller.signal), 30_000)
    return () => {
      controller.abort()
      clearInterval(intervalRef.current)
    }
  }, [load])

  return { history, loading, error, refetch: () => load() }
}
