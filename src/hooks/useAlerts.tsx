import { useState, useCallback, useEffect, createContext, useContext, ReactNode } from 'react'
import type { Alert, AlertHistoryEntry, AlertsContextType, AlertSnoozeDuration, EscalationStep, PriceEvaluationState } from '../types'
import { migrateLegacyAlertConditions } from '../types/alerts'
import { usePriceContext } from '../context/PriceContext'
import { AlertsArraySchema } from '../api/schemas'
import { createBroadcastChannel } from '../utils/broadcastChannel'
import { readRaw, writeJson, STORAGE_KEYS } from '../utils/storage'
import { playAlertSound, unlockAudioContext } from '../utils/alertSound'
import { loadSoundPreferences } from '../utils/soundPreferences'
import { evaluateCompoundCondition } from '../utils/alertEvaluator'
import {
  loadAlertHistory,
  saveAlertHistory,
  buildTriggerHistoryEntry,
  buildEscalationHistoryEntry,
  appendHistoryEntries,
} from '../services/alertHistory'
import { loadBotSecrets, sendTelegramMessage, sendDiscordMessage } from '../services/botNotifications'
import { loadNotifConfig, resolveAlertChannels, type NotifConfig } from '../services/notificationConfig'
import { stepRetest, initialRetestState } from '../utils/retestDetector'
import { computeSourceSpread, buildSourcePriceMap } from '../utils/sourceSpread'
import { useRateLimit } from './useRateLimit'
// #458 – inter-oracle source spread (distinct from the on-chain divergence in utils/divergence.ts)

const alertsChannel = createBroadcastChannel<Alert[]>('kiro-alerts')
const alertsHistoryChannel = createBroadcastChannel<AlertHistoryEntry[]>('kiro-alerts-history')

/** Minimum ms between successive divergence alert fires for the same pair (5 minutes). */
const DIVERGENCE_COOLDOWN_MS = 5 * 60 * 1000

function alertMessage(alert: Alert, currentPrice: number): string {
  if (alert.divergenceThreshold !== null) {
    return `${alert.assetPair} oracle divergence exceeded ${alert.divergenceThreshold}%! Current price: $${currentPrice.toFixed(4)}`
  }
  return alert.percentageMode
    ? `${alert.assetPair} moved ${alert.percentageThreshold ?? 0}% in ${alert.percentageWindow ?? '1hr'}! Current: $${currentPrice.toFixed(4)}`
    : `${alert.assetPair} crossed your threshold! Current price: $${currentPrice.toFixed(4)}`
}

// ── Per-channel dispatchers (#315, extended with Telegram/Discord for #488) ────

function dispatchWebPushChannel(cfg: NotifConfig, body: string): void {
  if (cfg.webPush.enabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification('Price Alert Triggered', { body })
  }
}

async function dispatchEmailChannel(cfg: NotifConfig, alert: Alert, currentPrice: number, body: string): Promise<void> {
  if (!cfg.email.enabled || !cfg.email.address) return
  try {
    await fetch('/api/notifications/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: cfg.email.address, subject: 'Price Alert Triggered', message: body, assetPair: alert.assetPair, price: currentPrice }),
    })
  } catch {
    // Best-effort; don't let a network error break the alert system
  }
}

async function dispatchWebhookChannel(cfg: NotifConfig, alert: Alert, currentPrice: number, body: string): Promise<void> {
  if (!cfg.webhook.enabled || !cfg.webhook.url) return
  try {
    await fetch(cfg.webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'alert_triggered', assetPair: alert.assetPair, price: currentPrice, message: body, alertId: alert.id, timestamp: Date.now() }),
    })
  } catch {
    // Best-effort
  }
}

async function dispatchTelegramChannel(
  cfg: NotifConfig,
  alert: Alert,
  currentPrice: number,
  body: string,
  escalation?: { stepId: string; delayMinutes: number },
): Promise<void> {
  if (!cfg.telegram.enabled || !cfg.telegram.chatId) return
  const { telegramBotToken } = loadBotSecrets()
  await sendTelegramMessage(
    { chatId: cfg.telegram.chatId, enabled: cfg.telegram.enabled },
    telegramBotToken,
    { assetPair: alert.assetPair, price: currentPrice, message: body, timestamp: Date.now(), escalation },
  )
}

