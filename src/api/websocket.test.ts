import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebSocketClient } from './websocket'
import { FakeWebSocket } from '../test/fakeWebSocket'

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
    expect(ws.sent).toEqual([
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

  it('transitions through connecting, connected, disconnected, reconnecting', () => {
    const client = new WebSocketClient()
    const onStatus = vi.fn()
    client.onStatusChange(onStatus)
    client.connect()
    ws.simulateOpen()
    ws.simulateClose()
    expect(onStatus.mock.calls.map((c) => c[0])).toEqual([
      'connecting',
      'connected',
      'disconnected',
      'reconnecting',
    ])
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
    const client = new WebSocketClient()
    expect(client.status).toBe('disconnected')
    client.connect()
    expect(client.status).toBe('connecting')
    ws.simulateOpen()
    expect(client.status).toBe('connected')
    ws.simulateClose()
    expect(client.status).toBe('reconnecting')
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
})
