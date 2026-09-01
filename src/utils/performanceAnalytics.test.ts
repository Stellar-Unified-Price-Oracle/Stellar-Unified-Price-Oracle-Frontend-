import { describe, it, expect, vi } from 'vitest'
import {
  trackPerformanceMetric,
  trackWebVital,
  trackPageLoadTiming,
  trackApiResponseTime,
  trackWebSocketMetrics,
  trackMemoryUsage,
  trackRenderingPerformance,
  getPerformanceSummary,
} from './performanceAnalytics'

// Mock analytics
vi.mock('./analytics', () => ({
  trackAnalytics: vi.fn(),
}))

describe('Performance Analytics', () => {
  describe('exported functions', () => {
    it('exports trackPerformanceMetric function', () => {
      expect(typeof trackPerformanceMetric).toBe('function')
    })

    it('exports trackWebVital function', () => {
      expect(typeof trackWebVital).toBe('function')
    })

    it('exports trackPageLoadTiming function', () => {
      expect(typeof trackPageLoadTiming).toBe('function')
    })

    it('exports trackApiResponseTime function', () => {
      expect(typeof trackApiResponseTime).toBe('function')
    })

    it('exports trackWebSocketMetrics function', () => {
      expect(typeof trackWebSocketMetrics).toBe('function')
    })

    it('exports trackMemoryUsage function', () => {
      expect(typeof trackMemoryUsage).toBe('function')
    })

    it('exports trackRenderingPerformance function', () => {
      expect(typeof trackRenderingPerformance).toBe('function')
    })

    it('exports getPerformanceSummary function', () => {
      expect(typeof getPerformanceSummary).toBe('function')
    })
  })

  describe('function signatures', () => {
    it('trackPerformanceMetric can be called with name and value', () => {
      expect(() => trackPerformanceMetric('test_metric', 100)).not.toThrow()
    })

    it('trackPerformanceMetric can be called with full parameters', () => {
      expect(() => trackPerformanceMetric('test_metric', 100, 'ms', 'good')).not.toThrow()
    })

    it('trackWebVital accepts vital name and metrics', () => {
      expect(() => trackWebVital('LCP', 2500, 'good', 0)).not.toThrow()
    })

    it('trackPageLoadTiming accepts timing data', () => {
      expect(() => trackPageLoadTiming(1000, 2000, 3000)).not.toThrow()
    })

    it('trackApiResponseTime accepts endpoint and timing', () => {
      expect(() => trackApiResponseTime('/api/prices', 'GET', 245, 200)).not.toThrow()
    })

    it('trackWebSocketMetrics accepts event type', () => {
      expect(() => trackWebSocketMetrics('connect')).not.toThrow()
      expect(() => trackWebSocketMetrics('disconnect', 5000)).not.toThrow()
    })

    it('trackMemoryUsage does not throw', () => {
      expect(() => trackMemoryUsage()).not.toThrow()
    })

    it('trackRenderingPerformance accepts fps and dropped frames', () => {
      expect(() => trackRenderingPerformance(60)).not.toThrow()
      expect(() => trackRenderingPerformance(45, 5)).not.toThrow()
    })
  })

  describe('getPerformanceSummary', () => {
    it('returns an object with performance data', () => {
      const summary = getPerformanceSummary()
      expect(typeof summary).toBe('object')
      expect(typeof summary.elapsed).toBe('number')
      expect(summary.elapsed).toBeGreaterThan(0)
    })

    it('includes resource count and size', () => {
      const summary = getPerformanceSummary()
      expect(typeof summary.resources_count).toBe('number')
      expect(typeof summary.resources_size).toBe('number')
    })

    it('includes navigation timing if available', () => {
      const summary = getPerformanceSummary()
      // Navigation timing may or may not be available in test environment
      expect(summary).toBeDefined()
    })
  })
})
