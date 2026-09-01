import { afterEach, describe, expect, it, vi } from 'vitest'
import { wsAnalytics } from './wsAnalytics'

afterEach(() => {
  wsAnalytics.clear()
  vi.restoreAllMocks()
})

describe('wsAnalytics', () => {
  it('records connect event', () => {
    wsAnalytics.recordConnect()
    const s = wsAnalytics.getSummary()
    expect(s.totalConnects).toBe(1)
    expect(s.events[0].type).toBe('connect')
  })

  it('records disconnect with duration', () => {
    wsAnalytics.recordConnect()
    wsAnalytics.recordDisconnect()
    const s = wsAnalytics.getSummary()
    expect(s.totalDisconnects).toBe(1)
    const disconnectEvent = s.events.find((e) => e.type === 'disconnect')
    expect(disconnectEvent).toBeDefined()
    expect(disconnectEvent!.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('records reconnect event', () => {
    wsAnalytics.recordReconnect()
    expect(wsAnalytics.getSummary().totalReconnects).toBe(1)
  })

  it('records error event', () => {
    wsAnalytics.recordError('timeout')
    const s = wsAnalytics.getSummary()
    expect(s.totalErrors).toBe(1)
    expect(s.events[0].detail).toBe('timeout')
  })

  it('records latency and computes avg', () => {
    wsAnalytics.recordLatency(100)
    wsAnalytics.recordLatency(200)
    const s = wsAnalytics.getSummary()
    expect(s.avgLatencyMs).toBe(150)
  })

  it('notifies subscribers', () => {
    const listener = vi.fn()
    const unsub = wsAnalytics.subscribe(listener)
    wsAnalytics.recordConnect()
    expect(listener).toHaveBeenCalled()
    unsub()
  })

  it('exports valid JSON', () => {
    wsAnalytics.recordConnect()
    expect(() => JSON.parse(wsAnalytics.exportEvents())).not.toThrow()
  })

  it('clear resets state', () => {
    wsAnalytics.recordConnect()
    wsAnalytics.clear()
    const s = wsAnalytics.getSummary()
    expect(s.totalConnects).toBe(0)
    expect(s.events.length).toBe(0)
  })
})
