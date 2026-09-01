import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { RATE_LIMIT_CONFIGS, getLimiter } from '../utils/rateLimit'
import type { RateLimitKey } from '../utils/rateLimit'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitEntry {
  key: RateLimitKey
  limit: number
  windowMs: number
  remaining: number
  resetInMs: number
  allowed: boolean
}

export interface RateLimitStoreState {
  /** Snapshot of every rate-limiter's current status. */
  entries: Record<RateLimitKey, RateLimitEntry>
  /** Refresh the snapshot from the live limiters. */
  refresh: () => void
  /**
   * Attempt to consume a token for `key`.
   * Returns `true` when the action is allowed, `false` when throttled.
   * Always refreshes the store snapshot afterwards.
   */
  consume: (key: RateLimitKey) => boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSnapshot(): Record<RateLimitKey, RateLimitEntry> {
  const now = Date.now()
  return (Object.keys(RATE_LIMIT_CONFIGS) as RateLimitKey[]).reduce(
    (acc, key) => {
      const limiter = getLimiter(key)
      const { allowed, remaining, resetInMs } = limiter.peek(now)
      acc[key] = {
        key,
        limit: RATE_LIMIT_CONFIGS[key].limit,
        windowMs: RATE_LIMIT_CONFIGS[key].windowMs,
        remaining,
        resetInMs,
        allowed,
      }
      return acc
    },
    {} as Record<RateLimitKey, RateLimitEntry>,
  )
}

// ---------------------------------------------------------------------------
// Store
//
// `devtools` middleware exposes the full rate-limit state in the Redux DevTools
// browser extension under the action log — use it to inspect and debug limits
// without any extra tooling.
// ---------------------------------------------------------------------------

export const useRateLimitStore = create<RateLimitStoreState>()(
  devtools(
    (set) => ({
      entries: buildSnapshot(),

      refresh: () => {
        set({ entries: buildSnapshot() }, false, 'rateLimit/refresh')
      },

      consume: (key: RateLimitKey): boolean => {
        const limiter = getLimiter(key)
        const allowed = limiter.tryConsume()
        set({ entries: buildSnapshot() }, false, `rateLimit/consume/${key}`)
        return allowed
      },
    }),
    { name: 'RateLimitStore' },
  ),
)
