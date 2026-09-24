/**
 * @file Alert history log persistence + entry builders (#309, extended for #487).
 *
 * Originally inlined in `useAlerts`; pulled out into a service so escalation step
 * firings (#487) share the exact same log, storage key, and cap as regular alert
 * triggers, distinguished by the optional `escalation` field on `AlertHistoryEntry`
 * (see `src/types/index.ts`). `AlertHistoryLog`/`AlertPanel` render both kinds from
 * one list.
 */
import type { Alert, AlertHistoryEntry, EscalationStep } from '../types'
import { AlertHistoryArraySchema } from '../api/schemas'
import { readRaw, writeJson, STORAGE_KEYS } from '../utils/storage'

/** Cap on the fired-alert history log (#309), oldest entries dropped first. */
export const HISTORY_LIMIT = 500

/** Loads the fired-alert history log, tolerating legacy/invalid data. */
export function loadAlertHistory(): AlertHistoryEntry[] {
  try {
    const raw = readRaw(STORAGE_KEYS.alertHistory)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    const result = AlertHistoryArraySchema.safeParse(parsed)
    if (!result.success) {
      console.warn('[alertHistory] Invalid alert history in storage, resetting:', result.error.issues)
      return []
    }
    // Zod fills in defaults for new fields (e.g. `escalation`) on legacy entries.
    return result.data as AlertHistoryEntry[]
  } catch {
    return []
  }
}

export function saveAlertHistory(history: AlertHistoryEntry[]): void {
  writeJson(STORAGE_KEYS.alertHistory, history)
}

/**
 * Debounce window for `saveAlertHistoryDebounced` (#510). Escalation steps and
 * fast-moving percentage alerts can fire many times per second (simulation
 * replay, retest detection); writing the full log to storage on every single
 * fire serializes and blocks the main thread once per fire. Coalescing bursts
 * into one write keeps the log correct (last write wins, always the latest
 * state) without the per-fire cost.
 */
const HISTORY_WRITE_DEBOUNCE_MS = 400

let historyWriteTimer: ReturnType<typeof setTimeout> | null = null
let pendingHistory: AlertHistoryEntry[] | null = null

/** Debounced `saveAlertHistory` — coalesces write storms during alert bursts. */
export function saveAlertHistoryDebounced(history: AlertHistoryEntry[]): void {
  pendingHistory = history
  if (historyWriteTimer !== null) clearTimeout(historyWriteTimer)
  historyWriteTimer = setTimeout(() => {
    historyWriteTimer = null
    if (pendingHistory) saveAlertHistory(pendingHistory)
    pendingHistory = null
  }, HISTORY_WRITE_DEBOUNCE_MS)
}

/** Flushes any pending debounced write immediately (e.g. on unmount). */
export function flushAlertHistory(): void {
  if (historyWriteTimer !== null) {
    clearTimeout(historyWriteTimer)
    historyWriteTimer = null
  }
  if (pendingHistory) {
    saveAlertHistory(pendingHistory)
    pendingHistory = null
  }
}

/** Builds the history entry for an alert's initial trigger (or a persistent re-fire). */
export function buildTriggerHistoryEntry(
  alert: Alert,
  price: number,
  firedAt: number,
  retest?: AlertHistoryEntry['retest'],
): AlertHistoryEntry {
  return {
    id: crypto.randomUUID(),
    alertId: alert.id,
    assetPair: alert.assetPair,
    triggeredAt: firedAt,
    price,
    triggerOnce: alert.triggerOnce,
    percentageMode: alert.percentageMode,
    upperThreshold: alert.upperThreshold,
    lowerThreshold: alert.lowerThreshold,
    percentageThreshold: alert.percentageThreshold,
    percentageWindow: alert.percentageWindow,
    percentageDirection: alert.percentageDirection,
    escalation: null,
    retest: retest ?? null,
  }
}

/** Builds the history entry recording one escalation step firing (#487). */
export function buildEscalationHistoryEntry(alert: Alert, step: EscalationStep, price: number, firedAt: number): AlertHistoryEntry {
  return {
    ...buildTriggerHistoryEntry(alert, price, firedAt),
    id: crypto.randomUUID(),
    escalation: { stepId: step.id, channel: step.channel, delayMinutes: step.delayMinutes },
  }
}

/** Prepends new entries (newest first) to `history`, capped to `limit`. Pure — returns a new array. */
export function appendHistoryEntries(
  history: AlertHistoryEntry[],
  newEntries: AlertHistoryEntry[],
  limit = HISTORY_LIMIT,
): AlertHistoryEntry[] {
  if (newEntries.length === 0) return history
  return [...newEntries].reverse().concat(history).slice(0, limit)
}
