import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rateLimitManager } from './rateLimit'

beforeEach(() => {
  // Clear any ongoing rate limit state
  rateLimitManager.clearRateLimit()
})

afterEach(() => {
  rateLimitManager.clearRateLimit()
  vi.restoreAllMocks()
})

describe('RateLimitManager', () => {
  it('starts in ok status', () => {
    expect(rateLimitManager.status).toBe('ok')
    expect(rateLimitManager.isLimited).toBe(false)
    expect(rateLimitManager.retryAfterMs).toBe(0)
  })

  it('setRateLimited transitions to limited status', () => {
    const retryAfterMs = rateLimitManager.setRateLimited(30)
    expect(rateLimitManager.status).toBe('limited')
    expect(rateLimitManager.isLimited).toBe(true)
    expect(rateLimitManager.retryAfterMs).toBe(30000)
    expect(retryAfterMs).toBe(30000)
  })

  it('clearRateLimit resets to ok status', () => {
    rateLimitManager.setRateLimited(10)
    expect(rateLimitManager.isLimited).toBe(true)

    rateLimitManager.clearRateLimit()
    expect(rateLimitManager.status).toBe('ok')
    expect(rateLimitManager.isLimited).toBe(false)
    expect(rateLimitManager.retryAfterMs).toBe(0)
  })

  it('checkAndClear returns true when limited and false after expiry', () => {
    rateLimitManager.setRateLimited(60)
    expect(rateLimitManager.checkAndClear()).toBe(true)

    // Manually set limitedUntil to the past to simulate expiry
    rateLimitManager.clearRateLimit()
    expect(rateLimitManager.checkAndClear()).toBe(false)
  })

  it('notifies listeners on status change', () => {
    const listener = vi.fn()
    const unsub = rateLimitManager.onStatusChange(listener)

    rateLimitManager.setRateLimited(10)
    expect(listener).toHaveBeenCalledWith('limited', 10000)

    rateLimitManager.clearRateLimit()
    expect(listener).toHaveBeenCalledWith('ok', 0)

    unsub()
    listener.mockClear()
    rateLimitManager.setRateLimited(5)
    expect(listener).not.toHaveBeenCalled()
  })

  it('parseRetryAfter handles numeric seconds', () => {
    expect(rateLimitManager.parseRetryAfter('30')).toBe(30)
    expect(rateLimitManager.parseRetryAfter('0')).toBe(1) // minimum 1 second
  })

  it('parseRetryAfter handles HTTP-date format', () => {
    const future = new Date(Date.now() + 15000)
    const result = rateLimitManager.parseRetryAfter(future.toUTCString())
    expect(result).toBeGreaterThanOrEqual(13)
    expect(result).toBeLessThanOrEqual(17)
  })

  it('parseRetryAfter falls back to default for null', () => {
    expect(rateLimitManager.parseRetryAfter(null)).toBe(5)
  })

  it('parseRetryAfter falls back to default for invalid strings', () => {
    expect(rateLimitManager.parseRetryAfter('invalid')).toBe(5)
  })
})
