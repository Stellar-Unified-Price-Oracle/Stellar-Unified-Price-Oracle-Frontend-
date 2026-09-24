/**
 * #463 – AnomalyBanner: displays detected anomalies from price history and lets
 * users create a one-click alert around the anomalous level.
 *
 * Also records each anomaly event into the alert history log so the
 * AlertHistoryLog component shows it alongside fired alerts.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { detectAnomalies, anomalySeverity } from '../utils/anomalyDetection'
import type { AnomalyEvent } from '../utils/anomalyDetection'
import { useAlerts } from '../hooks/useAlerts'
import {
  appendHistoryEntries,
  loadAlertHistory,
  saveAlertHistory,
} from '../services/alertHistory'
import type { PriceHistoryEntry } from '../types/price'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AnomalyBannerProps {
  /** Price history to scan (oldest first). */
  history: PriceHistoryEntry[]
  /** Asset pair label shown in the banner and alert. */
  pair: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Persist an anomaly event to the alert history log as a synthetic entry. */
function recordAnomalyToHistory(event: AnomalyEvent, pair: string): void {
  const existing = loadAlertHistory()
  // Avoid duplicate entries for the same timestamp
  const alreadyLogged = existing.some(
    (e) => e.assetPair === pair && e.triggeredAt === event.timestamp && (e as { anomaly?: unknown }).anomaly,
  )
  if (alreadyLogged) return

  const entry = {
    id: crypto.randomUUID(),
    alertId: `anomaly:${pair}:${event.timestamp}`,
    assetPair: pair,
    triggeredAt: event.timestamp,
    price: event.price,
    triggerOnce: true,
    percentageMode: false,
    upperThreshold: null,
    lowerThreshold: null,
    percentageThreshold: null,
    percentageWindow: null,
    percentageDirection: null,
    escalation: null,
    retest: null,
    // Non-standard field — used only for de-dup above; ignored by history renderer.
    anomaly: { reasons: event.reasons, explanation: event.explanation },
  }

  saveAlertHistory(appendHistoryEntries(existing, [entry as Parameters<typeof appendHistoryEntries>[1][0]]))
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const AnomalyBanner = memo(function AnomalyBanner({ history, pair }: AnomalyBannerProps) {
  const { addAlert } = useAlerts()
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  const [createdAlerts, setCreatedAlerts] = useState<Set<number>>(new Set())
  const loggedRef = useRef<Set<number>>(new Set())

  const anomalies = useMemo(
    () =>
      detectAnomalies(history, {
        zScoreWindow: 20,
        zScoreThreshold: 3,
        gapThresholdPercent: 5,
        detectSourceDrop: true,
      }),
    [history],
  )

  // Log new anomaly events to the alert history once
  useEffect(() => {
    for (const event of anomalies) {
      if (!loggedRef.current.has(event.timestamp)) {
        loggedRef.current.add(event.timestamp)
        recordAnomalyToHistory(event, pair)
      }
    }
  }, [anomalies, pair])

  const visible = useMemo(
    () => anomalies.filter((a) => !dismissed.has(a.timestamp)).slice(0, 5),
    [anomalies, dismissed],
  )

  const handleCreateAlert = useCallback(
    (event: AnomalyEvent) => {
      const margin = event.price * 0.02 // ±2% band around the anomalous level
      addAlert({
        assetPair: pair,
        upperThreshold: event.price + margin,
        lowerThreshold: event.price - margin,
        triggerOnce: false,
        percentageMode: false,
        percentageThreshold: null,
        percentageWindow: null,
        percentageDirection: null,
        percentageRelativeTo: null,
        active: true,
        cooldownMinutes: 60,
        conditionGroup: null,
        escalationPolicy: null,
        retestMode: false,
      })
      setCreatedAlerts((prev) => new Set(prev).add(event.timestamp))
    },
    [addAlert, pair],
  )

  const handleDismiss = useCallback((timestamp: number) => {
    setDismissed((prev) => new Set(prev).add(timestamp))
  }, [])

  if (visible.length === 0) return null

  return (
    <div className="flex flex-col gap-2 mb-4" role="region" aria-label="Price anomalies">
      {visible.map((event) => {
        const severity = anomalySeverity(event)
        const isCritical = severity === 'critical'
        const alertCreated = createdAlerts.has(event.timestamp)

        return (
          <div
            key={event.timestamp}
            className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${
              isCritical
                ? 'bg-red-900/20 border-red-800/50 text-red-300'
                : 'bg-amber-900/20 border-amber-800/50 text-amber-300'
            }`}
            role="alert"
          >
            {/* Icon */}
            <svg
              className={`w-4 h-4 mt-0.5 shrink-0 ${isCritical ? 'text-red-400' : 'text-amber-400'}`}
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-xs font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                    isCritical
                      ? 'bg-red-500/20 text-red-300 border-red-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {isCritical ? 'Critical' : 'Warning'}
                </span>
                <span className="font-mono text-xs text-gray-400">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
                <span className="font-mono text-xs text-gray-300">
                  ${event.price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-gray-300">{event.explanation}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {alertCreated ? (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Alert set
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleCreateAlert(event)}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    isCritical
                      ? 'border-red-700 text-red-300 hover:bg-red-800/30'
                      : 'border-amber-700 text-amber-300 hover:bg-amber-800/30'
                  }`}
                  aria-label={`Create alert around $${event.price.toFixed(4)}`}
                >
                  + Alert
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDismiss(event.timestamp)}
                className="p-1 rounded text-gray-500 hover:text-gray-300 transition-colors"
                aria-label="Dismiss this anomaly"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )
      })}
      {anomalies.length > 5 && dismissed.size === 0 && (
        <p className="text-xs text-gray-500 text-center">
          +{anomalies.length - 5} more anomalies in this range
        </p>
      )}
    </div>
  )
})
