export type RateLimitStatus = 'ok' | 'limited'

export type RateLimitListener = (
  status: RateLimitStatus,
  retryAfterMs: number,
) => void

class RateLimitManager {
  private _status: RateLimitStatus = 'ok'
  private _retryAfterMs = 0
  private _limitedUntil = 0
  private listeners = new Set<RateLimitListener>()
  private timer: ReturnType<typeof setTimeout> | null = null

  get status(): RateLimitStatus {
    return this._status
  }

  get retryAfterMs(): number {
    return this._retryAfterMs
  }

  get isLimited(): boolean {
    return this._status === 'limited'
  }

  /**
   * Called when a 429 response is received.
   * Returns the retry-after duration in milliseconds.
   */
  setRateLimited(retryAfterSeconds: number): number {
    this._retryAfterMs = retryAfterSeconds * 1000
    this._limitedUntil = Date.now() + this._retryAfterMs
    this._status = 'limited'
    this.notify()

    // Auto-reset after the retry-after period
    this.timer = setTimeout(() => {
      this.clearRateLimit()
    }, this._retryAfterMs)

    return this._retryAfterMs
  }

  clearRateLimit(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this._status = 'ok'
    this._retryAfterMs = 0
    this._limitedUntil = 0
    this.notify()
  }

  /**
   * Returns true if we're currently rate limited.
   * If the time has expired, auto-clears and returns false.
   */
  checkAndClear(): boolean {
    if (this._status === 'limited' && Date.now() >= this._limitedUntil) {
      this.clearRateLimit()
      return false
    }
    return this._status === 'limited'
  }

  /**
   * Parse Retry-After header value.
   * Can be seconds (number) or HTTP-date string.
   * Returns seconds to wait.
   */
  parseRetryAfter(headerValue: string | null): number {
    if (!headerValue) return 5 // default 5 seconds

    const seconds = Number(headerValue)
    if (!Number.isNaN(seconds) && Number.isFinite(seconds)) {
      if (seconds >= 1) return Math.round(seconds)
      return 1 // minimum 1 second for fractional/zero values
    }

    // Try parsing as HTTP-date
    const parsed = Date.parse(headerValue)
    if (!Number.isNaN(parsed)) {
      return Math.max(1, Math.ceil((parsed - Date.now()) / 1000))
    }

    return 5 // fallback default
  }

  onStatusChange(listener: RateLimitListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this._status, this._retryAfterMs))
  }
}

export const rateLimitManager = new RateLimitManager()
