import { useState, useCallback, useEffect, createContext, useContext, ReactNode } from 'react'
import type { Alert, AlertsContextType } from '../types'
import { usePriceContext } from '../context/PriceContext'
import { computeDivergence, buildSourcePriceMap } from '../utils/divergence'

const STORAGE_KEY = 'price-alerts'
/** Minimum ms between successive divergence alert fires for the same pair (5 minutes). */
const DIVERGENCE_COOLDOWN_MS = 5 * 60 * 1000

function loadAlerts(): Alert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Alert[]
    // Back-fill divergenceThreshold for alerts created before #458
    return parsed.map((a) => ({
      ...a,
      divergenceThreshold: a.divergenceThreshold ?? null,
    }))
  } catch {
    return []
  }
}

function saveAlerts(alerts: Alert[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts))
}

const AlertsContext = createContext<AlertsContextType | null>(null)

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>(loadAlerts)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  // Real-time price context
  const { livePrices } = usePriceContext()

  // Evaluate alerts against live prices (price threshold + divergence threshold)
  useEffect(() => {
    let changed = false
    const now = Date.now()

    const newAlerts = alerts.map((alert) => {
      if (!alert.active) return alert

      const livePriceData = livePrices.get(alert.assetPair)
      if (!livePriceData) return alert

      const currentPrice = livePriceData.data.price
      let triggered = false

      // --- Price threshold checks ---
      if (alert.upperThreshold !== null && currentPrice >= alert.upperThreshold) {
        triggered = true
      } else if (alert.lowerThreshold !== null && currentPrice <= alert.lowerThreshold) {
        triggered = true
      }

      // --- Divergence threshold check ---
      if (!triggered && alert.divergenceThreshold !== null) {
        const sourceMap = buildSourcePriceMap(currentPrice, livePriceData.data.sources)
        const { maxDeviationPct } = computeDivergence(sourceMap)

        if (maxDeviationPct >= alert.divergenceThreshold) {
          // Respect cooldown: only fire if enough time has elapsed since last trigger
          const cooldownExpired =
            alert.lastTriggeredAt === null ||
            now - alert.lastTriggeredAt >= DIVERGENCE_COOLDOWN_MS

          if (cooldownExpired) {
            triggered = true
          }
        }
      }

      if (triggered && alert.lastTriggeredAt === null) {
        // Just triggered now — fire browser notification
        changed = true

        if (Notification.permission === 'granted') {
          const body = alert.divergenceThreshold !== null
            ? `${alert.assetPair} oracle divergence exceeded ${alert.divergenceThreshold}%! Current price: $${currentPrice}`
            : `${alert.assetPair} has crossed your threshold! Current price: $${currentPrice}`
          new Notification('Price Alert Triggered', { body })
        }

        return {
          ...alert,
          lastTriggeredAt: now,
          active: !alert.triggerOnce,
        }
      }

      // Reset lastTriggeredAt if price falls back out of range (enables re-triggering)
      if (!triggered && alert.lastTriggeredAt !== null && !alert.triggerOnce) {
        // For divergence alerts honour cooldown before resetting
        if (alert.divergenceThreshold !== null) {
          const cooldownExpired = now - alert.lastTriggeredAt >= DIVERGENCE_COOLDOWN_MS
          if (!cooldownExpired) return alert
        }
        changed = true
        return { ...alert, lastTriggeredAt: null }
      }

      return alert
    })

    if (changed) {
      setAlerts(newAlerts)
    }
  }, [livePrices, alerts])

  // Request notification permissions
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    saveAlerts(alerts)
  }, [alerts])

  const addAlert = useCallback((alert: Omit<Alert, 'id' | 'createdAt' | 'lastTriggeredAt'>) => {
    const newAlert: Alert = {
      ...alert,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      lastTriggeredAt: null,
    }
    setAlerts((prev) => [...prev, newAlert])
    return newAlert
  }, [])

  const updateAlert = useCallback((id: string, updates: Partial<Omit<Alert, 'id' | 'createdAt'>>) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)))
  }, [])

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const getAlertsForPair = useCallback(
    (assetPair: string) => alerts.filter((a) => a.assetPair === assetPair && a.active),
    [alerts],
  )

  const activeCount = alerts.filter((a) => a.active).length

  const hasAlertsForPair = useCallback(
    (assetPair: string) => alerts.some((a) => a.assetPair === assetPair && a.active),
    [alerts],
  )

  const togglePanel = useCallback(() => setIsPanelOpen((p) => !p), [])

  const markAsRead = useCallback((_id: string) => {
    // lastTriggeredAt already marks a triggered alert; kept as no-op for interface compat.
  }, [])

  const value = {
    alerts,
    addAlert,
    updateAlert,
    removeAlert,
    getAlertsForPair,
    hasAlertsForPair,
    activeCount,
    isPanelOpen,
    togglePanel,
    markAsRead,
  }

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>
}

export function useAlerts() {
  const context = useContext(AlertsContext)
  if (!context) {
    throw new Error('useAlerts must be used within an AlertsProvider')
  }
  return context
}
