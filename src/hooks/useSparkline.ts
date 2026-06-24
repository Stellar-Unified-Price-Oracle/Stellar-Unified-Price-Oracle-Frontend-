import { useEffect, useState, useRef } from 'react'
import { fetchPriceHistory } from '../api/rest'
import type { PriceHistoryEntry } from '../types'

const cache = new Map<string, PriceHistoryEntry[]>()

/**
 * Lightweight hook to load the last `limit` history entries for sparklines.
 * Uses a simple in-memory cache to avoid redundant fetches across cards.
 */
export function useSparkline(pair: string, limit = 24) {
  const [history, setHistory] = useState<PriceHistoryEntry[]>(() => cache.get(pair) ?? [])
  const pairRef = useRef(pair)
  pairRef.current = pair

  useEffect(() => {
    let cancelled = false

    async function load() {
      // Return cached data immediately if available
      const cached = cache.get(pair)
      if (cached) {
        setHistory(cached)
        return
      }

      try {
        const res = await fetchPriceHistory(pair, limit)
        if (!cancelled && pairRef.current === pair) {
          cache.set(pair, res.history)
          setHistory(res.history)
        }
      } catch {
        // Silently fail – sparklines are non-critical
      }
    }

    load()
    return () => { cancelled = true }
  }, [pair, limit])

  return history
}
