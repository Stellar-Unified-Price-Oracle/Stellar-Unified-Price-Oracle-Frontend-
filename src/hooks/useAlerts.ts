import { useState, useCallback, useEffect } from 'react'
import type { Alert } from '../types'

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

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>(loadAlerts)

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

  return { alerts, addAlert, updateAlert, removeAlert, getAlertsForPair, hasAlertsForPair, activeCount }
}
