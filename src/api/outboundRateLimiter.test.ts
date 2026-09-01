import { afterEach, describe, expect, it, vi } from 'vitest'
import { OutboundRateLimiter, resolveEndpointGroup } from './outboundRateLimiter'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** One token per second, burst of two — small numbers keep the timings exact. */
function makeLimiter() {
  return new OutboundRateLimiter({
    enabled: true,
    limits: {
      prices: { capacity: 2, refillPerSecond: 1 },
      history: { capacity: 1, refillPerSecond: 1 },
    },
  })
}

describe('resolveEndpointGroup', () => {
  it('maps each endpoint to its group, preferring the more specific match', () => {
    expect(resolveEndpointGroup('/api/prices')).toBe('prices')
    expect(resolveEndpointGroup('/api/prices/BTC%2FUSD')).toBe('prices')
    expect(resolveEndpointGroup('/health')).toBe('health')
    expect(resolveEndpointGroup('/api/something-else')).toBe('default')
  })

  it('classifies batch history as history, not prices', () => {
    // The path contains both "/prices" and "/history" — history must win, or the
    // heavier endpoint would be charged to the high-volume price budget.
    expect(resolveEndpointGroup('/api/prices/history/batch')).toBe('history')
    expect(resolveEndpointGroup('/api/prices/BTC%2FUSD/history?limit=100')).toBe('history')
  })
})

describe('OutboundRateLimiter — per-group budgets', () => {
  it('lets a burst through up to capacity, then queues', async () => {
    vi.useFakeTimers()
    const limiter = makeLimiter()

    await limiter.wait('/api/prices')
    await limiter.wait('/api/prices')

    let released = false
    const queued = limiter.wait('/api/prices').then(() => {
      released = true
    })

    expect(limiter.getSnapshot().queued).toBe(1)
    await vi.advanceTimersByTimeAsync(999)
    expect(released).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await queued
    expect(released).toBe(true)
    expect(limiter.getSnapshot().queued).toBe(0)
  })

  it('meters groups independently, so history cannot starve prices', async () => {
    vi.useFakeTimers()
    const limiter = makeLimiter()

    // Exhaust history entirely.
    await limiter.wait('/api/prices/history/batch')
    const queuedHistory = limiter.wait('/api/prices/history/batch')
    expect(limiter.getSnapshot().queuedByGroup.history).toBe(1)

    // Prices still has its own budget and must not be blocked by history.
    await expect(limiter.wait('/api/prices')).resolves.toBeUndefined()
    expect(limiter.getSnapshot().queuedByGroup.prices).toBe(0)

    await vi.advanceTimersByTimeAsync(1000)
    await queuedHistory
  })

  it('releases queued requests in FIFO order', async () => {
    vi.useFakeTimers()
    const limiter = makeLimiter()
    await limiter.wait('/api/prices')
    await limiter.wait('/api/prices')

    const order: number[] = []
    const first = limiter.wait('/api/prices').then(() => void order.push(1))
    const second = limiter.wait('/api/prices').then(() => void order.push(2))
    const third = limiter.wait('/api/prices').then(() => void order.push(3))

    await vi.advanceTimersByTimeAsync(3000)
    await Promise.all([first, second, third])

    expect(order).toEqual([1, 2, 3])
  })
})

describe('OutboundRateLimiter — cancellation', () => {
  it('rejects an already-aborted signal without consuming a token', async () => {
    const limiter = makeLimiter()
    const controller = new AbortController()
    controller.abort()

    await expect(limiter.wait('/api/prices', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(limiter.getSnapshot().queued).toBe(0)
  })

  it('drops an aborted waiter so its token goes to the next in line', async () => {
    vi.useFakeTimers()
    const limiter = makeLimiter()
    await limiter.wait('/api/prices')
    await limiter.wait('/api/prices')

    const controller = new AbortController()
    const abandoned = limiter.wait('/api/prices', controller.signal)
    let survivorReleased = false
    const survivor = limiter.wait('/api/prices').then(() => {
      survivorReleased = true
    })

    expect(limiter.getSnapshot().queued).toBe(2)
    controller.abort()
    await expect(abandoned).rejects.toMatchObject({ name: 'AbortError' })
    expect(limiter.getSnapshot().queued).toBe(1)

    // The survivor gets the very next token rather than waiting behind a
    // cancelled request.
    await vi.advanceTimersByTimeAsync(1000)
    await survivor
    expect(survivorReleased).toBe(true)
  })
})

describe('OutboundRateLimiter — server-directed backoff', () => {
  it('holds every group for the Retry-After window', async () => {
    vi.useFakeTimers()
    const limiter = makeLimiter()

    limiter.blockFor(2000)
    expect(limiter.getSnapshot().blocked).toBe(true)

    let released = false
    // Capacity is available, but the server block must still take precedence.
    const queued = limiter.wait('/api/prices').then(() => {
      released = true
    })

    await vi.advanceTimersByTimeAsync(1999)
    expect(released).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await queued
    expect(released).toBe(true)
  })

  it('keeps the longest block when several arrive', () => {
    vi.useFakeTimers()
    const limiter = makeLimiter()

    limiter.blockFor(5000)
    const long = limiter.getSnapshot().blockedUntil
    limiter.blockFor(1000)

    expect(limiter.getSnapshot().blockedUntil).toBe(long)
  })
})

describe('OutboundRateLimiter — observable state', () => {
  it('notifies subscribers as work is queued and drained', async () => {
    vi.useFakeTimers()
    const limiter = makeLimiter()
    const seen: number[] = []
    const unsubscribe = limiter.subscribe(() => seen.push(limiter.getSnapshot().queued))

    await limiter.wait('/api/prices')
    await limiter.wait('/api/prices')
    const queued = limiter.wait('/api/prices')

    expect(seen).toContain(1)
    await vi.advanceTimersByTimeAsync(1000)
    await queued
    expect(seen[seen.length - 1]).toBe(0)

    unsubscribe()
  })

  it('returns a stable snapshot reference when nothing changed', async () => {
    const limiter = makeLimiter()
    const before = limiter.getSnapshot()
    await limiter.wait('/api/prices')
    // A request that never queued leaves the observable state untouched, so the
    // reference must be identical — useSyncExternalStore would loop otherwise.
    expect(limiter.getSnapshot()).toBe(before)
  })

  it('is inert when disabled', async () => {
    const limiter = new OutboundRateLimiter({
      enabled: false,
      limits: { prices: { capacity: 1, refillPerSecond: 1 } },
    })

    await limiter.wait('/api/prices')
    await limiter.wait('/api/prices')
    await limiter.wait('/api/prices')

    expect(limiter.getSnapshot().queued).toBe(0)
  })
})
