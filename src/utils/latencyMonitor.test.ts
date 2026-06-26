import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  exportLatency,
  getLatencyStats,
  getSamples,
  recordLatency,
  setLatencyAlertThreshold,
  subscribeLatency,
} from './latencyMonitor'

// Reset module-level state between tests
afterEach(() => {
  // drain samples by importing the internals via the public API
  // We can't easily reset module-level arrays without exporting clear(),
  // so we spy on console.warn side-effects only.
  vi.restoreAllMocks()
})

describe('latencyMonitor', () => {
  it('records latency samples', () => {
    recordLatency('/api/test', 120, true)
    const samples = getSamples(10)
    const found = samples.some((s) => s.endpoint === '/api/test' && s.latencyMs === 120)
    expect(found).toBe(true)
  })

  it('computes percentile stats', () => {
    // Record known values
    for (const ms of [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]) {
      recordLatency('/api/perc', ms, true)
    }
    const stats = getLatencyStats('/api/perc')
    expect(stats.count).toBeGreaterThanOrEqual(10)
    expect(stats.p50).not.toBeNull()
    expect(stats.p95).not.toBeNull()
    expect(stats.p99).not.toBeNull()
  })

  it('fires console.warn on high latency', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setLatencyAlertThreshold(500)
    recordLatency('/api/slow', 1500, true)
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('High latency'))
  })

  it('notifies subscribers', () => {
    const listener = vi.fn()
    const unsub = subscribeLatency(listener)
    recordLatency('/api/notify', 50, true)
    expect(listener).toHaveBeenCalled()
    unsub()
  })

  it('exports valid JSON', () => {
    recordLatency('/api/export', 100, true)
    expect(() => JSON.parse(exportLatency())).not.toThrow()
  })
})
