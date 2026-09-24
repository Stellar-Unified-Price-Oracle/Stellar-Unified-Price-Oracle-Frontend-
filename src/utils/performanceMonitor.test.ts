import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  startPerformanceMonitor,
  stopPerformanceMonitor,
  subscribePerformance,
  recordWsMessageTiming,
  recordPerfMark,
  resetPerformanceMonitor,
  getPerformanceSnapshot,
} from './performanceMonitor'

afterEach(() => {
  stopPerformanceMonitor()
  resetPerformanceMonitor()
})

describe('performanceMonitor', () => {
  it('start/stop is idempotent and leaves no dangling rAF loop', () => {
    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame')
    startPerformanceMonitor()
    startPerformanceMonitor() // second call must be a no-op
    expect(rafSpy).toHaveBeenCalledTimes(1)
    stopPerformanceMonitor()
    stopPerformanceMonitor() // second call must be a no-op (no throw)
    rafSpy.mockRestore()
  })

  it('subscribePerformance disposer removes the listener (no leak on unmount)', () => {
    const listener = vi.fn()
    const unsubscribe = subscribePerformance(listener)
    expect(listener).toHaveBeenCalledTimes(1) // fires immediately on subscribe

    unsubscribe()
    recordWsMessageTiming(performance.now())
    // No further calls after disposal — a leaked listener would still fire here.
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('caps stored WS timing samples so memory does not grow unbounded', () => {
    for (let i = 0; i < 150; i++) {
      recordWsMessageTiming(performance.now() - 1, 'price_update')
    }
    const snapshot = getPerformanceSnapshot()
    expect(snapshot.wsTiming.length).toBeLessThanOrEqual(100)
  })

  it('caps stored performance marks so memory does not grow unbounded', () => {
    for (let i = 0; i < 150; i++) {
      recordPerfMark(`mark:${i}`)
    }
    const snapshot = getPerformanceSnapshot()
    expect(snapshot.marks.length).toBeLessThanOrEqual(100)
  })

  it('computes average WS processing time across recorded samples', () => {
    recordWsMessageTiming(performance.now() - 10)
    recordWsMessageTiming(performance.now() - 20)
    const snapshot = getPerformanceSnapshot()
    expect(snapshot.avgWsProcessingMs).not.toBeNull()
    expect(snapshot.avgWsProcessingMs!).toBeGreaterThan(0)
  })

  it('reset clears all accumulated timing, mark, and long-task state', () => {
    recordWsMessageTiming(performance.now())
    recordPerfMark('some:mark')
    resetPerformanceMonitor()
    const snapshot = getPerformanceSnapshot()
    expect(snapshot.wsTiming).toEqual([])
    expect(snapshot.marks).toEqual([])
    expect(snapshot.longTasks).toEqual([])
    expect(snapshot.totalLongTasks).toBe(0)
  })

  it('processes a high-throughput burst of WS message timings within budget', () => {
    const start = performance.now()
    for (let i = 0; i < 1000; i++) {
      recordWsMessageTiming(performance.now(), 'price_update')
    }
    const elapsed = performance.now() - start
    // 1000 samples should process well under a second even on a slow CI box —
    // a regression here would indicate an accidental O(n^2) path (e.g. a full
    // array scan per sample instead of a bounded ring buffer).
    expect(elapsed).toBeLessThan(1000)
  })
})
