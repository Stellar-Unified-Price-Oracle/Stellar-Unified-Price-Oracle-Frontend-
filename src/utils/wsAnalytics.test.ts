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

  // ── #473 — message rate / byte / drop tracking, latency percentiles ──────

  describe('recordMessage', () => {
    it('tracks total messages and bytes', () => {
      wsAnalytics.recordMessage(120, 5)
      wsAnalytics.recordMessage(80, 10)
      const s = wsAnalytics.getSummary()
      expect(s.totalMessages).toBe(2)
      expect(s.totalBytes).toBe(200)
    })

    it('computes p50/p95/p99 from real latency samples (nearest-rank)', () => {
      // 100 ascending samples: 1..100
      for (let i = 1; i <= 100; i++) wsAnalytics.recordMessage(10, i)
      const { p50, p95, p99 } = wsAnalytics.getSummary().messageLatencyPercentiles
      expect(p50).toBe(50)
      expect(p95).toBe(95)
      expect(p99).toBe(99)
    })

    it('reports null percentiles when there are no samples yet', () => {
      const { p50, p95, p99 } = wsAnalytics.getSummary().messageLatencyPercentiles
      expect(p50).toBeNull()
      expect(p95).toBeNull()
      expect(p99).toBeNull()
    })

    it('accumulates per-minute rate buckets with message count and bytes', () => {
      vi.useFakeTimers()
      vi.setSystemTime(0)
      wsAnalytics.recordMessage(100, 1)
      wsAnalytics.recordMessage(100, 1)
      const s = wsAnalytics.getSummary()
      expect(s.rateBuckets).toHaveLength(1)
      expect(s.rateBuckets[0].messages).toBe(2)
      expect(s.rateBuckets[0].bytes).toBe(200)
      vi.useRealTimers()
    })

    it('starts a new bucket once the minute rolls over', () => {
      vi.useFakeTimers()
      vi.setSystemTime(0)
      wsAnalytics.recordMessage(10, 1)
      vi.setSystemTime(61_000)
      wsAnalytics.recordMessage(10, 1)
      const s = wsAnalytics.getSummary()
      expect(s.rateBuckets).toHaveLength(2)
      expect(s.rateBuckets[0].messages).toBe(1)
      expect(s.rateBuckets[1].messages).toBe(1)
      vi.useRealTimers()
    })

    it('throttles subscriber notifications for a burst of messages', () => {
      vi.useFakeTimers()
      const listener = vi.fn()
      const unsub = wsAnalytics.subscribe(listener)
      listener.mockClear() // drop the immediate on-subscribe call
      for (let i = 0; i < 20; i++) wsAnalytics.recordMessage(10, 1)
      // Nothing fires synchronously — it's coalesced onto a timer.
      expect(listener).not.toHaveBeenCalled()
      vi.advanceTimersByTime(300)
      expect(listener).toHaveBeenCalledTimes(1)
      unsub()
      vi.useRealTimers()
    })
  })

  describe('recordDrop', () => {
    it('increments totalDrops and logs a drop event with detail', () => {
      wsAnalytics.recordDrop('malformed')
      const s = wsAnalytics.getSummary()
      expect(s.totalDrops).toBe(1)
      expect(s.events[0]).toMatchObject({ type: 'drop', detail: 'malformed' })
    })

    it('counts drops in the current rate bucket', () => {
      wsAnalytics.recordMessage(10, 1)
      wsAnalytics.recordDrop()
      const s = wsAnalytics.getSummary()
      expect(s.rateBuckets[0].drops).toBe(1)
    })
  })

  describe('session metric reset on drop/reconnect (#473)', () => {
    it('clears message latency percentiles on disconnect but keeps rate-bucket history', () => {
      wsAnalytics.recordMessage(10, 42)
      expect(wsAnalytics.getSummary().messageLatencyPercentiles.p50).toBe(42)

      wsAnalytics.recordDisconnect()

      const s = wsAnalytics.getSummary()
      expect(s.messageLatencyPercentiles.p50).toBeNull()
      // The per-minute history is a time series meant to span reconnects —
      // it should NOT be wiped by the same reset.
      expect(s.rateBuckets[0].messages).toBe(1)
    })

    it('clears message latency percentiles on reconnect', () => {
      wsAnalytics.recordMessage(10, 42)
      wsAnalytics.recordReconnect()
      expect(wsAnalytics.getSummary().messageLatencyPercentiles.p50).toBeNull()
      expect(wsAnalytics.getSummary().totalReconnects).toBe(1)
    })
  })

  it('exportDiagnosticsSnapshot produces valid JSON with a summary', () => {
    wsAnalytics.recordConnect()
    wsAnalytics.recordMessage(100, 5)
    const parsed = JSON.parse(wsAnalytics.exportDiagnosticsSnapshot())
    expect(parsed.summary.totalConnects).toBe(1)
    expect(parsed.summary.totalMessages).toBe(1)
    expect(typeof parsed.exportedAt).toBe('string')
  })
})
