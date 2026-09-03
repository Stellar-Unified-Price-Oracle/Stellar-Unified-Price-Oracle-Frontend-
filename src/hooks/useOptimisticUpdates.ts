/**
 * Hooks for optimistic updates in preferences and alerts.
 * Provides instant UI feedback while changes are being persisted.
 */

import { useCallback } from 'react'
import { usePreferences } from '../preferences/PreferencesContext'
import { useAlerts } from './useAlerts'
import type { Preferences } from '../preferences/types'
import type { Alert, AlertSnoozeDuration } from '../types'

/**
 * Hook for optimistic preference updates.
 * Immediately updates UI while persisting to storage in the background.
 *
 * @returns Object with optimistic preference update functions
 *
 * @example
 * ```tsx
 * const { updatePreferenceOptimistic } = useOptimisticPreferences()
 *
 * // Update immediately (with visual feedback)
 * await updatePreferenceOptimistic('theme', 'dark')
 * ```
 */
export function useOptimisticPreferences() {
  const { preferences, updatePreference } = usePreferences()

  const updatePreferenceOptimistic = useCallback(
    async <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      // Step 1: Update immediately (optimistic)
      const previousValue = preferences[key]
      updatePreference(key, value)

      // Step 2: Persist to storage (automatic via PreferencesContext)
      // No server call needed currently, but ready for future API integration

      return {
        success: true,
        data: value,
        rollback: () => updatePreference(key, previousValue),
      }
    },
    [preferences, updatePreference],
  )

  return { updatePreferenceOptimistic }
}

/**
 * Hook for optimistic alert operations.
 * Immediately updates UI while persisting to storage in the background.
 *
 * @returns Object with optimistic alert update functions
 *
 * @example
 * ```tsx
 * const { addAlertOptimistic, removeAlertOptimistic } = useOptimisticAlerts()
 *
 * // Add alert (shows immediately)
 * const newAlert = await addAlertOptimistic({
 *   assetPair: 'BTC/USD',
 *   upperThreshold: 60000,
 *   lowerThreshold: null,
 *   active: true,
 * })
 * ```
 */
export function useOptimisticAlerts() {
  const {
    alerts,
    addAlert,
    updateAlert,
    removeAlert,
    snoozeAlert,
    unsnoozeAlert,
  } = useAlerts()

  /**
   * Optimistically add an alert
   */
  const addAlertOptimistic = useCallback(
    async (
      alert: Omit<
        Alert,
        | 'id'
        | 'createdAt'
        | 'lastTriggeredAt'
        | 'fireCount'
        | 'snoozedUntil'
        | 'percentageBaselinePrice'
        | 'percentageBaselineTimestamp'
      >,
    ) => {
      const newAlert = addAlert(alert)

      if (!newAlert) {
        return { success: false, error: 'Alert creation rate limited' }
      }

      return {
        success: true,
        data: newAlert,
        rollback: () => removeAlert(newAlert.id),
      }
    },
    [addAlert, removeAlert],
  )

  /**
   * Optimistically remove an alert
   */
  const removeAlertOptimistic = useCallback(
    async (id: string) => {
      const alertToRemove = alerts.find((a) => a.id === id)
      if (!alertToRemove) {
        return { success: false, error: 'Alert not found' }
      }

      removeAlert(id)

      return {
        success: true,
        data: null,
        rollback: () => addAlert(alertToRemove),
      }
    },
    [alerts, removeAlert, addAlert],
  )

  /**
   * Optimistically toggle alert active state
   */
  const toggleAlertOptimistic = useCallback(
    async (id: string) => {
      const alert = alerts.find((a) => a.id === id)
      if (!alert) {
        return { success: false, error: 'Alert not found' }
      }

      const newActive = !alert.active
      updateAlert(id, { active: newActive })

      return {
        success: true,
        data: { id, active: newActive },
        rollback: () => updateAlert(id, { active: alert.active }),
      }
    },
    [alerts, updateAlert],
  )

  /**
   * Optimistically snooze an alert
   */
  const snoozeAlertOptimistic = useCallback(
    async (id: string, duration: AlertSnoozeDuration) => {
      const alert = alerts.find((a) => a.id === id)
      if (!alert) {
        return { success: false, error: 'Alert not found' }
      }

      const previousSnooze = alert.snoozedUntil
      snoozeAlert(id, duration)

      return {
        success: true,
        data: { id, snoozedUntil: duration },
        rollback: () =>
          updateAlert(id, { snoozedUntil: previousSnooze || null }),
      }
    },
    [alerts, snoozeAlert, updateAlert],
  )

  /**
   * Optimistically unsnooze an alert
   */
  const unsnoozeAlertOptimistic = useCallback(
    async (id: string) => {
      const alert = alerts.find((a) => a.id === id)
      if (!alert) {
        return { success: false, error: 'Alert not found' }
      }

      const previousSnooze = alert.snoozedUntil
      unsnoozeAlert(id)

      return {
        success: true,
        data: { id },
        rollback: () =>
          updateAlert(id, { snoozedUntil: previousSnooze || null }),
      }
    },
    [alerts, unsnoozeAlert, updateAlert],
  )

  return {
    addAlertOptimistic,
    removeAlertOptimistic,
    toggleAlertOptimistic,
    snoozeAlertOptimistic,
    unsnoozeAlertOptimistic,
  }
}
