/**
 * @file useAlertHealth (#493).
 *
 * Wires the pure {@link checkAlertHealth} analysis to real price history and
 * persistence: fetches recent history once per distinct asset pair among the
 * user's active alerts, runs the health check whenever the alert list changes
 * (covers both "on alert creation" and edits) and on a periodic timer (covers
 * "runs periodically"), and remembers dismissed flags so they don't reappear.
 *
 * Deliberately does not touch the notification path — flags are informational
 * only, never routed through `dispatch*Channel` (see acceptance criteria on #493).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Alert, AlertTimeWindow } from '../types'
import { fetchPriceHistory } from '../api/rest'
import { checkAlertHealth, type AlertHealthFlag } from '../utils/alertHealthCheck'
import { readJson, writeJson, STORAGE_KEYS } from '../utils/storage'

/** Lookback window for the history sample used to judge "has this ever happened". */
const HISTORY_DAYS = 30
const HISTORY_LIMIT = 500
/** Re-run the health check this often while the app stays open. */
const RECHECK_INTERVAL_MS = 30 * 60 * 1000

const WINDOW_MS: Record<AlertTimeWindow, number> = {
  '5min': 5 * 60 * 1000,
  '15min': 15 * 60 * 1000,
  '1hr': 60 * 60 * 1000,
  '24hr': 24 * 60 * 60 * 1000,
}

/**
 * Builds the two sample arrays a pair's alerts are checked against: raw price
 * levels, and percentage-change magnitudes over `window` between points spaced
 * roughly `window` apart (a coarse but dependency-free stand-in for the rolling
 * baseline computation `useAlerts` does live).
 */
function samplesFromHistory(
  points: { price: number; timestamp: number }[],
  window: AlertTimeWindow,
): { prices: number[]; pctChanges: number[] } {
  const prices = points.map((p) => p.price)
  const pctChanges: number[] = []
  const spacing = WINDOW_MS[window]

  let anchorIdx = 0
  for (let i = 1; i < points.length; i++) {
    if (points[i].timestamp - points[anchorIdx].timestamp < spacing) continue
    const base = points[anchorIdx].price
    if (base !== 0) pctChanges.push(((points[i].price - base) / base) * 100)
    anchorIdx = i
  }
  return { prices, pctChanges }
}

/** Reads dismissed flag ids (`${alertId}:${checkedAt-bucket}` is overkill — keyed by alertId is enough: a re-dismiss after a real edit is fine). */
function loadDismissed(): Set<string> {
  return new Set(readJson<string[]>(STORAGE_KEYS.alertHealthDismissed, []))
}

function saveDismissed(ids: Set<string>): void {
  writeJson(STORAGE_KEYS.alertHealthDismissed, [...ids])
}

export interface UseAlertHealthReturn {
  /** Active, undismissed health flags, one per unhealthy alert. */
  flags: AlertHealthFlag[]
  loading: boolean
  /** Hides a flag until the alert is next edited (conditions change) — see #493 "Flags are dismissible". */
  dismiss: (alertId: string) => void
}

/**
 * Runs alert health checks for `alerts` and exposes the current (undismissed)
 * flags. Percentage-mode conditions are checked against the alert's own
 * configured window; absolute conditions against raw price levels.
 */
export function useAlertHealth(alerts: Alert[]): UseAlertHealthReturn {
  const [flags, setFlags] = useState<AlertHealthFlag[]>([])
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed)
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const runCheck = useCallback(async () => {
    const active = alerts.filter((a) => a.active && a.conditionGroup)
    if (active.length === 0) {
      setFlags([])
      return
    }

    setLoading(true)
    try {
      const pairs = [...new Set(active.map((a) => a.assetPair))]
      const historyByPair = new Map<string, { price: number; timestamp: number }[]>()

      await Promise.all(
        pairs.map(async (pair) => {
          try {
            const res = await fetchPriceHistory(pair, HISTORY_LIMIT)
            const cutoff = Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000
            historyByPair.set(
              pair,
              res.history.filter((h) => h.timestamp >= cutoff).map((h) => ({ price: h.price, timestamp: h.timestamp })),
            )
          } catch {
            // Best-effort: a pair whose history fails to load is simply skipped
            // (not enough samples ⇒ "insufficientHistory", not a false "never fires").
            historyByPair.set(pair, [])
          }
        }),
      )

      const nextFlags = active
        .map((alert) => {
          const points = historyByPair.get(alert.assetPair) ?? []
          const window = alert.percentageWindow ?? '1hr'
          const { prices, pctChanges } = samplesFromHistory(points, window)
          return checkAlertHealth(alert, prices, pctChanges)
        })
        .filter((f): f is AlertHealthFlag => f !== null)

      setFlags(nextFlags)
    } finally {
      setLoading(false)
    }
  }, [alerts])

  // On alert-list change (covers creation/edit) …
  useEffect(() => {
    void runCheck()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts])

  // … and periodically while the app stays open.
  useEffect(() => {
    timerRef.current = setInterval(() => void runCheck(), RECHECK_INTERVAL_MS)
    return () => clearInterval(timerRef.current)
  }, [runCheck])

  const dismiss = useCallback((alertId: string) => {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(alertId)
      saveDismissed(next)
      return next
    })
  }, [])

  return { flags: flags.filter((f) => !dismissed.has(f.alertId)), loading, dismiss }
}
