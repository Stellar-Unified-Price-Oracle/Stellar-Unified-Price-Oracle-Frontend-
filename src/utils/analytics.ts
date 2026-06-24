/**
 * Anonymous usage statistics collection utilities.
 * Collects feature usage, page views, and time metrics without PII.
 * Issue #90
 */

import type { AnalyticsEvent, AnalyticsEventType, AnalyticsConsent } from '../types'

const CONSENT_KEY = 'analytics_consent'
const CONSENT_VERSION = 1
const BATCH_SIZE = 10
const BATCH_TIMEOUT = 30000 // 30 seconds

export class AnalyticsCollector {
  private static queue: AnalyticsEvent[] = []
  private static batchTimer: ReturnType<typeof setTimeout> | null = null
  private static endpoint: string = ''
  private static consentGiven = false

  /**
   * Initialize analytics with endpoint and check for consent
   */
  static init(endpoint: string): void {
    this.endpoint = endpoint
    this.loadConsent()
  }

  /**
   * Check if user has given consent
   */
  static hasConsent(): boolean {
    return this.consentGiven
  }

  /**
   * Request and store user consent
   */
  static requestConsent(): boolean {
    const consent = window.confirm(
      'We collect anonymous usage statistics to improve the app. ' +
      'No personal information is collected. Allow analytics?'
    )

    if (consent) {
      const consentData: AnalyticsConsent = {
        given: true,
        timestamp: Date.now(),
        version: CONSENT_VERSION,
      }
      try {
        localStorage.setItem(CONSENT_KEY, JSON.stringify(consentData))
        this.consentGiven = true
      } catch (e) {
        console.warn('Failed to store consent:', e)
      }
    }

    return consent
  }

  /**
   * Load consent from storage
   */
  private static loadConsent(): void {
    try {
      const stored = localStorage.getItem(CONSENT_KEY)
      if (stored) {
        const data = JSON.parse(stored) as AnalyticsConsent
        this.consentGiven = data.given && data.version === CONSENT_VERSION
      }
    } catch {
      // Silently fail
    }
  }

  /**
   * Track an analytics event
   */
  static track(type: AnalyticsEventType, payload?: Record<string, unknown>): void {
    if (!this.consentGiven || !this.endpoint) return

    const event: AnalyticsEvent = {
      type,
      timestamp: Date.now(),
      payload,
    }

    this.queue.push(event)

    if (this.queue.length >= BATCH_SIZE) {
      this.flush()
    } else if (this.batchTimer === null) {
      this.batchTimer = setTimeout(() => {
        this.flush()
        this.batchTimer = null
      }, BATCH_TIMEOUT)
    }
  }

  /**
   * Flush pending analytics events
   */
  static async flush(): Promise<void> {
    if (this.queue.length === 0 || !this.endpoint) return

    const batch = this.queue.splice(0, BATCH_SIZE)

    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
        // Don't send credentials to avoid PII leakage
        credentials: 'omit',
      })
    } catch {
      // Re-queue events on failure (up to original length)
      this.queue.unshift(...batch)
      console.debug('Analytics flush failed')
    }

    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
  }

  /**
   * Clear all pending events
   */
  static clearQueue(): void {
    this.queue = []
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
  }

  /**
   * Revoke consent
   */
  static revokeConsent(): void {
    this.consentGiven = false
    this.clearQueue()
    try {
      localStorage.removeItem(CONSENT_KEY)
    } catch {
      // Silently fail
    }
  }
}
