import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useWebSocket } from './useWebSocket'
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

function makePriceUpdate(overrides: Partial<{
  assetPair: string
  price: number
  timestamp: number
  confidence: number
  sources: string[]
}> = {}) {
  return {
    type: 'price_update' as const,
    assetPair: 'BTC/USD',
    price: 50000,
    timestamp: Date.now(),
    confidence: 0.99,
    sources: ['chainlink'],
    ...overrides,
  }
}

describe('useWebSocket', () => {
  it('starts connecting and has empty livePrices initially', () => {
    const { result } = renderHook(() => useWebSocket())
    expect(result.current.status).toBe('connecting')
    expect(result.current.livePrices.size).toBe(0)
  })

  it('transitions to connecting then connected on open', async () => {
    const { result } = renderHook(() => useWebSocket())
    await waitFor(() => expect(result.current.status).toBe('connecting'))

    act(() => { ws.simulateOpen() })
    await waitFor(() => expect(result.current.status).toBe('connected'))
  })

  it('updates livePrices on price_update message', async () => {
    const { result } = renderHook(() => useWebSocket())
    act(() => { ws.simulateOpen() })
    await waitFor(() => expect(result.current.status).toBe('connected'))

    act(() => { ws.simulateMessage(makePriceUpdate()) })
    await waitFor(() => {
      expect(result.current.livePrices.size).toBe(1)
      expect(result.current.livePrices.get('BTC/USD')!.price).toBe(50000)
    })
  })

  it('replaces existing price on subsequent updates for same pair', async () => {
    const { result } = renderHook(() => useWebSocket())
    act(() => { ws.simulateOpen() })
    await waitFor(() => expect(result.current.status).toBe('connected'))

    act(() => { ws.simulateMessage(makePriceUpdate({ price: 50000 })) })
    await waitFor(() => {
      expect(result.current.livePrices.get('BTC/USD')!.price).toBe(50000)
    })

    act(() => { ws.simulateMessage(makePriceUpdate({ price: 51000 })) })
    await waitFor(() => {
      expect(result.current.livePrices.size).toBe(1)
      expect(result.current.livePrices.get('BTC/USD')!.price).toBe(51000)
    })
  })

  it('tracks multiple asset pairs', async () => {
    const { result } = renderHook(() => useWebSocket())
    act(() => { ws.simulateOpen() })
    await waitFor(() => expect(result.current.status).toBe('connected'))

    act(() => { ws.simulateMessage(makePriceUpdate({ assetPair: 'BTC/USD', price: 50000 })) })
    act(() => { ws.simulateMessage(makePriceUpdate({ assetPair: 'ETH/USD', price: 3000 })) })
    await waitFor(() => {
      expect(result.current.livePrices.size).toBe(2)
    })
    expect(result.current.livePrices.get('BTC/USD')!.price).toBe(50000)
    expect(result.current.livePrices.get('ETH/USD')!.price).toBe(3000)
  })

  it('updates status to reconnecting on close', async () => {
    const { result } = renderHook(() => useWebSocket())
    act(() => { ws.simulateOpen() })
    await waitFor(() => expect(result.current.status).toBe('connected'))

    act(() => { ws.simulateClose() })
    await waitFor(() => expect(result.current.status).toBe('reconnecting'))
  })

  it('provides subscribe function that sends messages', async () => {
    const { result } = renderHook(() => useWebSocket())
    act(() => { ws.simulateOpen() })
    await waitFor(() => expect(result.current.status).toBe('connected'))

    act(() => { result.current.subscribe(['BTC/USD']) })
    expect(ws.sent).toContain(JSON.stringify({ action: 'subscribe', assetPairs: ['BTC/USD'] }))
  })

  it('provides unsubscribe function that sends messages', async () => {
    const { result } = renderHook(() => useWebSocket())
    act(() => { ws.simulateOpen() })
    await waitFor(() => expect(result.current.status).toBe('connected'))

    act(() => { result.current.subscribe(['BTC/USD']) })
    act(() => { result.current.unsubscribe(['BTC/USD']) })
    expect(ws.sent).toContain(JSON.stringify({ action: 'unsubscribe', assetPairs: ['BTC/USD'] }))
  })

  it('subscribes to pairs passed to the hook', async () => {
    renderHook(() => useWebSocket(['BTC/USD', 'ETH/USD']))
    act(() => { ws.simulateOpen() })
    await waitFor(() => {
      expect(ws.sent).toContain(
        JSON.stringify({ action: 'subscribe', assetPairs: ['BTC/USD', 'ETH/USD'] }),
      )
    })
  })

  it('ignores non price_update messages', async () => {
    const { result } = renderHook(() => useWebSocket())
    act(() => { ws.simulateOpen() })
    await waitFor(() => expect(result.current.status).toBe('connected'))

    act(() => { ws.simulateMessage({ type: 'unknown', data: 'test' }) })
    expect(result.current.livePrices.size).toBe(0)
  })

  it('cleans up WebSocketClient on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket())
    unmount()
    expect(ws.closed).toBe(true)
  })
})
