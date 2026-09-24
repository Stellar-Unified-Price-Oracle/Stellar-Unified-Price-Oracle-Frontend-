/**
 * Client-side rate limiting utilities.
 *
 * Uses a sliding-window algorithm: each action records a timestamp; calls are
 * allowed only when fewer than `limit` timestamps fall within the last
 * `windowMs` milliseconds.  This is strictly in-memory — limits reset on page
 * reload, which is intentional for a frontend UX guard.
 */

// ---------------------------------------------------------------------------
// Configurable limits — change these constants to tune behaviour app-wide.
// ---------------------------------------------------------------------------

export const RATE_LIMIT_CONFIGS = {
  /** Alert creation: 5 per minute */
  alertCreate: { limit: 5, windowMs: 60_000 },
  /** Export requests: 3 per minute */
  export: { limit: 3, windowMs: 60_000 },
  /** Search input: at most 1 processed per 100 ms (debounce window) */
  search: { limit: 1, windowMs: 100 },
} as const

export type RateLimitKey = keyof typeof RATE_LIMIT_CONFIGS

// ---------------------------------------------------------------------------
// SlidingWindowRateLimiter
// ---------------------------------------------------------------------------

export class SlidingWindowRateLimiter {
  private readonly limit: number
  private readonly windowMs: number
  /** Sorted ascending list of call timestamps within the current window. */
  private timestamps: number[] = []

  constructor(limit: number, windowMs: number) {
    this.limit = limit
    this.windowMs = windowMs
  }

  /** Evict timestamps that have fallen outside the current window. */
  private evict(now: number): void {
    const cutoff = now - this.windowMs
    this.timestamps = this.timestamps.filter((t) => t > cutoff)
  }

  /**
   * Check whether the next call would be allowed without recording it.
   * Returns `{ allowed, remaining, resetInMs }`.
   */
  peek(now = Date.now()): { allowed: boolean; remaining: number; resetInMs: number } {
    this.evict(now)
    const remaining = Math.max(0, this.limit - this.timestamps.length)
    const allowed = remaining > 0

    // Time until the oldest call in the window expires
    const resetInMs =
      this.timestamps.length > 0
        ? Math.max(0, this.timestamps[0] + this.windowMs - now)
        : 0

    return { allowed, remaining, resetInMs }
  }

  /**
   * Attempt to consume one token.
   * Returns `true` and records the timestamp when allowed;
   * returns `false` without recording when the limit is reached.
   */
  tryConsume(now = Date.now()): boolean {
    this.evict(now)
    if (this.timestamps.length >= this.limit) return false
    this.timestamps.push(now)
    return true
  }

  /** Reset all recorded timestamps (e.g. for testing). */
  reset(): void {
    this.timestamps = []
  }
}

// ---------------------------------------------------------------------------
// Singleton registry — one limiter per key, shared across the app.
// ---------------------------------------------------------------------------

const registry = new Map<RateLimitKey, SlidingWindowRateLimiter>()

export function getLimiter(key: RateLimitKey): SlidingWindowRateLimiter {
  let limiter = registry.get(key)
  if (!limiter) {
    const cfg = RATE_LIMIT_CONFIGS[key]
    limiter = new SlidingWindowRateLimiter(cfg.limit, cfg.windowMs)
    registry.set(key, limiter)
  }
  return limiter
}

/** Expose the full registry for DevTools inspection (see useRateLimitStore). */
export function getLimiterRegistry(): ReadonlyMap<RateLimitKey, SlidingWindowRateLimiter> {
  return registry
}
