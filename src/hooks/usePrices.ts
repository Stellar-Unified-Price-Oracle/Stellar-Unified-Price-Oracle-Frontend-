import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchAllPrices } from '../api/rest'
import type { PriceData } from '../types'
import { config } from '../config'

export function usePrices(pairs?: string[]) {
  const [prices, setPrices] = useState<PriceData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const load = useCallback(async () => {
    try {
      const data = await fetchAllPrices(pairs)
      setPrices(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch prices')
    } finally {
      setLoading(false)
    }
  }, [pairs])

  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, config.refreshInterval)
    return () => clearInterval(intervalRef.current)
  }, [load])

  return { prices, loading, error, refetch: load }
}
