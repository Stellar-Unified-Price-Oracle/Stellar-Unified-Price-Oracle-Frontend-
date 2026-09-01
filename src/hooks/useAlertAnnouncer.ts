import { useEffect, useMemo, useRef } from 'react'
import type { Alert } from '../types'
import { formatPrice } from '../utils/format'
import { useAnnounce } from './useAnnounce'

/**
 * Configuration for alert announcement behavior
 */
export interface AlertAnnouncerConfig {
  /**
   * Only announce alerts that have been fired/triggered
   * @default true
   */
  onlyTriggered: boolean

  /**
   * Deduplication window for alert announcements in milliseconds
   * @default 3000 (3 seconds)
   */
  deduplicationMs: number

  /**
   * Whether to announce alert snoozed events
   * @default false
   */
  announceSnooze: boolean
}

const DEFAULT_CONFIG: AlertAnnouncerConfig = {
  onlyTriggered: true,
  deduplicationMs: 3000,
  announceSnooze: false,
}

/**
 * Format an alert condition for readable announcement
 */
function formatAlertCondition(alert: Alert): string {
  if (alert.percentageMode && alert.percentageThreshold !== null && alert.percentageWindow) {
    return `price changes by ${alert.percentageThreshold}% in ${alert.percentageWindow}`
  } else if (alert.upperThreshold !== null && alert.lowerThreshold === null) {
    return `price rises above ${formatPrice(alert.upperThreshold)}`
  } else if (alert.lowerThreshold !== null && alert.upperThreshold === null) {
    return `price falls below ${formatPrice(alert.lowerThreshold)}`
  } else if (alert.upperThreshold !== null && alert.lowerThreshold !== null) {
    return `price is between ${formatPrice(alert.lowerThreshold)} and ${formatPrice(alert.upperThreshold)}`
  }
  return 'alert condition'
}

/**
 * Hook for announcing price alert firings to screen readers.
 * Monitors alerts for firing events and announces them with assertive priority.
 */
export function useAlertAnnouncer(
  alerts: Alert[] | undefined,
  config: Partial<AlertAnnouncerConfig> = {},
): void {
  const { announce } = useAnnounce({
    deduplicationMs: (config.deduplicationMs ?? DEFAULT_CONFIG.deduplicationMs) * 2,
  })

  const prevFireCountRef = useRef<Map<string, number>>(new Map())
  const lastAnnouncedRef = useRef<Map<string, number>>(new Map())

  const mergedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config])

  useEffect(() => {
    if (!alerts || alerts.length === 0) return

    const now = Date.now()

    for (const alert of alerts) {
      const prevFireCount = prevFireCountRef.current.get(alert.id) ?? 0
      const lastAnnounced = lastAnnouncedRef.current.get(alert.id)

      // Track fire count
      prevFireCountRef.current.set(alert.id, alert.fireCount)

      // Announce if alert just fired (fireCount increased)
      if (alert.fireCount > prevFireCount && alert.active) {
        // Check deduplication window
        if (lastAnnounced === undefined || now - lastAnnounced >= mergedConfig.deduplicationMs) {
          const conditionText = formatAlertCondition(alert)
          const announcement = `Alert triggered for ${alert.assetPair}: ${conditionText}`

          // Use assertive priority for alert firings
          announce(announcement, 'assertive')
          lastAnnouncedRef.current.set(alert.id, now)
        }
      }

      // Announce if snoozed
      if (mergedConfig.announceSnooze && alert.snoozedUntil && alert.snoozedUntil > now) {
        const announcement = `${alert.assetPair} alert snoozed`
        announce(announcement, 'polite')
      }
    }
  }, [alerts, mergedConfig, announce])
}

/**
 * Hook for announcing when an individual alert fires
 * (useful for placing near specific alert components).
 */
export function useIndividualAlertAnnouncer(
  alert: Alert | undefined,
  config: Partial<AlertAnnouncerConfig> = {},
): void {
  const { announce } = useAnnounce(config)
  const prevFireCountRef = useRef<number>(0)
  const prevSnoozedRef = useRef<boolean>(false)

  const mergedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config])

  useEffect(() => {
    if (!alert) return

    const now = Date.now()
    const isSnoozed = alert.snoozedUntil && alert.snoozedUntil > now

    // Announce if alert just fired
    if (alert.fireCount > prevFireCountRef.current && alert.active) {
      const conditionText = formatAlertCondition(alert)
      const announcement = `Alert triggered for ${alert.assetPair}: ${conditionText}`
      announce(announcement, 'assertive')
    }

    // Announce if just snoozed
    if (mergedConfig.announceSnooze && isSnoozed && !prevSnoozedRef.current) {
      const announcement = `${alert.assetPair} alert snoozed`
      announce(announcement, 'polite')
    }

    prevFireCountRef.current = alert.fireCount
    prevSnoozedRef.current = isSnoozed
  }, [alert, mergedConfig, announce])
}

/**
 * Hook for announcing alert statistics/summaries
 * (e.g., "3 fired alerts, 5 active alerts")
 */
export function useAlertSummaryAnnouncer(
  alerts: Alert[] | undefined,
  config: Partial<AlertAnnouncerConfig> = {},
): void {
  const { announce } = useAnnounce({
    deduplicationMs: 10000, // Longer dedup for summaries
    ...config,
  })

  const prevCountRef = useRef<{ fired: number; active: number }>(
    { fired: 0, active: 0 },
  )

  useEffect(() => {
    if (!alerts) return

    const now = Date.now()
    const fired = alerts.filter(a => a.fireCount > 0).length
    const active = alerts.filter(a => a.active && (!a.snoozedUntil || a.snoozedUntil <= now))
      .length

    if (fired !== prevCountRef.current.fired) {
      const announcement =
        fired > 0
          ? `${fired} price alert${fired !== 1 ? 's' : ''} has fired`
          : `No alerts have fired`
      announce(announcement, 'assertive')
    }

    if (active !== prevCountRef.current.active) {
      const announcement = `${active} active alert${active !== 1 ? 's' : ''}`
      announce(announcement, 'polite')
    }

    prevCountRef.current = { fired, active }
  }, [alerts, announce])
}
