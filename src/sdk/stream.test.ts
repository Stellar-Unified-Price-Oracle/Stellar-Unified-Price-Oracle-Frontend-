import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeWebSocket } from '../test/fakeWebSocket'
import { parseFrame, StreamClient, type StreamSocket } from './stream'

describe('StreamClient', () => {
  let sockets: FakeWebSocket[]
  beforeEach(() => { vi.useFakeTimers(); sockets = [] })
  afterEach(() => vi.useRealTimers())
  const transport = (url: string) => { const s = new FakeWebSocket(url); sockets.push(s); return s as unknown as StreamSocket }
  const price = { type: 'price_update', assetPair: 'XLM/USD', price: 1.2, timestamp: 1, confidence: 1 }

  it('validates frames', () => {
    expect(parseFrame('nope')).toBeNull()
    expect(parseFrame({ type: 'price_update', assetPair: 1 })).toBeNull()
    expect(parseFrame(price)?.type).toBe('price')
  })
  it('emits typed events, subscribes and reconnects', () => {
    const c = new StreamClient({ url: 'ws://x', pairs: ['XLM/USD'], transport, random: () => 0 })
    const statuses: string[] = []
    const prices: unknown[] = []
    c.on('status', (s) => statuses.push(s))
    c.on('price', (p) => prices.push(p))
    c.connect()
    sockets[0].simulateOpen()
    expect(sockets[0].sent[0]).toContain('subscribe')
    sockets[0].simulateMessage(price)
    sockets[0].simulateRawMessage('garbage')
    expect(prices).toHaveLength(1)
    sockets[0].simulateClose()
    vi.advanceTimersByTime(300)
    expect(sockets).toHaveLength(2)
    sockets[1].simulateOpen()
    expect(statuses).toEqual(['connecting', 'connected', 'reconnecting', 'connected'])
    c.close()
    expect(c.status).toBe('closed')
  })
})
