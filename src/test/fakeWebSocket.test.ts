import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FakeWebSocket } from './fakeWebSocket'

describe('FakeWebSocket', () => {
  let ws: FakeWebSocket

  beforeEach(() => {
    ws = new FakeWebSocket('ws://test.com')
  })

  it('sets url and initial readyState', () => {
    expect(ws.url).toBe('ws://test.com')
    expect(ws.readyState).toBe(FakeWebSocket.CONNECTING)
  })

  it('has correct static constants', () => {
    expect(FakeWebSocket.CONNECTING).toBe(0)
    expect(FakeWebSocket.OPEN).toBe(1)
    expect(FakeWebSocket.CLOSING).toBe(2)
    expect(FakeWebSocket.CLOSED).toBe(3)
  })

  describe('simulateOpen', () => {
    it('triggers onopen and sets readyState to OPEN', () => {
      const onopen = vi.fn()
      ws.onopen = onopen
      ws.simulateOpen()
      expect(ws.readyState).toBe(FakeWebSocket.OPEN)
      expect(onopen).toHaveBeenCalledTimes(1)
      expect(onopen).toHaveBeenCalledWith(expect.any(Event))
    })

    it('does nothing when onopen is null', () => {
      ws.simulateOpen()
      expect(ws.readyState).toBe(FakeWebSocket.OPEN)
    })
  })

  describe('simulateMessage', () => {
    it('triggers onmessage with stringified data', () => {
      const onmessage = vi.fn()
      ws.onmessage = onmessage
      const payload = { type: 'price_update', assetPair: 'BTC/USD', price: 50000 }
      ws.simulateMessage(payload)
      expect(onmessage).toHaveBeenCalledTimes(1)
      const event = onmessage.mock.calls[0][0] as MessageEvent
      expect(event.data).toBe(JSON.stringify(payload))
    })

    it('does nothing when onmessage is null', () => {
      ws.simulateMessage({ key: 'value' })
    })

    it('respects messageLatency option', async () => {
      vi.useFakeTimers()
      ws = new FakeWebSocket('ws://test.com', { messageLatency: 100 })
      const onmessage = vi.fn()
      ws.onmessage = onmessage
      ws.simulateMessage({ data: 'delayed' })
      expect(onmessage).not.toHaveBeenCalled()
      vi.advanceTimersByTime(100)
      expect(onmessage).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })
  })

  describe('simulateClose', () => {
    it('triggers onclose and sets readyState to CLOSED', () => {
      const onclose = vi.fn()
      ws.onclose = onclose
      ws.simulateClose(1000, 'normal')
      expect(ws.readyState).toBe(FakeWebSocket.CLOSED)
      expect(onclose).toHaveBeenCalledTimes(1)
      const event = onclose.mock.calls[0][0] as CloseEvent
      expect(event.code).toBe(1000)
      expect(event.reason).toBe('normal')
    })

    it('does nothing when onclose is null', () => {
      ws.simulateClose()
      expect(ws.readyState).toBe(FakeWebSocket.CLOSED)
    })
  })

  describe('simulateError', () => {
    it('triggers onerror', () => {
      const onerror = vi.fn()
      ws.onerror = onerror
      ws.simulateError()
      expect(onerror).toHaveBeenCalledTimes(1)
      expect(onerror).toHaveBeenCalledWith(expect.any(Event))
    })

    it('does nothing when onerror is null', () => {
      ws.simulateError()
    })
  })

  describe('send', () => {
    it('appends to sent array', () => {
      ws.send('message1')
      ws.send('message2')
      expect(ws.sent).toEqual(['message1', 'message2'])
    })
  })

  describe('close', () => {
    it('sets closed flag and readyState to CLOSING then CLOSED', () => {
      ws.close(1001, 'going away')
      expect(ws.closed).toBe(true)
      expect(ws.closeCode).toBe(1001)
      expect(ws.closeReason).toBe('going away')
      expect(ws.readyState).toBe(FakeWebSocket.CLOSED)
    })

    it('triggers onclose', () => {
      const onclose = vi.fn()
      ws.onclose = onclose
      ws.close()
      expect(onclose).toHaveBeenCalledTimes(1)
      expect(onclose).toHaveBeenCalledWith(expect.any(CloseEvent))
    })
  })

  describe('openDelay option', () => {
    it('auto-opens after specified delay', () => {
      vi.useFakeTimers()
      const onopen = vi.fn()
      ws = new FakeWebSocket('ws://test.com', { openDelay: 200 })
      ws.onopen = onopen
      vi.advanceTimersByTime(200)
      expect(ws.readyState).toBe(FakeWebSocket.OPEN)
      expect(onopen).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })

    it('does not auto-open before delay elapses', () => {
      vi.useFakeTimers()
      ws = new FakeWebSocket('ws://test.com', { openDelay: 200 })
      ws.onopen = vi.fn()
      vi.advanceTimersByTime(100)
      expect(ws.readyState).toBe(FakeWebSocket.CONNECTING)
      vi.useRealTimers()
    })
  })

  describe('closeDelay option', () => {
    it('defers close event', () => {
      vi.useFakeTimers()
      const onclose = vi.fn()
      ws = new FakeWebSocket('ws://test.com', { closeDelay: 100 })
      ws.onclose = onclose
      ws.close()
      expect(ws.readyState).toBe(FakeWebSocket.CLOSING)
      expect(onclose).not.toHaveBeenCalled()
      vi.advanceTimersByTime(100)
      expect(ws.readyState).toBe(FakeWebSocket.CLOSED)
      expect(onclose).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })
  })

  describe('reset', () => {
    it('resets all state and clears handlers', () => {
      ws.onopen = vi.fn()
      ws.simulateOpen()
      ws.send('test')
      ws.reset()
      expect(ws.readyState).toBe(FakeWebSocket.CONNECTING)
      expect(ws.sent).toEqual([])
      expect(ws.closed).toBe(false)
      expect(ws.closeCode).toBeUndefined()
      expect(ws.closeReason).toBeUndefined()
      expect(ws.onopen).toBeNull()
      expect(ws.onclose).toBeNull()
      expect(ws.onmessage).toBeNull()
      expect(ws.onerror).toBeNull()
    })

    it('cancels pending auto-open timer', () => {
      vi.useFakeTimers()
      ws = new FakeWebSocket('ws://test.com', { openDelay: 100 })
      ws.onopen = vi.fn()
      ws.reset()
      vi.advanceTimersByTime(100)
      expect(ws.readyState).toBe(FakeWebSocket.CONNECTING)
      vi.useRealTimers()
    })
  })
})
