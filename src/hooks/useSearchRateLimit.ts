import { useState, useEffect, useRef, useCallback } from 'react'
import { RATE_LIMIT_CONFIGS, getLimiter } from '../utils/rateLimit'

const { windowMs: DEBOUNCE_MS } = RATE_LIMIT_CONFIGS.search

/**
 * Debounce + rate-limit hook for search input.
 *
 * - Debounces the raw value by `DEBOUNCE_MS` (100 ms by default).
 * - Only emits a new `debouncedValue` when the sliding-window limiter allows
 *   it (max 1 change per 100 ms window), discarding excess calls silently.
 *
 * Usage:
 * ```tsx
 * const { debouncedValue } = useSearchRateLimit(rawValue)
 * // use debouncedValue for filtering/API calls
 * ```
 */
export function useSearchRateLimit(value: string): { debouncedValue: string } {
  const [debouncedValue, setDebouncedValue] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = useCallback((next: string) => {
    const limiter = getLimiter('search')
    if (!limiter.tryConsume()) return // throttled — discard
    setDebouncedValue(next)
  }, [])

  useEffect(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      handleChange(value)
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [value, handleChange])

  return { debouncedValue }
}
