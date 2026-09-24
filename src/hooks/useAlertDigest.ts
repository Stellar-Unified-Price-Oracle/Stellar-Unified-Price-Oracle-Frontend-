/**
 * @file useAlertDigest (#489).
 *
 * Manages the alert digest subscription (enabled/frequency) and its delivery
 * history, persisted in IndexedDB — deliberately mirroring
 * `useScheduledExports.ts`'s "best-effort client-side schedule" shape (#318) so
 * the two scheduling mechanisms stay conceptually and structurally identical, per
 * #489's "scheduling reuses the scheduled-exports machinery" acceptance
 * criterion. There is no backend cron; a due digest is sent (best-effort)
 * whenever this hook mounts with a fresh subscription, same as scheduled exports.
 *
 * Delivery reuses the existing email channel: the same `/api/notifications/email`
 * endpoint `dispatchEmailChannel` (in `useAlerts.tsx`) posts to for a single
 * alert fire.
 */
import { useCallback, useEffect, useState } from 'react'
import type { Alert, AlertHistoryEntry } from '../types'
import {
  buildAlertDigest,
  computeNextDigestRun,
  renderDigestHtml,
  renderDigestText,
  type DigestFrequency,
} from '../utils/alertDigest'
import { loadNotifConfig } from '../services/notificationConfig'
import { useIdbQuery, useIdbMutation } from './useIdbQuery'

export interface DigestSubscription {
  enabled: boolean
  frequency: DigestFrequency
  createdAt: number
  lastRunAt: number | null
  nextRunAt: number
}

export interface DigestDeliveryEntry {
  id: string
  sentAt: number
  frequency: DigestFrequency
  firedCount: number
  activeCount: number
  trigger: 'scheduled' | 'manual'
  ok: boolean
}

const SUBSCRIPTION_KEY = 'alert-digest-subscription'
const HISTORY_KEY = 'alert-digest-history'
const MAX_HISTORY = 50

const DEFAULT_SUBSCRIPTION: DigestSubscription = {
  enabled: false,
  frequency: 'weekly',
  createdAt: 0,
  lastRunAt: null,
  nextRunAt: 0,
}

export interface UseAlertDigestReturn {
  subscription: DigestSubscription
  history: DigestDeliveryEntry[]
  loading: boolean
  setEnabled: (enabled: boolean) => void
  setFrequency: (frequency: DigestFrequency) => void
  runNow: () => Promise<void>
  unsubscribe: () => void
}

/** Sends a digest email via the same endpoint single-alert notifications use. */
async function deliverDigestEmail(
  address: string,
  html: string,
  text: string,
  frequency: DigestFrequency,
): Promise<boolean> {
  try {
    const res = await fetch('/api/notifications/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: address,
        subject: `Alert digest (${frequency})`,
        message: text,
        html,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Manages the daily/weekly alert digest subscription, delivery, and history (#489). */
export function useAlertDigest(alerts: Alert[], alertHistory: AlertHistoryEntry[]): UseAlertDigestReturn {
  const { data: subData, loading: subLoading } = useIdbQuery<DigestSubscription>('preferences', SUBSCRIPTION_KEY)
  const { data: historyData, loading: historyLoading } = useIdbQuery<DigestDeliveryEntry[]>('preferences', HISTORY_KEY)
  const { set } = useIdbMutation()

  const [subscription, setSubscription] = useState<DigestSubscription>(DEFAULT_SUBSCRIPTION)
  const [history, setHistory] = useState<DigestDeliveryEntry[]>([])

  useEffect(() => {
    if (!subLoading) setSubscription(subData ?? DEFAULT_SUBSCRIPTION)
  }, [subData, subLoading])

  useEffect(() => {
    if (!historyLoading) setHistory(historyData ?? [])
  }, [historyData, historyLoading])

  const persistSubscription = useCallback(
    (next: DigestSubscription) => {
      setSubscription(next)
      void set('preferences', SUBSCRIPTION_KEY, next)
    },
    [set],
  )

  const persistHistoryEntry = useCallback(
    (entry: DigestDeliveryEntry) => {
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, MAX_HISTORY)
        void set('preferences', HISTORY_KEY, next)
        return next
      })
    },
    [set],
  )

  const send = useCallback(
    async (sub: DigestSubscription, trigger: 'scheduled' | 'manual') => {
      const cfg = loadNotifConfig()
      const payload = buildAlertDigest(alertHistory, alerts, sub.frequency)
      const ok =
        cfg.email.enabled && cfg.email.address
          ? await deliverDigestEmail(
              cfg.email.address,
              renderDigestHtml(payload),
              renderDigestText(payload),
              sub.frequency,
            )
          : false

      persistHistoryEntry({
        id: crypto.randomUUID(),
        sentAt: Date.now(),
        frequency: sub.frequency,
        firedCount: payload.fired.length,
        activeCount: payload.active.length,
        trigger,
        ok,
      })
    },
    [alerts, alertHistory, persistHistoryEntry],
  )

  // Best-effort automation: if enabled and due, send on mount / whenever the
  // subscription or underlying alert data changes — same approximation
  // `useScheduledExports` uses for export schedules.
  useEffect(() => {
    if (subLoading || !subscription.enabled) return
    if (subscription.nextRunAt > Date.now()) return

    void send(subscription, 'scheduled').then(() => {
      const now = Date.now()
      persistSubscription({
        ...subscription,
        lastRunAt: now,
        nextRunAt: computeNextDigestRun(subscription.frequency, now),
      })
    })
    // Only re-check when the subscription itself or the data it summarizes changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscription, subLoading, alerts, alertHistory])

  const setEnabled = useCallback(
    (enabled: boolean) => {
      const now = Date.now()
      persistSubscription({
        ...subscription,
        enabled,
        createdAt: subscription.createdAt || now,
        nextRunAt: enabled ? computeNextDigestRun(subscription.frequency, now) : subscription.nextRunAt,
      })
    },
    [subscription, persistSubscription],
  )

  const setFrequency = useCallback(
    (frequency: DigestFrequency) => {
      persistSubscription({ ...subscription, frequency, nextRunAt: computeNextDigestRun(frequency, Date.now()) })
    },
    [subscription, persistSubscription],
  )

  const runNow = useCallback(async () => {
    await send(subscription, 'manual')
    const now = Date.now()
    persistSubscription({
      ...subscription,
      lastRunAt: now,
      nextRunAt: computeNextDigestRun(subscription.frequency, now),
    })
  }, [subscription, send, persistSubscription])

  // #489 — "Unsubscribe works from the digest itself": the digest's unsubscribe
  // link/button both route here, disabling the subscription without deleting its
  // history so the user can see what they unsubscribed from.
  const unsubscribe = useCallback(() => {
    persistSubscription({ ...subscription, enabled: false })
  }, [subscription, persistSubscription])

  return {
    subscription,
    history,
    loading: subLoading || historyLoading,
    setEnabled,
    setFrequency,
    runNow,
    unsubscribe,
  }
}