async function dispatchDiscordChannel(
  cfg: NotifConfig,
  alert: Alert,
  currentPrice: number,
  body: string,
  escalation?: { stepId: string; delayMinutes: number },
): Promise<void> {
  if (!cfg.discord.enabled) return
  const { discordWebhookUrl } = loadBotSecrets()
  await sendDiscordMessage(
    { channelId: cfg.discord.channelId, enabled: cfg.discord.enabled },
    discordWebhookUrl,
    { assetPair: alert.assetPair, price: currentPrice, message: body, timestamp: Date.now(), escalation },
  )
}

/**
 * #315/#488/#492 – Fire the notification channels an alert routes to
 * (its initial fire or a persistent re-fire — not an individual escalation step,
 * see {@link dispatchEscalationStep}). Channel selection follows
 * `resolveAlertChannels` (#492): an alert's explicit `channels` override wins,
 * otherwise every currently-enabled global channel fires.
 */
async function dispatchNotifications(alert: Alert, currentPrice: number): Promise<void> {
  const cfg = loadNotifConfig()
  const body = alertMessage(alert, currentPrice)
  const targets = resolveAlertChannels(cfg, alert.channels)
  await Promise.all([
    targets.has('email') ? dispatchEmailChannel(cfg, alert, currentPrice, body) : Promise.resolve(),
    targets.has('webhook') ? dispatchWebhookChannel(cfg, alert, currentPrice, body) : Promise.resolve(),
    targets.has('telegram') ? dispatchTelegramChannel(cfg, alert, currentPrice, body) : Promise.resolve(),
    targets.has('discord') ? dispatchDiscordChannel(cfg, alert, currentPrice, body) : Promise.resolve(),
  ])
  if (targets.has('webPush')) {
    dispatchWebPushChannel(cfg, body)
  }
}

/**
 * #487/#488 – Fire exactly one escalation step's channel. `inApp` is a no-op here:
 * the base trigger above already covers the in-app sound/notification, so an
 * `inApp` step exists purely to appear first in the escalation timeline/UI without
 * duplicating that side effect.
 */
async function dispatchEscalationStep(alert: Alert, step: EscalationStep, currentPrice: number): Promise<void> {
  if (step.channel === 'inApp') return
  const cfg = loadNotifConfig()
  const body = alertMessage(alert, currentPrice)
  const escalation = { stepId: step.id, delayMinutes: step.delayMinutes }
  switch (step.channel) {
    case 'email':
      return dispatchEmailChannel(cfg, alert, currentPrice, body)
    case 'webhook':
      return dispatchWebhookChannel(cfg, alert, currentPrice, body)
    case 'webPush':
      return dispatchWebPushChannel(cfg, body)
    case 'telegram':
      return dispatchTelegramChannel(cfg, alert, currentPrice, body, escalation)
    case 'discord':
      return dispatchDiscordChannel(cfg, alert, currentPrice, body, escalation)
  }
}

/** Compute snooze expiry timestamp from a duration string */
function snoozeDurationMs(duration: AlertSnoozeDuration): number {
  const now = Date.now()
  switch (duration) {
    case '15min':
      return now + 15 * 60 * 1000
    case '1hr':
      return now + 60 * 60 * 1000
    case '4hr':
      return now + 4 * 60 * 60 * 1000
    case '24hr':
      return now + 24 * 60 * 60 * 1000
    case 'tomorrow': {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(8, 0, 0, 0)
      return tomorrow.getTime()
    }
  }
}

/** Returns the window duration in milliseconds for a percentage alert window */
function windowMs(window: string): number {
  switch (window) {
    case '5min':  return 5 * 60 * 1000
    case '15min': return 15 * 60 * 1000
    case '1hr':   return 60 * 60 * 1000
    case '24hr':  return 24 * 60 * 60 * 1000
    default:      return 60 * 60 * 1000
  }
}

