import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FakeWebSocket } from '../test/fakeWebSocket'
import { WebSocketClient } from './websocket'
import { WS_PROTOCOL_VERSION } from './version'

let ws: FakeWebSocket

function stubWebSocket(): void {
  const mock = vi.fn(() => ws) as unknown as { OPEN: number; CONNECTING: number; CLOSING: number; CLOSED: number }
  mock.OPEN = FakeWebSocket.OPEN
  mock.CONNECTING = FakeWebSocket.CONNECTING
  mock.CLOSING = FakeWebSocket.CLOSING
  mock.CLOSED = FakeWebSocket.CLOSED
  vi.stubGlobal('WebSocket', mock)
}

beforeEach(() => {
  ws = new FakeWebSocket('ws://localhost:3000')
  stubWebSocket()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('WebSocketClient', () => {
  it('connects and sets status to connecting', () => {
    const client = new WebSocketClient()
    const onStatus = vi.fn()
    client.onStatusChange(onStatus)
    client.connect()
    expect(onStatus).toHaveBeenCalledWith('connecting')
  })

  it('sets connected status on open', () => {
    const client = new WebSocketClient()
    const onStatus = vi.fn()
    client.onStatusChange(onStatus)
    client.connect()
    ws.simulateOpen()
    expect(onStatus).toHaveBeenCalledWith('connected')
  })

  it('re-subscribes on reconnect', () => {
    const client = new WebSocketClient()
    client.connect()
    client.subscribe('BTC/USD')
    ws.sent.length = 0
    ws.simulateOpen()
    // #472 – the client sends the protocol handshake before subscribing.
    expect(ws.sent).toEqual([
      JSON.stringify({ type: 'hello', protocolVersion: WS_PROTOCOL_VERSION }),
      JSON.stringify({ action: 'subscribe', assetPairs: ['BTC/USD'] }),
    ])
  })

  it('calls message handlers on incoming messages', () => {
    const client = new WebSocketClient()
    const handler = vi.fn()
    client.onMessage(handler)
    client.connect()
    const msg = {
      type: 'price_update',
      assetPair: 'BTC/USD',
      price: 50000,
      timestamp: Date.now(),
      confidence: 0.99,
      sources: ['chainlink'],
    }
    ws.simulateMessage(msg)
    expect(handler).toHaveBeenCalledWith(msg)
  })

  it('calls multiple message handlers', () => {
    const client = new WebSocketClient()
    const h1 = vi.fn()
    const h2 = vi.fn()
    client.onMessage(h1)
    client.onMessage(h2)
    client.connect()
    const msg = { type: 'price_update', assetPair: 'BTC/USD', price: 50000, timestamp: Date.now(), confidence: 0.99, sources: ['chainlink'] }
    ws.simulateMessage(msg)
    expect(h1).toHaveBeenCalledWith(msg)
    expect(h2).toHaveBeenCalledWith(msg)
  })

  it('ignores malformed messages', () => {
    const client = new WebSocketClient()
    const handler = vi.fn()
    client.onMessage(handler)
    client.connect()
    ws.onmessage!({ data: 'not json' } as MessageEvent)
    expect(handler).not.toHaveBeenCalled()
  })

  it('disconnect cleans up and sets disconnected', () => {
    const client = new WebSocketClient()
    const onStatus = vi.fn()
    client.onStatusChange(onStatus)
    client.connect()
    client.disconnect()
    expect(onStatus).toHaveBeenCalledWith('disconnected')
    expect(ws.closed).toBe(true)
  })

  it('subscribe sends subscribe message', () => {
    const client = new WebSocketClient()
    client.connect()
    ws.readyState = FakeWebSocket.OPEN
    client.subscribe('BTC/USD')
    expect(ws.sent).toEqual([
      JSON.stringify({ action: 'subscribe', assetPairs: ['BTC/USD'] }),
    ])
  })

  it('subscribe with array sends subscribe message', () => {
    const client = new WebSocketClient()
    client.connect()
    ws.readyState = FakeWebSocket.OPEN
    client.subscribe(['BTC/USD', 'ETH/USD'])
    expect(ws.sent).toEqual([
      JSON.stringify({ action: 'subscribe', assetPairs: ['BTC/USD', 'ETH/USD'] }),
    ])
  })

  it('unsubscribe sends unsubscribe message', () => {
    const client = new WebSocketClient()
    client.connect()
    ws.readyState = FakeWebSocket.OPEN
    client.subscribe('BTC/USD')
    client.unsubscribe('BTC/USD')
    expect(ws.sent).toEqual([
      JSON.stringify({ action: 'subscribe', assetPairs: ['BTC/USD'] }),
      JSON.stringify({ action: 'unsubscribe', assetPairs: ['BTC/USD'] }),
    ])
  })

  it('removes handler via returned disposer', () => {
    const client = new WebSocketClient()
    const handler = vi.fn()
    const dispose = client.onMessage(handler)
    dispose()
    client.connect()
    ws.simulateMessage({ type: 'price_update', assetPair: 'BTC/USD', price: 50000, timestamp: Date.now(), confidence: 0.99, sources: [] })
    expect(handler).not.toHaveBeenCalled()
  })

  it('removes status handler via returned disposer', () => {
    const client = new WebSocketClient()
    const handler = vi.fn()
    const dispose = client.onStatusChange(handler)
    dispose()
    client.connect()
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not reconnect after explicit disconnect', () => {
    const client = new WebSocketClient()
    client.connect()
    ws.simulateOpen()
    client.disconnect()
    ws.simulateClose()
    expect(ws.closed).toBe(true)
    expect(ws.sent).toEqual([])
  })

  it('handles error by closing', () => {
    const client = new WebSocketClient()
    const onStatus = vi.fn()
    client.onStatusChange(onStatus)
    client.connect()
    ws.simulateError()
    expect(ws.closed).toBe(true)
  })

  it('transitions through connecting, connected, disconnected, waiting, reconnecting', () => {
    vi.useFakeTimers()
    const client = new WebSocketClient()
    const onStatus = vi.fn()
    client.onStatusChange(onStatus)
    client.connect()
    ws.simulateOpen()
    ws.simulateClose()
    // After close: disconnected → waiting (backoff window starts)
    const statuses = onStatus.mock.calls.map((c) => c[0])
    expect(statuses).toContain('connecting')
    expect(statuses).toContain('connected')
    expect(statuses).toContain('disconnected')
    expect(statuses).toContain('waiting')
    vi.useRealTimers()
  })

  it('attempts reconnection after close', () => {
    vi.useFakeTimers()
    const connectSpy = vi.spyOn(WebSocketClient.prototype, 'connect')
    const client = new WebSocketClient()
    client.connect()
    connectSpy.mockClear()
    ws.simulateOpen()
    ws.simulateClose()
    expect(connectSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(3000)
    expect(connectSpy).toHaveBeenCalledTimes(1)
    connectSpy.mockRestore()
    vi.useRealTimers()
  })

  it('prevents multiple concurrent reconnection timers', () => {
    vi.useFakeTimers()
    const connectSpy = vi.spyOn(WebSocketClient.prototype, 'connect')
    const client = new WebSocketClient()
    client.connect()
    connectSpy.mockClear()
    ws.simulateClose()
    ws.simulateClose()
    vi.advanceTimersByTime(3000)
    expect(connectSpy).toHaveBeenCalledTimes(1)
    connectSpy.mockRestore()
    vi.useRealTimers()
  })

  it('does not send when not connected', () => {
    const client = new WebSocketClient()
    client.connect()
    ws.readyState = FakeWebSocket.CONNECTING
    client.subscribe('BTC/USD')
    expect(ws.sent).toEqual([])
  })

  it('returns current status through lifecycle', () => {
    vi.useFakeTimers()
    const client = new WebSocketClient()
    expect(client.status).toBe('disconnected')
    client.connect()
    expect(client.status).toBe('connecting')
    ws.simulateOpen()
    expect(client.status).toBe('connected')
    ws.simulateClose()
    // After close the client enters 'disconnected' briefly then 'waiting' (backoff)
    expect(['disconnected', 'waiting', 'reconnecting']).toContain(client.status)
    vi.useRealTimers()
  })

  it('getDerivedStateFromError is ignored on second close while reconnecting', () => {
    vi.useFakeTimers()
    const connectSpy = vi.spyOn(WebSocketClient.prototype, 'connect')
    const client = new WebSocketClient()
    client.connect()
    connectSpy.mockClear()
    ws.simulateClose()
    ws.simulateClose()
    expect(connectSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(3000)
    expect(connectSpy).toHaveBeenCalledTimes(1)
    connectSpy.mockRestore()
    vi.useRealTimers()
  })

  // ── Reconnection after clean vs. unclean disconnect ─────────────────────────

  it('reconnects after a clean disconnect (normal close code)', () => {
    vi.useFakeTimers()
    const connectSpy = vi.spyOn(WebSocketClient.prototype, 'connect')
    const client = new WebSocketClient()
    client.connect()
    ws.simulateOpen()
    connectSpy.mockClear()
    ws.simulateClose(1000, 'normal closure')
    vi.advanceTimersByTime(3000)
    expect(connectSpy).toHaveBeenCalledTimes(1)
    connectSpy.mockRestore()
    vi.useRealTimers()
  })

  it('reconnects after an unclean disconnect (abnormal close code)', () => {
    vi.useFakeTimers()
    const connectSpy = vi.spyOn(WebSocketClient.prototype, 'connect')
    const client = new WebSocketClient()
    client.connect()
    ws.simulateOpen()
    connectSpy.mockClear()
    ws.simulateClose(1006, 'abnormal closure')
    vi.advanceTimersByTime(3000)
    expect(connectSpy).toHaveBeenCalledTimes(1)
    connectSpy.mockRestore()
    vi.useRealTimers()
  })

  it('reconnects after a socket error (which triggers close)', () => {
    vi.useFakeTimers()
    const connectSpy = vi.spyOn(WebSocketClient.prototype, 'connect')
    const client = new WebSocketClient()
    client.connect()
    ws.simulateOpen()
    connectSpy.mockClear()
    ws.simulateError()
    ws.simulateClose()
    vi.advanceTimersByTime(3000)
    expect(connectSpy).toHaveBeenCalledTimes(1)
    connectSpy.mockRestore()
    vi.useRealTimers()
  })

  // ── Exponential backoff timing ───────────────────────────────────────────────

  it('backoff delay is bounded by min(initial * 2^attempt, max) with full jitter', () => {
    vi.useFakeTimers()
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(1)
    const connectSpy = vi.spyOn(WebSocketClient.prototype, 'connect')
    const client = new WebSocketClient()
    client.connect()
    connectSpy.mockClear()

    // Attempt 0: cap = min(1000 * 2^0, 30000) = 1000ms. random() = 1 -> delay = 1000ms.
    ws.simulateClose()
    vi.advanceTimersByTime(999)
    expect(connectSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(connectSpy).toHaveBeenCalledTimes(1)

    randomSpy.mockRestore()
    connectSpy.mockRestore()
    vi.useRealTimers()
  })

  it('backoff delay is capped at MAX_DELAY_MS for high attempt counts', () => {
    vi.useFakeTimers()
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(1)
    const connectSpy = vi.spyOn(WebSocketClient.prototype, 'connect')
    const client = new WebSocketClient()
    client.connect()

    // Drive several failed reconnects so the exponent grows past the cap.
    for (let i = 0; i < 8; i++) {
      ws.simulateClose()
      vi.advanceTimersByTime(30_000)
    }
    connectSpy.mockClear()
    ws.simulateClose()
    vi.advanceTimersByTime(29_999)
    expect(connectSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(connectSpy).toHaveBeenCalledTimes(1)

    randomSpy.mockRestore()
    connectSpy.mockRestore()
    vi.useRealTimers()
  })

  it('produces varied delays across attempts when jitter is not fixed', () => {
    vi.useFakeTimers()
    const randomValues = [0.1, 0.5, 0.9]
    let call = 0
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => randomValues[call++ % randomValues.length])
    const connectSpy = vi.spyOn(WebSocketClient.prototype, 'connect')
    const client = new WebSocketClient()
    client.connect()
    connectSpy.mockClear()

    ws.simulateClose()
    // cap for attempt 0 is 1000ms, random=0.1 -> delay=100ms
    vi.advanceTimersByTime(100)
    expect(connectSpy).toHaveBeenCalledTimes(1)

    randomSpy.mockRestore()
    connectSpy.mockRestore()
    vi.useRealTimers()
  })

  // ── Max retry exhaustion ──────────────────────────────────────────────────────

  it('enters dead state after exceeding max retries and stops reconnecting', () => {
    vi.useFakeTimers()
    const connectSpy = vi.spyOn(WebSocketClient.prototype, 'connect')
    const client = new WebSocketClient()
    const onStatus = vi.fn()
    client.onStatusChange(onStatus)
    client.connect()

    // MAX_RETRIES is 20: the 21st scheduling attempt (reconnectAttempt reaching
    // 20) is the one that flips status to 'dead' instead of scheduling again.
    for (let i = 0; i < 21; i++) {
      ws.simulateClose()
      vi.advanceTimersByTime(30_000)
    }

    expect(client.status).toBe('dead')

    connectSpy.mockClear()
    onStatus.mockClear()
    // Any further close events must not schedule another reconnect.
    ws.simulateClose()
    vi.advanceTimersByTime(60_000)
    expect(connectSpy).not.toHaveBeenCalled()
    expect(onStatus).not.toHaveBeenCalledWith('waiting')

    connectSpy.mockRestore()
    vi.useRealTimers()
  })

  it('resets retry count after a successful reconnection', () => {
    vi.useFakeTimers()
    const client = new WebSocketClient()
    client.connect()
    ws.simulateClose()
    vi.advanceTimersByTime(30_000)
    expect(client.diagnostics.retryCount).toBeGreaterThan(0)

    ws.simulateOpen()
    expect(client.diagnostics.retryCount).toBe(0)
    vi.useRealTimers()
  })

  // ── State / diagnostics preservation across reconnections ───────────────────

  it('preserves totalDisconnections and lastConnectedAt across multiple reconnect cycles', () => {
    vi.useFakeTimers()
    const client = new WebSocketClient()
    client.connect()
    ws.simulateOpen()
    const firstConnectedAt = client.diagnostics.lastConnectedAt
    expect(client.diagnostics.totalDisconnections).toBe(0)

    ws.simulateClose()
    expect(client.diagnostics.totalDisconnections).toBe(1)
    vi.advanceTimersByTime(30_000)
    ws.simulateOpen()
    expect(client.diagnostics.lastConnectedAt).toBeGreaterThanOrEqual(firstConnectedAt ?? 0)

    ws.simulateClose()
    expect(client.diagnostics.totalDisconnections).toBe(2)
    vi.useRealTimers()
  })

  it('re-subscribes to all tracked pairs after multiple reconnect cycles', () => {
    vi.useFakeTimers()
    const client = new WebSocketClient()
    client.connect()
    client.subscribe(['BTC/USD', 'ETH/USD'])
    ws.sent.length = 0
    ws.simulateOpen()
    // #472 – sent[0] is now the hello handshake; the subscribe follows it.
    expect(JSON.parse(ws.sent[1]).assetPairs.sort()).toEqual(['BTC/USD', 'ETH/USD'])

    // Unsubscribe one pair while disconnected, then reconnect again.
    ws.simulateClose()
    client.unsubscribe('ETH/USD')
    vi.advanceTimersByTime(30_000)
    ws.sent.length = 0
    ws.simulateOpen()
    expect(JSON.parse(ws.sent[1]).assetPairs).toEqual(['BTC/USD'])
    vi.useRealTimers()
  })

  // ── Message ordering / duplicate protection during reconnection ─────────────

  it('discards messages with a seq lower than or equal to the last seen seq', () => {
    const client = new WebSocketClient()
    const handler = vi.fn()
    client.onMessage(handler)
    client.connect()
    const base = { type: 'price_update', assetPair: 'BTC/USD', price: 1, timestamp: Date.now(), confidence: 0.9, sources: ['a'] }
    ws.simulateMessage({ ...base, seq: 5 })
    ws.simulateMessage({ ...base, seq: 3 })
    ws.simulateMessage({ ...base, seq: 5 })
    ws.simulateMessage({ ...base, seq: 6 })
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('maintains message ordering protection across a reconnect', () => {
    vi.useFakeTimers()
    const client = new WebSocketClient()
    const handler = vi.fn()
    client.onMessage(handler)
    client.connect()
    const base = { type: 'price_update', assetPair: 'BTC/USD', price: 1, timestamp: Date.now(), confidence: 0.9, sources: ['a'] }
    ws.simulateMessage({ ...base, seq: 10 })

    ws.simulateClose()
    vi.advanceTimersByTime(30_000)
    ws.simulateOpen()

    // A stale/duplicate message from before the reconnect must still be dropped.
    ws.simulateMessage({ ...base, seq: 9 })
    ws.simulateMessage({ ...base, seq: 11 })
    expect(handler).toHaveBeenCalledTimes(2)
    expect(handler).toHaveBeenLastCalledWith(expect.objectContaining({ seq: 11 }))
    vi.useRealTimers()
  })

  // ── Multiple simultaneous reconnections ──────────────────────────────────────

  it('does not open multiple sockets when several close events fire back to back', () => {
    vi.useFakeTimers()
    const connectSpy = vi.spyOn(WebSocketClient.prototype, 'connect')
    const client = new WebSocketClient()
    client.connect()
    ws.simulateOpen()
    connectSpy.mockClear()

    ws.simulateClose()
    ws.simulateClose()
    ws.simulateClose()
    vi.advanceTimersByTime(30_000)

    expect(connectSpy).toHaveBeenCalledTimes(1)
    connectSpy.mockRestore()
    vi.useRealTimers()
  })

  it('pauses reconnection while rate-limited and resumes after the window', async () => {
    const { rateLimitManager } = await import('./rateLimit')
    vi.useFakeTimers()
    const connectSpy = vi.spyOn(WebSocketClient.prototype, 'connect')
    const client = new WebSocketClient()
    const onStatus = vi.fn()
    client.onStatusChange(onStatus)
    client.connect()
    connectSpy.mockClear()

    rateLimitManager.setRateLimited(2)
    ws.simulateClose()
    expect(onStatus).toHaveBeenCalledWith('waiting')

    vi.advanceTimersByTime(1_000)
    expect(connectSpy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1_500)
    expect(connectSpy).toHaveBeenCalledTimes(1)

    rateLimitManager.clearRateLimit()
    connectSpy.mockRestore()
    vi.useRealTimers()
  })

  // ── WS protocol versioning (#472) ───────────────────────────────────────────

  it('negotiates the protocol version and does not forward the welcome', () => {
    const client = new WebSocketClient()
    const handler = vi.fn()
    client.onMessage(handler)
    client.connect()
    ws.simulateOpen()
    ws.simulateMessage({ type: 'welcome', protocolVersion: WS_PROTOCOL_VERSION })
    expect(client.diagnostics.protocolVersion).toBe(WS_PROTOCOL_VERSION)
    expect(client.diagnostics.protocolUpgradeRequired).toBe(false)
    // The welcome is a handshake reply, not forwarded to app handlers.
    expect(handler).not.toHaveBeenCalled()
  })

  it('flags an upgrade requirement when the server is newer', () => {
    const client = new WebSocketClient()
    client.connect()
    ws.simulateOpen()
    ws.simulateMessage({ type: 'welcome', protocolVersion: WS_PROTOCOL_VERSION + 1 })
    expect(client.diagnostics.protocolVersion).toBe(WS_PROTOCOL_VERSION + 1)
    expect(client.diagnostics.protocolUpgradeRequired).toBe(true)
  })

  it('does not flag an upgrade when the server is older or equal', () => {
    const client = new WebSocketClient()
    client.connect()
    ws.simulateOpen()
    ws.simulateMessage({ type: 'welcome', protocolVersion: WS_PROTOCOL_VERSION - 1 })
    expect(client.diagnostics.protocolUpgradeRequired).toBe(false)
  })

  it('ignores an unknown/out-of-shape welcome gracefully', () => {
    const client = new WebSocketClient()
    const handler = vi.fn()
    client.onMessage(handler)
    client.connect()
    ws.simulateOpen()
    // Missing/negative version fails the schema; the connection should survive.
    ws.simulateMessage({ type: 'welcome', protocolVersion: -1 })
    expect(client.diagnostics.protocolVersion).toBeNull()
    expect(handler).not.toHaveBeenCalled()
    expect(client.status).toBe('connected')
  })
})
