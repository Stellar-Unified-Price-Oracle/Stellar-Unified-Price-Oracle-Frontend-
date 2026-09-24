import { useEffect } from 'react'
import { onLCP, onFID, onCLS, onINP, onFCP, onTTFB } from 'web-vitals'
import type { Metric } from 'web-vitals'
import { config } from '../config'
import { recordPerfMark } from '../utils/performanceMonitor'
import { trackEvent } from './useAnalytics'

interface WebVitalReport {
  name: string
  value: number
  rating: string
  delta: number
  id: string
  route: string
  viewport: string
  connection: string | null
}

function shouldTrack(): boolean {
  if (navigator.doNotTrack === '1') return false
  if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return false
  return true
}

function getConnectionType(): string | null {
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection
  return conn?.effectiveType ?? null
}

/**
 * Measures the DNS+connect delta for the first request to each hinted origin
 * (#509). With a working `<link rel="preconnect">`/`dns-prefetch` hint, that
 * connection is already warm by the time the real request fires, so this
 * delta should be near zero; a regression (hint missing, CSP-blocked, wrong
 * origin) shows up here as a nonzero `connect_ms`. Reported once per origin
 * via the same analytics pipeline as the core web-vitals metrics so the
 * startup impact of resource hints is visible alongside LCP/TTFB.
 */
function measureResourceHintOrigins(): void {
  const origins = [config.apiUrl, config.wsUrl]
    .filter((url): url is string => Boolean(url))
    .map((url) => {
      try {
        return new URL(url.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:')).origin
      } catch {
        return null
      }
    })
    .filter((origin): origin is string => origin !== null && origin !== window.location.origin)

  if (origins.length === 0 || typeof PerformanceObserver === 'undefined') return

  const reported = new Set<string>()

  const report = (entry: PerformanceResourceTiming) => {
    const origin = new URL(entry.name).origin
    if (reported.has(origin)) return
    reported.add(origin)

    const connectMs = Math.max(0, entry.connectEnd - entry.connectStart)
    const dnsMs = Math.max(0, entry.domainLookupEnd - entry.domainLookupStart)

    recordPerfMark(`resource_hint:${origin}:connect_ms=${connectMs.toFixed(1)}`)
    trackEvent('resource_hint_startup', {
      origin,
      connect_ms: Math.round(connectMs),
      dns_ms: Math.round(dnsMs),
    })

    if (reported.size === origins.length) observer.disconnect()
  }

  // Entries recorded before the observer attaches (very early requests) are
  // still visible via getEntriesByType.
  for (const entry of performance.getEntriesByType('resource') as PerformanceResourceTiming[]) {
    if (origins.includes(new URL(entry.name).origin)) report(entry)
  }

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
      if (origins.includes(new URL(entry.name).origin)) report(entry)
    }
  })
  observer.observe({ type: 'resource', buffered: true })

  // Startup-only measurement — stop watching after the first few seconds.
  setTimeout(() => observer.disconnect(), 10_000)
}

function sendToAnalytics(report: WebVitalReport) {
  const body = JSON.stringify(report)

  if (config.analyticsEndpoint) {
    const blob = new Blob([body], { type: 'application/json' })
    navigator.sendBeacon(config.analyticsEndpoint, blob)
  }

  // Also report via the configured analytics provider (Plausible / Umami)
  trackEvent(`web_vital:${report.name.toLowerCase()}`, {
    value: Math.round(report.value),
    rating: report.rating,
    delta: Math.round(report.delta),
    route: report.route,
    viewport: report.viewport,
    connection: report.connection ?? undefined,
  })

  if (import.meta.env.DEV) {
    console.info(
      `[Web Vitals] ${report.name} ${report.rating} ${report.value.toFixed(2)}`,
      report,
    )
  }
}

export function useWebVitals(): void {
  useEffect(() => {
    if (!shouldTrack()) return

    measureResourceHintOrigins()

    const reportMetric = (metric: Metric) => {
      // Place a performance mark so the metric appears in the DevTools timeline
      recordPerfMark(`web_vital:${metric.name}:${metric.rating}`)

      const task = () => {
        sendToAnalytics({
          name: metric.name,
          value: metric.value,
          rating: metric.rating,
          delta: metric.delta,
          id: metric.id,
          route: window.location.pathname,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          connection: getConnectionType(),
        })
      }

      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(task)
      } else {
        setTimeout(task, 0)
      }
    }

    onLCP(reportMetric)
    onFID(reportMetric)
    onCLS(reportMetric)
    onINP(reportMetric)
    onFCP(reportMetric)
    onTTFB(reportMetric)
  }, [])
}

export type { WebVitalReport }
