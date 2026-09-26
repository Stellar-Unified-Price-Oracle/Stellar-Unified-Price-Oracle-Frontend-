import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import { FakeWebSocket } from '../test/fakeWebSocket'
import { PriceHub } from './observe'
import { OracleProvider, usePrice } from './react'
import type { StreamSocket } from './stream'

const mk = () => {
  const sockets: FakeWebSocket[] = []
  const transport = (u: string) => { const s = new FakeWebSocket(u); sockets.push(s); return s as unknown as StreamSocket }
  return { sockets, hub: new PriceHub({ url: 'ws://x', transport }) }
}
describe('PriceHub', () => {
  it('dedupes shared pair subscriptions and cleans up', () => {
    const { sockets, hub } = mk()
    const a = vi.fn(), b = vi.fn()
    const offA = hub.subscribe('XLM/USD', a)
    const offB = hub.subscribe('XLM/USD', b)
    sockets[0].simulateOpen()
    expect(sockets).toHaveLength(1)
    expect(hub.refCount('XLM/USD')).toBe(2)
    sockets[0].simulateMessage({ type: 'price_update', assetPair: 'XLM/USD', price: 1, timestamp: 1, confidence: 1 })
    expect(a).toHaveBeenCalledOnce(); expect(b).toHaveBeenCalledOnce()
    offA(); offA()
    expect(hub.refCount('XLM/USD')).toBe(1)
    offB()
    expect(hub.status).toBe('idle')
    expect(sockets[0].closed).toBe(true)
  })
})
describe('React SSR', () => {
  it('renders on the server without opening a socket', () => {
    const ws = vi.fn()
    vi.stubGlobal('WebSocket', ws)
    const C = () => createElement('span', null, String(usePrice('XLM/USD')?.price ?? 'none'))
    const html = renderToString(createElement(OracleProvider, { options: { url: 'ws://x' } }, createElement(C)))
    expect(html).toContain('none')
    expect(ws).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