function loadAlerts(): Alert[] {
  try {
    const raw = readRaw(STORAGE_KEYS.alerts)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    const result = AlertsArraySchema.safeParse(parsed)
    if (!result.success) {
      console.warn('[useAlerts] Invalid alerts in localStorage, resetting:', result.error.issues)
      return []
    }
    // Zod fills in defaults for new fields on legacy data. #485 – transparently
    // migrate any alert that predates compound conditions into a ConditionGroup,
    // so the evaluation loop below has one code path regardless of an alert's age.
    return (result.data as Alert[]).map((alert) =>
      alert.conditionGroup ? alert : { ...alert, conditionGroup: migrateLegacyAlertConditions(alert) },
    )
  } catch {
    return []
  }
}

function saveAlerts(alerts: Alert[]): void {
  writeJson(STORAGE_KEYS.alerts, alerts)
}

const AlertsContext = createContext<AlertsContextType | null>(null)

/**
 * Provides the {@link AlertsContextType} to its subtree.
 *
 * Persists alerts to `localStorage` and evaluates them against live prices from
 * {@link usePriceContext}. Handles:
 *  - Absolute threshold alerts (upper/lower)
 *  - Divergence alerts: fires when the inter-oracle spread exceeds a threshold (#458)
 *  - Percentage-based movement alerts (#307)
 *  - Compound AND/OR condition groups, with transparent legacy migration (#485)
 *  - One-time vs persistent alerts with fire counts (#312)
 *  - Alert snooze with auto-unsnooze (#313)
 *  - Cooldown between re-fires of a persistent alert (#310)
 *  - Multi-tier escalation policies while a breach stays active (#487)
 *  - A capped history log of fired alerts and escalation steps (#309, #487)
 *
 * Must be rendered inside `PriceProvider`.
 */
