/**
 * Chaos tests (#474): network degradation, dropped frames, and partial
 * messages against the real {@link WebSocketClient}, driven through the
 * chaos-testing extensions on {@link FakeWebSocket} (partial/raw frames,
 * out-of-order delivery, silent drops — see `test/fakeWebSocket.ts`).
 *
 * The throughline for every test here: bad input must never throw, must
 * never corrupt already-delivered state, and a connection must keep working
 * normally for the next good message after absorbing garbage.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FakeWebSocket } from '../test/fakeWebSocket'
import { WebSocketClient } from './websocket'

let ws: FakeWebSocket

function stubWebSocket(): void {
  // See websocket.test.ts for why this must be a regular `function`, not an
  // arrow function, to work with `new WebSocket(url)`.
  const mock = vi.fn(function () {
    return ws
  }) as unknown as { OPEN: number; CONNECTING: number; CLOSING: number; CLOSED: number }
  mock.OPEN = FakeWebSocket.OPEN
  mock.CONNECTING = FakeWebSocket.CONNECTING
  mock.CLOSING = FakeWebSocket.CLOSING
  mock.CLOSED = FakeWebSocket.CLOSED
  vi.stubGlobal('WebSocket', mock)
}

function priceUpdate(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    type: 'price_update',
    assetPair: 'BTC/USD',
    price: 50_000,
    timestamp: Date.now(),
    confidence: 0.95,
    sources: ['chainlink'],
    ...overrides,
  }
}

beforeEach(() => {
  ws = new FakeWebSocket('ws://localhost:3000')
  stubWebSocket()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('WebSocketClient chaos: malformed / partial frames', () => {
  it('survives a truncated JSON frame without throwing and without forwarding it', () => {
    const client = new WebSocketClient()
    const handler = vi.fn()
    client.onMessage(handler)
    client.connect()

    expect(() => ws.simulateRawMessage('{"type":"price_upd')).not.toThrow()
    expect(handler).not.toHaveBeenCalled()
  })

  it('survives non-JSON garbage without throwing', () => {
    const client = new WebSocketClient()
    const handler = vi.fn()
    client.onMessage(handler)
    client.connect()

    expect(() => ws.simulateRawMessage('<html>not a websocket frame</html>')).not.toThrow()
    expect(handler).not.toHaveBeenCalled()
  })

  it('rejects a schema-invalid payload (wrong field types) without throwing', () => {
    const client = new WebSocketClient()
    const handler = vi.fn()
    client.onMessage(handler)
    client.connect()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(() =>
      ws.simulateMessage({ type: 'price_update', assetPair: 'BTC/USD', price: 'not-a-number' }),
    ).not.toThrow()

    expect(handler).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('rejects a payload missing required fields without throwing', () => {
    const client = new WebSocketClient()
    const handler = vi.fn()
    client.onMessage(handler)
    client.connect()
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(() => ws.simulateMessage({ type: 'price_update' })).not.toThrow()
    expect(handler).not.toHaveBeenCalled()
  })

  it('keeps working normally after a burst of malformed frames — the next good message still arrives', () => {
    const client = new WebSocketClient()
    const handler = vi.fn()
    client.onMessage(handler)
    client.connect()
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    ws.simulateRawMessage('{broken')
    ws.simulateRawMessage('also not json')
    ws.simulateMessage({ type: 'price_update', price: {} })
    expect(handler).not.toHaveBeenCalled()

    const good = priceUpdate({ price: 51_000 })
    ws.simulateMessage(good)

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ price: 51_000 }))
  })

  it('a malformed frame mid-stream does not corrupt state for messages around it', () => {
    const client = new WebSocketClient()
    const handler = vi.fn()
    client.onMessage(handler)
    client.connect()
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    ws.simulateMessage(priceUpdate({ assetPair: 'BTC/USD', price: 1 }))
    ws.simulateRawMessage('{garbage')
    ws.simulateMessage(priceUpdate({ assetPair: 'ETH/USD', price: 2 }))

    expect(handler).toHaveBeenCalledTimes(2)
    const pairs = handler.mock.calls.map((call) => (call[0] as { assetPair: string }).assetPair)
    expect(pairs).toEqual(['BTC/USD', 'ETH/USD'])
  })
})

describe('WebSocketClient chaos: out-of-order and duplicate frames', () => {
  it('discards a message whose seq is not greater than the last seen seq', () => {
    const client = new WebSocketClient()
    const handler = vi.fn()
    client.onMessage(handler)
    client.connect()

    ws.simulateOutOfOrder([
      priceUpdate({ price: 100, seq: 5 }),
      priceUpdate({ price: 999, seq: 3 }), // stale — arrived out of order
      priceUpdate({ price: 999, seq: 5 }), // exact duplicate
    ])

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ price: 100, seq: 5 }))
  })

  it('accepts a strictly increasing seq after discarding a stale one', () => {
    const client = new WebSocketClient()
    const handler = vi.fn()
    client.onMessage(handler)
    client.connect()

    ws.simulateOutOfOrder([
      priceUpdate({ price: 1, seq: 10 }),
      priceUpdate({ price: 2, seq: 4 }), // stale, discarded
      priceUpdate({ price: 3, seq: 11 }), // still valid — greater than last seen (10)
    ])

    expect(handler).toHaveBeenCalledTimes(2)
    const prices = handler.mock.calls.map((call) => (call[0] as { price: number }).price)
    expect(prices).toEqual([1, 3])
  })

  it('messages without a seq are never discarded by the dedup check', () => {
    const client = new WebSocketClient()
    const handler = vi.fn()
    client.onMessage(handler)
    client.connect()

    ws.simulateOutOfOrder([priceUpdate({ price: 1 }), priceUpdate({ price: 2 }), priceUpdate({ price: 3 })])

    expect(handler).toHaveBeenCalledTimes(3)
  })
})

describe('WebSocketClient chaos: silent drops', () => {
  it('a message that never arrives simply never reaches handlers — no error, no hang', () => {
    const client = new WebSocketClient()
    const handler = vi.fn()
    client.onMessage(handler)
    client.connect()

    // Messages 2 and 4 are silently dropped — as a lossy connection would.
    ws.simulateWithDrops(
      [priceUpdate({ price: 1 }), priceUpdate({ price: 2 }), priceUpdate({ price: 3 }), priceUpdate({ price: 4 })],
      [1, 3],
    )

    expect(handler).toHaveBeenCalledTimes(2)
    const prices = handler.mock.calls.map((call) => (call[0] as { price: number }).price)
    expect(prices).toEqual([1, 3])
  })

  it('recovers cleanly once traffic resumes after a drop', () => {
    const client = new WebSocketClient()
    const handler = vi.fn()
    client.onMessage(handler)
    client.connect()

    ws.simulateWithDrops([priceUpdate({ price: 1 }), priceUpdate({ price: 2 })], [1])
    expect(handler).toHaveBeenCalledTimes(1)

    ws.simulateMessage(priceUpdate({ price: 3 }))
    expect(handler).toHaveBeenCalledTimes(2)
    expect(handler).toHaveBeenLastCalledWith(expect.objectContaining({ price: 3 }))
  })
})

describe('WebSocketClient chaos: connection status stays consistent through bad data', () => {
  it('malformed frames do not change connection status or trigger a reconnect', () => {
    const client = new WebSocketClient()
    const onStatus = vi.fn()
    client.onStatusChange(onStatus)
    client.connect()
    ws.simulateOpen()
    onStatus.mockClear()
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    ws.simulateRawMessage('{bad')
    ws.simulateMessage({ type: 'price_update', price: 'nope' })

    expect(onStatus).not.toHaveBeenCalled()
    expect(client.status).toBe('connected')
  })
})

describe('WebSocketClient chaos: slow network / outbound backpressure', () => {
  it('queues an outbound message instead of writing to a closed/connecting socket', () => {
    const client = new WebSocketClient()
    client.connect() // socket exists but is still CONNECTING
    client.subscribe('BTC/USD')

    // Nothing hit the wire yet — the subscribe call was buffered, not lost
    // and not thrown at a socket that can't accept it.
    expect(ws.sent).toEqual([])
  })

  it('coalesces a burst of offline actions into a single correct sync on open, not N replayed messages', () => {
    const client = new WebSocketClient()
    client.connect()

    // A "slow network" burst: 50 subscribe calls land while still connecting.
    const pairs = Array.from({ length: 50 }, (_, i) => `PAIR${i}/USD`)
    expect(() => pairs.forEach((p) => client.subscribe(p))).not.toThrow()
    expect(ws.sent).toEqual([])

    ws.simulateOpen()

    // One handshake + exactly one subscribe message covering every pair —
    // backpressure here means coalescing, not a queue of 50 raw sends.
    expect(ws.sent).toHaveLength(2)
    const subscribeMsg = JSON.parse(ws.sent[1]) as { action: string; assetPairs: string[] }
    expect(subscribeMsg.action).toBe('subscribe')
    expect(new Set(subscribeMsg.assetPairs)).toEqual(new Set(pairs))
  })

  it('delivers the correct queued state once a slow (delayed) connection finally opens', () => {
    vi.useFakeTimers()
    ws = new FakeWebSocket('ws://localhost:3000', { openDelay: 5_000 })
    stubWebSocket()

    const client = new WebSocketClient()
    client.connect()
    client.subscribe(['BTC/USD', 'ETH/USD'])
    client.unsubscribe('ETH/USD')

    expect(ws.sent).toEqual([])

    vi.advanceTimersByTime(5_000) // slow network: 5s before the socket actually opens

    expect(ws.sent).toHaveLength(2)
    const subscribeMsg = JSON.parse(ws.sent[1]) as { assetPairs: string[] }
    expect(subscribeMsg.assetPairs).toEqual(['BTC/USD'])

    vi.useRealTimers()
  })

  it('sends immediately, bypassing the queue, once the socket is already open', () => {
    const client = new WebSocketClient()
    client.connect()
    ws.simulateOpen()
    ws.sent.length = 0

    client.subscribe('BTC/USD')

    expect(ws.sent).toEqual([JSON.stringify({ action: 'subscribe', assetPairs: ['BTC/USD'] })])
  })

  it('a slow network with high message latency still delivers frames in order once they arrive', () => {
    vi.useFakeTimers()
    ws = new FakeWebSocket('ws://localhost:3000', { messageLatency: 3_000 })
    stubWebSocket()

    const client = new WebSocketClient()
    const handler = vi.fn()
    client.onMessage(handler)
    client.connect()
    ws.simulateOpen()

    ws.simulateMessage(priceUpdate({ price: 1, seq: 1 }))
    ws.simulateMessage(priceUpdate({ price: 2, seq: 2 }))
    expect(handler).not.toHaveBeenCalled() // still in flight on a slow link

    vi.advanceTimersByTime(3_000)

    expect(handler).toHaveBeenCalledTimes(2)
    const prices = handler.mock.calls.map((call) => (call[0] as { price: number }).price)
    expect(prices).toEqual([1, 2])

    vi.useRealTimers()
  })
})
