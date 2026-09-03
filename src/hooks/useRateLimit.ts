import { useState, useEffect, useCallback, useRef } from 'react'
import { useRateLimitStore } from '../stores/rateLimitStore'
import type { RateLimitKey } from '../utils/rateLimit'

export interface RateLimitState {
  /** Whether the next action would be permitted right now. */
  allowed: boolean
  /** Remaining tokens in the current window. */
  remaining: number
  /** Milliseconds until the next token becomes available (0 when allowed). */
  cooldownMs: number
  /** Rounded-up seconds for display ("try again in Xs"). */
  cooldownSec: number
  /**
   * Attempt to consume a token.
   * Returns `true` when allowed and records the attempt;
   * returns `false` (without recording) when throttled.
   */
  consume: () => boolean
}

/**
 * Subscribe to the rate-limit state for a single `key` and expose a reactive
 * `cooldownMs` countdown so UI elements can disable themselves and show a
 * "try again in Xs" label during the cooldown period.
 *
 * The countdown ticks every 100 ms while active and stops automatically when
 * the limiter has capacity again.
 */
export function useRateLimit(key: RateLimitKey): RateLimitState {
  const consume = useRateLimitStore((s) => s.consume)
  const refresh = useRateLimitStore((s) => s.refresh)
  const entry = useRateLimitStore((s) => s.entries[key])

  // Local countdown derived from the store snapshot; ticks every 100 ms.
  const [cooldownMs, setCooldownMs] = useState(entry?.resetInMs ?? 0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Sync cooldownMs whenever the store entry changes (e.g. after consume).
  useEffect(() => {
    setCooldownMs(entry?.resetInMs ?? 0)
  }, [entry?.resetInMs])

  // Run a 100 ms ticker while we are in cooldown so the countdown is live.
  useEffect(() => {
    if (cooldownMs <= 0) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    if (intervalRef.current !== null) return // already ticking

    const start = Date.now()
    const initial = cooldownMs

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, initial - elapsed)
      setCooldownMs(remaining)

      if (remaining <= 0) {
        clearInterval(intervalRef.current!)
        intervalRef.current = null
        // Re-sync store snapshot so `allowed` and `remaining` update.
        refresh()
      }
    }, 100)

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [cooldownMs, refresh])

  const handleConsume = useCallback((): boolean => {
    return consume(key)
  }, [consume, key])

  const allowed = entry?.allowed ?? true
  const remaining = entry?.remaining ?? 0
  const cooldownSec = Math.ceil(cooldownMs / 1000)

  return { allowed, remaining, cooldownMs, cooldownSec, consume: handleConsume }
}