export function AlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>(loadAlerts)
  const [history, setHistory] = useState<AlertHistoryEntry[]>(loadAlertHistory)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  const { livePrices } = usePriceContext()

  // Rate limiter for alert creation (max 5 per minute)
  const alertRateLimit = useRateLimit('alertCreate')

  // Auto-unsnooze expired snoozes every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setAlerts((prev) => {
        const changed = prev.some((a) => a.snoozedUntil !== null && a.snoozedUntil <= now)
        if (!changed) return prev
        return prev.map((a) =>
          a.snoozedUntil !== null && a.snoozedUntil <= now
            ? { ...a, snoozedUntil: null }
            : a,
        )
      })
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  // Evaluate alerts against live prices
  useEffect(() => {
    let changed = false
    const now = Date.now()
    const firedEntries: AlertHistoryEntry[] = []

    const newAlerts = alerts.map((alert) => {
      // Skip inactive alerts
      if (!alert.active) return alert

      // Skip snoozed alerts
      if (alert.snoozedUntil !== null && alert.snoozedUntil > now) return alert

      const livePriceData = livePrices.get(alert.assetPair)
      if (!livePriceData) return alert

      const currentPrice = livePriceData.data.price
      let updatedAlert = { ...alert }
      let triggered = false

      // ── Divergence alert evaluation (#458) ──────────────────────────────
      // Handled separately from the compound evaluator since it measures
      // inter-oracle spread rather than a price-vs-threshold comparison.
      if (alert.divergenceThreshold !== null) {
        const sourceMap = buildSourcePriceMap(currentPrice, livePriceData.data.sources)
        const { maxDeviationPct } = computeSourceSpread(sourceMap)

        if (maxDeviationPct >= alert.divergenceThreshold) {
          // Respect a fixed cooldown: only fire if enough time has elapsed.
          const cooldownExpired =
            alert.lastTriggeredAt === null ||
            now - alert.lastTriggeredAt >= DIVERGENCE_COOLDOWN_MS

          if (cooldownExpired) {
            changed = true
            void dispatchNotifications(updatedAlert, currentPrice)
            const soundPrefs = loadSoundPreferences()
            if (soundPrefs.enabled) playAlertSound(soundPrefs.volume)
            firedEntries.push(buildTriggerHistoryEntry(updatedAlert, currentPrice, now))
            return {
              ...updatedAlert,
              fireCount: (updatedAlert.fireCount ?? 0) + 1,
              lastTriggeredAt: now,
              active: !alert.triggerOnce,
            }
          }
        } else if (alert.lastTriggeredAt !== null && !alert.triggerOnce) {
          // Spread back in range — re-arm for next breach.
          const cooldownExpired = now - alert.lastTriggeredAt >= DIVERGENCE_COOLDOWN_MS
          if (cooldownExpired) {
            changed = true
            return { ...updatedAlert, lastTriggeredAt: null }
          }
        }
        return updatedAlert
      }

      if (alert.percentageMode) {
        // ── Percentage-based alert evaluation (#307) ──────────────────────
        const window = alert.percentageWindow ?? '1hr'
        const windowDuration = windowMs(window)

        // Initialise or refresh baseline if it's expired
        if (
          alert.percentageBaselinePrice === null ||
          alert.percentageBaselineTimestamp === null ||
          now - alert.percentageBaselineTimestamp >= windowDuration
        ) {
          // Set new baseline; don't trigger on the same tick as baseline reset
          changed = true
          return {
            ...updatedAlert,
            percentageBaselinePrice: currentPrice,
            percentageBaselineTimestamp: now,
            lastTriggeredAt: null,
          }
        }

        const baseline = alert.percentageBaselinePrice
        const pctChange = baseline !== 0 ? ((currentPrice - baseline) / baseline) * 100 : 0

        // #485 – compound evaluation against the alert's (possibly legacy-migrated) condition group
        const group = updatedAlert.conditionGroup ?? migrateLegacyAlertConditions(updatedAlert)
        const state: PriceEvaluationState = { price: currentPrice, percentageChange: { [window]: pctChange } }
        triggered = evaluateCompoundCondition(group, state)
      } else {
        // ── Absolute threshold evaluation, via the compound evaluator (#485) ─
        const group = updatedAlert.conditionGroup ?? migrateLegacyAlertConditions(updatedAlert)
        const state: PriceEvaluationState = { price: currentPrice }
        triggered = evaluateCompoundCondition(group, state)
      }

      // ── Price-level retest detection (#491) ──────────────────────────────
      // Runs every tick on the evaluated `triggered` boolean. Advances the alert's
      // retest state machine and records the breach/exit/retest sequence to
      // history. When `retestMode` is enabled, a `retest` event fires the alert.
      const retestPrev = updatedAlert.retestState
      const stepped = stepRetest(retestPrev ?? initialRetestState(now), triggered, currentPrice, now)
      const retestEvent = stepped.event
      const retestChanged =
        retestEvent !== null ||
        retestPrev === null ||
        retestPrev.phase !== stepped.state.phase ||
        retestPrev.cycles !== stepped.state.cycles
      if (retestChanged) changed = true
      updatedAlert = { ...updatedAlert, retestState: stepped.state }

      if (retestEvent) {
        if (retestEvent.kind === 'retest' && updatedAlert.retestMode) {
          // retest-mode: fire on re-entry to the previously-breached zone.
          void dispatchNotifications(updatedAlert, currentPrice)
          const soundPrefs = loadSoundPreferences()
          if (soundPrefs.enabled) playAlertSound(soundPrefs.volume)
          const newFireCount = (updatedAlert.fireCount ?? 0) + 1
          updatedAlert = {
            ...updatedAlert,
            fireCount: newFireCount,
            lastTriggeredAt: now,
            active: !updatedAlert.triggerOnce,
          }
          firedEntries.push(
            buildTriggerHistoryEntry(updatedAlert, currentPrice, now, { kind: 'retest', cycle: retestEvent.cycle }),
          )
        } else {
          // Record the sequence (breach / exit / non-firing retest) in history so
          // the panel can show exactly how the threshold was revisited.
          firedEntries.push(
            buildTriggerHistoryEntry(updatedAlert, currentPrice, now, { kind: retestEvent.kind, cycle: retestEvent.cycle }),
          )
        }
      }

      // Minimum time between re-fires of a persistent alert (#310) — prevents
      // notification spam when the price oscillates around the threshold.
      const cooldownMs = Math.max(0, alert.cooldownMinutes ?? 5) * 60_000

      // ── Escalation policy (#487) ──────────────────────────────────────────
      // Runs whenever the condition is currently true, independent of the
      // triggerOnce/cooldown gate below, so later tiers keep firing while a
      // persistent breach continues even between re-fires of the base alert.
      if (triggered && updatedAlert.escalationPolicy?.enabled) {
        let escalationState = updatedAlert.escalationState ?? { breachStartedAt: now, firedStepIds: [] }
        if (updatedAlert.escalationState === null) changed = true

        const elapsedMinutes = (now - escalationState.breachStartedAt) / 60_000
        let firedStepIds = escalationState.firedStepIds
        for (const step of updatedAlert.escalationPolicy.steps) {
          if (elapsedMinutes >= step.delayMinutes && !firedStepIds.includes(step.id)) {
            changed = true
            firedStepIds = [...firedStepIds, step.id]
            firedEntries.push(buildEscalationHistoryEntry(updatedAlert, step, currentPrice, now))
            void dispatchEscalationStep(updatedAlert, step, currentPrice)
          }
        }
        escalationState = { ...escalationState, firedStepIds }
        updatedAlert = { ...updatedAlert, escalationState }
      } else if (!triggered && updatedAlert.escalationState !== null) {
        // Breach ended — reset so the next breach restarts the escalation sequence.
        changed = true
        updatedAlert = { ...updatedAlert, escalationState: null }
      }

      if (triggered) {
        // One-time alerts: only ever fire once.
        // Persistent alerts: re-fire once the cooldown window has elapsed.
        const shouldFire = alert.triggerOnce
          ? alert.lastTriggeredAt === null
          : alert.lastTriggeredAt === null || now - alert.lastTriggeredAt >= cooldownMs

        if (shouldFire) {
          changed = true
          const newFireCount = (updatedAlert.fireCount ?? 0) + 1

          // #315/#488 – Dispatch to all enabled notification channels
          void dispatchNotifications(updatedAlert, currentPrice)

          // #308 – Play an alert sound, respecting the mute/volume preference.
          // No-ops silently if the user hasn't interacted with the page yet
          // (autoplay policy) or sound is muted.
          const soundPrefs = loadSoundPreferences()
          if (soundPrefs.enabled) {
            playAlertSound(soundPrefs.volume)
          }

          firedEntries.push(buildTriggerHistoryEntry(updatedAlert, currentPrice, now))

          return {
            ...updatedAlert,
            fireCount: newFireCount,
            lastTriggeredAt: now,
            // One-time: auto-disable. Persistent: stays active.
            active: !alert.triggerOnce,
          }
        }
      } else {
        // Re-arm a persistent alert once its cooldown window has elapsed (#310),
        // so it can fire again next time the condition is met.
        if (!alert.triggerOnce && alert.lastTriggeredAt !== null && now - alert.lastTriggeredAt >= cooldownMs) {
          changed = true
          return { ...updatedAlert, lastTriggeredAt: null }
        }
      }

      return updatedAlert
    })

    if (changed) {
      setAlerts(newAlerts)
    }
    if (firedEntries.length > 0) {
      // Newest first, capped (#309)
      setHistory((prev) => appendHistoryEntries(prev, firedEntries))
    }
  }, [livePrices, alerts])

  // Request notification permissions
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // #308 – Unlock the alert-sound AudioContext on the first user interaction,
  // since browsers block audio playback until a gesture has occurred.
  useEffect(() => {
    function handleFirstInteraction() {
      unlockAudioContext()
      window.removeEventListener('click', handleFirstInteraction)
      window.removeEventListener('keydown', handleFirstInteraction)
    }
    window.addEventListener('click', handleFirstInteraction)
    window.addEventListener('keydown', handleFirstInteraction)
    return () => {
      window.removeEventListener('click', handleFirstInteraction)
      window.removeEventListener('keydown', handleFirstInteraction)
    }
  }, [])

  useEffect(() => {
    saveAlerts(alerts)
    // Broadcast alerts change to other tabs
    alertsChannel.broadcast('alerts-update', alerts)
  }, [alerts])

  useEffect(() => {
    saveAlertHistory(history)
    // Broadcast history change to other tabs
    alertsHistoryChannel.broadcast('alerts-history-update', history)
  }, [history])

  // Listen for alerts changes from other tabs
  useEffect(() => {
    const unsubscribe = alertsChannel.subscribe((msg) => {
      if (msg.type === 'alerts-update') {
        setAlerts(msg.payload)
      }
    })
    return unsubscribe
  }, [])

  // Listen for history changes from other tabs
  useEffect(() => {
    const unsubscribe = alertsHistoryChannel.subscribe((msg) => {
      if (msg.type === 'alerts-history-update') {
        setHistory(msg.payload)
      }
    })
    return unsubscribe
  }, [])

  const addAlert = useCallback(
    (alert: Omit<Alert, 'id' | 'createdAt' | 'lastTriggeredAt' | 'fireCount' | 'snoozedUntil' | 'percentageBaselinePrice' | 'percentageBaselineTimestamp' | 'escalationState' | 'channels' | 'retestState'> & { channels?: Alert['channels'] }) => {
      // Rate-limit alert creation: max 5 per minute.
      if (!alertRateLimit.consume()) {
        return null
      }
      const newAlert: Alert = {
        ...alert,
        conditionGroup: alert.conditionGroup ?? migrateLegacyAlertConditions(alert),
        // #492 – default to `null` (use the global channel set) unless the caller
        // passed an explicit per-alert routing override.
        channels: alert.channels ?? null,
        // #491 – retest tracking starts fresh for every new alert.
        retestState: null,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        lastTriggeredAt: null,
        fireCount: 0,
        snoozedUntil: null,
        percentageBaselinePrice: null,
        percentageBaselineTimestamp: null,
        escalationState: null,
      }
      setAlerts((prev) => [...prev, newAlert])
      return newAlert
    },
    [alertRateLimit],
  )

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

  const activeCount = alerts.filter((a) => a.active && (a.snoozedUntil === null || a.snoozedUntil <= Date.now())).length

  const hasAlertsForPair = useCallback(
    (assetPair: string) => alerts.some((a) => a.assetPair === assetPair && a.active),
    [alerts],
  )

  const togglePanel = useCallback(() => setIsPanelOpen((p) => !p), [])

  const markAsRead = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, lastTriggeredAt: a.lastTriggeredAt ?? Date.now() } : a)),
    )
  }, [])

  /** Snooze an alert for a given duration (#313) */
  const snoozeAlert = useCallback((id: string, duration: AlertSnoozeDuration) => {
    const until = snoozeDurationMs(duration)
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, snoozedUntil: until, lastTriggeredAt: null, retestState: null } : a,
      ),
    )
  }, [])

  /** Remove snooze from an alert immediately (#313) */
  const unsnoozeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, snoozedUntil: null } : a)))
  }, [])

  /** Re-enable a fired one-time alert so it can fire again (#312) */
  const reEnableAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, active: true, lastTriggeredAt: null, fireCount: 0, snoozedUntil: null, escalationState: null, retestState: null }
          : a,
      ),
    )
  }, [])

  /** Clears the fired-alert history log (#309) */
  const clearAlertHistory = useCallback(() => setHistory([]), [])

  const value: AlertsContextType = {
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
    snoozeAlert,
    unsnoozeAlert,
    reEnableAlert,
    alertHistory: history,
    clearAlertHistory,
    alertCreateAllowed: alertRateLimit.allowed,
    alertCreateCooldownSec: alertRateLimit.cooldownSec,
  }

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>
}

/**
 * Returns the alerts context value.
 * Must be called inside a component that is a descendant of {@link AlertsProvider}.
 * Throws if called outside of that tree.
 */
export function useAlerts() {
  const context = useContext(AlertsContext)
  if (!context) {
    throw new Error('useAlerts must be used within an AlertsProvider')
  }
  return context
}
