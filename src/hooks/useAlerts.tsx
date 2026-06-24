import { useState, useCallback, useEffect, createContext, useContext, ReactNode } from 'react'
import type { Alert, AlertsContextType } from '../types'
import { usePriceContext } from '../context/PriceContext'

const STORAGE_KEY = 'price-alerts'

function loadAlerts(): Alert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Alert[]) : []
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

  // Evaluate alerts against live prices
  useEffect(() => {
    let changed = false
    const newAlerts = alerts.map((alert) => {
      if (!alert.active) return alert

      const livePriceData = livePrices.get(alert.assetPair)
      if (!livePriceData) return alert
      
      const currentPrice = livePriceData.price
      let triggered = false

      if (alert.upperThreshold !== null && currentPrice >= alert.upperThreshold) {
        triggered = true
      } else if (alert.lowerThreshold !== null && currentPrice <= alert.lowerThreshold) {
        triggered = true
      }

      if (triggered && alert.lastTriggeredAt === null) {
        // Just triggered now
        changed = true
        
        // Show browser notification
        if (Notification.permission === 'granted') {
          new Notification('Price Alert Triggered', {
            body: `${alert.assetPair} has crossed your threshold! Current price: $${currentPrice}`,
          })
        }

        return {
          ...alert,
          lastTriggeredAt: Date.now(),
          active: !alert.triggerOnce // Disable if triggerOnce is true
        }
      }

      // Reset lastTriggeredAt if price falls back out of range (so it can trigger again later)
      if (!triggered && alert.lastTriggeredAt !== null && !alert.triggerOnce) {
        changed = true
        return {
          ...alert,
          lastTriggeredAt: null
        }
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
    // In the new system, lastTriggeredAt marks it. We can just keep it as is,
    // or maybe add an unread state if we wanted. For now, it's just a placeholder to resolve types.
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
    markAsRead
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
