import { useEffect } from 'react'
import { onLCP, onFID, onCLS, onINP, onFCP, onTTFB } from 'web-vitals'
import type { Metric } from 'web-vitals'
import { config } from '../config'

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

  if (import.meta.env.DEV) {
    const ratingColor =
      report.rating === 'good' ? '#4caf50' : report.rating === 'needs-improvement' ? '#ff9800' : '#f44336'

    console.log(
      `%c[Web Vitals]%c ${report.name} %c${report.rating} %c${report.value.toFixed(2)}`,
      'color:#888',
      'color:#fff;font-weight:bold',
      `color:${ratingColor}`,
      'color:#64b5f6',
      report,
    )
  }
}

export function useWebVitals() {
  useEffect(() => {
    if (!shouldTrack()) return

    const reportMetric = (metric: Metric) => {
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
