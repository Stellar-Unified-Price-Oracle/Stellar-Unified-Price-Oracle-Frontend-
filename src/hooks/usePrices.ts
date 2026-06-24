import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchAllPrices } from '../api/rest'
import type { PriceData } from '../types'
import { config } from '../config'

export function usePrices(pairs?: string[]) {
  const [prices, setPrices] = useState<PriceData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await fetchAllPrices(pairs, signal)
      setPrices(data)
      setError(null)
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'Failed to fetch prices')
    } finally {
      setLoading(false)
    }
  }, [pairs])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    intervalRef.current = setInterval(() => load(controller.signal), config.refreshInterval)
    return () => {
      controller.abort()
      clearInterval(intervalRef.current)
    }
  }, [load])

  return { prices, loading, error, refetch: () => load() }
}
