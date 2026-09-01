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
