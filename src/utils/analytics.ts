/**
 * Privacy-focused analytics utility for tracking user interactions and performance metrics.
 *
 * ## Privacy Guarantees
 * - No personal identifying information (PII) collected
 * - Respects DNT (Do Not Track) and Global Privacy Control headers
 * - User can opt-out via STORAGE_KEYS.analyticsOptOut
 * - Works with privacy-preserving providers: Plausible, Umami
 * - No third-party cookies or tracking
 * - All events can be sent to custom endpoint if configured
 *
 * ## Event Categories
 * - Navigation: page views and route changes
 * - Feature Usage: exports, alerts, preferences, filtering
 * - Performance: web vitals and load times
 * - Engagement: interactions with core UI elements
 */

import { trackEvent as sendToProvider, shouldCollect } from '../hooks/useAnalytics'
import { config } from '../config'

export type AnalyticsEventCategory = 'navigation' | 'feature' | 'performance' | 'engagement'

interface EventProperties {
  [key: string]: string | number | boolean | undefined
}

interface AnalyticsEvent {
  category: AnalyticsEventCategory
  name: string
  props?: EventProperties
  timestamp: number
}

/**
 * Track an analytics event.
 * Sends to provider (Plausible/Umami) and custom endpoint if configured.
 *
 * @example
 * trackAnalytics('feature', 'export', { format: 'csv', rows: 1000 })
 * trackAnalytics('feature', 'alert_triggered', { source: 'chainlink', threshold: 'upper' })
 */
export function trackAnalytics(
  category: AnalyticsEventCategory,
  name: string,
  props?: EventProperties,
): void {
  if (!shouldCollect()) return

  // Format event name with category prefix for provider
  const eventName = `${category}:${name}`

  try {
    sendToProvider(eventName, props)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[Analytics] Failed to send to provider:', err)
    }
  }

  // Send to custom endpoint
  if (config.analyticsEndpoint) {
    try {
      const event: AnalyticsEvent = {
        category,
        name,
        props: props || {},
        timestamp: Date.now(),
      }
      const blob = new Blob([JSON.stringify(event)], { type: 'application/json' })
      navigator.sendBeacon(config.analyticsEndpoint, blob)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[Analytics] Failed to send to custom endpoint:', err)
      }
    }
  }
}

/**
 * Feature tracking helpers for common user interactions.
 * These are convenience functions that wrap trackAnalytics with preset categories.
 */

/** Track export functionality usage */
export function trackExport(format: 'csv' | 'json' | 'xlsx' | 'pdf', rowCount?: number): void {
  trackAnalytics('feature', 'export', { format, rows: rowCount })
}

/** Track price alert creation or modification */
export function trackAlertCreate(type: 'threshold' | 'percentage'): void {
  trackAnalytics('feature', 'alert_create', { type })
}

/** Track alert trigger event */
export function trackAlertTriggered(source: string, direction: 'upper' | 'lower'): void {
  trackAnalytics('feature', 'alert_triggered', { source, direction })
}

/** Track alert dismissal or snooze */
export function trackAlertDismiss(snoozeDuration?: number): void {
  trackAnalytics('feature', 'alert_dismiss', { snoozed: snoozeDuration ? 'yes' : 'no' })
}

/** Track preferences or settings change */
export function trackPreferenceChange(preference: string, value: string | boolean | number): void {
  trackAnalytics('feature', 'preference_change', { preference, value: String(value) })
}

/** Track filter or search action */
export function trackFilterAction(filterType: string, action: 'apply' | 'clear' | 'reset'): void {
  trackAnalytics('feature', 'filter_action', { filter: filterType, action })
}

/** Track search query */
export function trackSearch(query: string, resultCount?: number): void {
  trackAnalytics('feature', 'search', { query, results: resultCount })
}

/** Track price chart interaction */
export function trackChartInteraction(action: 'zoom' | 'pan' | 'tooltip' | 'export'): void {
  trackAnalytics('feature', 'chart_interaction', { action })
}

/** Track notification/alert panel toggle */
export function trackPanelToggle(panelType: 'alerts' | 'settings', action: 'open' | 'close'): void {
  trackAnalytics('engagement', 'panel_toggle', { panel: panelType, action })
}

/** Track keyboard shortcut usage */
export function trackKeyboardShortcut(shortcut: string): void {
  trackAnalytics('engagement', 'keyboard_shortcut', { shortcut })
}

/** Track API documentation view */
export function trackApiDocView(section?: string): void {
  trackAnalytics('engagement', 'api_docs_view', { section })
}

export type { AnalyticsEvent, EventProperties, AnalyticsEventCategory }
