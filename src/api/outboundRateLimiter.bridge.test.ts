import { afterEach, describe, expect, it, vi } from 'vitest'
import { OutboundRateLimiter } from './outboundRateLimiter'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/**
 * Token buckets can only gate `fetch`. The WebSocket handshake is a separate
 * transport, so a server-directed backoff is bridged out via `onBlock` — that
 * is what allows `WebSocketClient.scheduleReconnect()` to stop reconnecting
 * into a server that just returned 429.
 */
describe('OutboundRateLimiter — non-fetch transport bridge', () => {
  it('reports a server backoff to the injected sink', () => {
    const onBlock = vi.fn()
    const limiter = new OutboundRateLimiter({ enabled: true, onBlock })

    limiter.blockFor(4000)

    expect(onBlock).toHaveBeenCalledTimes(1)
    expect(onBlock).toHaveBeenCalledWith(4000)
  })

  it('does not re-notify for a shorter, overlapping backoff', () => {
    vi.useFakeTimers()
    const onBlock = vi.fn()
    const limiter = new OutboundRateLimiter({ enabled: true, onBlock })

    limiter.blockFor(10_000)
    // A second 429 asking for less time must not shorten the active window, and
    // must not churn the WebSocket reconnect state either.
    limiter.blockFor(1000)

    expect(onBlock).toHaveBeenCalledTimes(1)
    expect(onBlock).toHaveBeenCalledWith(10_000)
  })

  it('extends the block and re-notifies when a longer backoff arrives', () => {
    vi.useFakeTimers()
    const onBlock = vi.fn()
    const limiter = new OutboundRateLimiter({ enabled: true, onBlock })

    limiter.blockFor(1000)
    limiter.blockFor(30_000)

    expect(onBlock).toHaveBeenCalledTimes(2)
    expect(onBlock).toHaveBeenLastCalledWith(30_000)
  })

  it('stays silent while disabled, so existing suites cannot mutate app singletons', () => {
    const onBlock = vi.fn()
    const limiter = new OutboundRateLimiter({ enabled: false, onBlock })

    limiter.blockFor(5000)

    expect(onBlock).not.toHaveBeenCalled()
    expect(limiter.getSnapshot().blocked).toBe(false)
  })
})
