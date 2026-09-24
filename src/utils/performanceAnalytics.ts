/**
 * Performance metrics tracking for analytics.
 *
 * Tracks:
 * - Core Web Vitals (LCP, FID, CLS, INP, FCP, TTFB)
 * - Custom performance marks and measures
 * - Resource timing information
 * - Navigation timing
 */

import { trackAnalytics } from './analytics'

interface PerformanceMetric {
  name: string
  value: number
  unit: 'ms' | 'bytes' | 'score'
  rating?: 'good' | 'needs-improvement' | 'poor'
}

/**
 * Track a generic performance metric.
 *
 * @example
 * trackPerformanceMetric('api_response_time', 245, 'ms', 'good')
 * trackPerformanceMetric('bundle_size', 198000, 'bytes')
 */
export function trackPerformanceMetric(
  name: string,
  value: number,
  unit: 'ms' | 'bytes' | 'score' = 'ms',
  rating?: 'good' | 'needs-improvement' | 'poor',
): void {
  trackAnalytics('performance', `metric_${name}`, {
    value: Math.round(value),
    unit,
    rating,
  })
}

/**
 * Track Core Web Vitals metric.
 * LCP (Largest Contentful Paint), FID (First Input Delay), CLS (Cumulative Layout Shift), etc.
 */
export function trackWebVital(
  vitalName: string,
  value: number,
  rating: 'good' | 'needs-improvement' | 'poor',
  delta: number,
): void {
  trackAnalytics('performance', `web_vital_${vitalName.toLowerCase()}`, {
    value: Math.round(value),
    rating,
    delta: Math.round(delta),
  })
}

/**
 * Track initial page load timing.
 */
export function trackPageLoadTiming(
  navigationStart: number,
  domContentLoaded: number,
  loadComplete: number,
): void {
  const domTime = domContentLoaded - navigationStart
  const totalTime = loadComplete - navigationStart

  trackAnalytics('performance', 'page_load_timing', {
    dom_load_ms: Math.round(domTime),
    total_load_ms: Math.round(totalTime),
  })
}

/**
 * Track API response time.
 */
export function trackApiResponseTime(
  endpoint: string,
  method: string,
  responseTime: number,
  statusCode: number,
): void {
  trackAnalytics('performance', 'api_response', {
    endpoint: endpoint.replace(/\?.+/, ''), // Remove query params
    method,
    time_ms: Math.round(responseTime),
    status: statusCode,
  })
}

/**
 * Track WebSocket connection metrics.
 */
export function trackWebSocketMetrics(
  event: 'connect' | 'disconnect' | 'reconnect' | 'error',
  duration?: number,
): void {
  trackAnalytics('performance', `websocket_${event}`, {
    duration_ms: duration ? Math.round(duration) : undefined,
  })
}

/**
 * Track memory usage if available.
 * Note: performance.memory is a non-standard API and may not be available in all browsers.
 */
export function trackMemoryUsage(): void {
  const perf = performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }
  if (!perf.memory) return

  trackAnalytics('performance', 'memory_usage', {
    used_mb: Math.round(perf.memory.usedJSHeapSize / 1024 / 1024),
    limit_mb: Math.round(perf.memory.jsHeapSizeLimit / 1024 / 1024),
    percentage: Math.round((perf.memory.usedJSHeapSize / perf.memory.jsHeapSizeLimit) * 100),
  })
}

/**
 * Track rendering performance (frame rate, animation smoothness).
 */
export function trackRenderingPerformance(
  fps: number,
  droppedFrames?: number,
): void {
  trackAnalytics('performance', 'rendering', {
    fps: Math.round(fps),
    dropped_frames: droppedFrames,
  })
}

/**
 * Get performance summary for current page.
 * Useful for sending a snapshot of overall performance to analytics.
 */
export function getPerformanceSummary(): Record<string, number> {
  const now = performance.now()
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  const paints = performance.getEntriesByType('paint')
  const resources = performance.getEntriesByType('resource')

  const summary: Record<string, number> = {
    elapsed: Math.round(now),
    resources_count: resources.length,
    resources_size: Math.round(resources.reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024), // KB
  }

  if (navigation) {
    const nav = navigation as PerformanceNavigationTiming & { navigationStart?: number; domainLookupStart?: number; domainLookupEnd?: number; connectStart?: number; connectEnd?: number; requestStart?: number; responseStart?: number; responseEnd?: number; domInteractive?: number; domComplete?: number; loadEventEnd?: number }
    if (nav.navigationStart !== undefined) {
      if (nav.domainLookupStart !== undefined && nav.domainLookupEnd !== undefined) {
        summary.dns_ms = Math.round(nav.domainLookupEnd - nav.domainLookupStart)
      }
      if (nav.connectStart !== undefined && nav.connectEnd !== undefined) {
        summary.tcp_ms = Math.round(nav.connectEnd - nav.connectStart)
      }
      if (nav.requestStart !== undefined && nav.responseStart !== undefined) {
        summary.request_ms = Math.round(nav.responseStart - nav.requestStart)
      }
      if (nav.responseStart !== undefined && nav.responseEnd !== undefined) {
        summary.response_ms = Math.round(nav.responseEnd - nav.responseStart)
      }
      if (nav.domInteractive !== undefined) {
        summary.dom_interactive_ms = Math.round(nav.domInteractive - nav.navigationStart)
      }
      if (nav.domComplete !== undefined) {
        summary.dom_complete_ms = Math.round(nav.domComplete - nav.navigationStart)
      }
      if (nav.loadEventEnd !== undefined) {
        summary.load_complete_ms = Math.round(nav.loadEventEnd - nav.navigationStart)
      }
    }
  }

  paints.forEach((paint) => {
    summary[`${paint.name}_ms`] = Math.round(paint.startTime)
  })

  return summary
}

export type { PerformanceMetric }
