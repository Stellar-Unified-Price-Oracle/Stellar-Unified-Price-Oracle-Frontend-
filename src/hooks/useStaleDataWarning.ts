import { useEffect, useState } from 'react'
import type { PriceData } from '../types'

const TICK_MS = 5000

/**
 * Returns `true` when at least one of `prices` hasn't updated within
 * `staleThresholdMinutes`. Ticks every {@link TICK_MS} so the result stays
 * accurate even when no new price data arrives.
 */
export function useStaleDataWarning(prices: PriceData[], staleThresholdMinutes: number): boolean {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  const thresholdMs = staleThresholdMinutes * 60_000
  return prices.some((p) => now - p.timestamp > thresholdMs)
}
