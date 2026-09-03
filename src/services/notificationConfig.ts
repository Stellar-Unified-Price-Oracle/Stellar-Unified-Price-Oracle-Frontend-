/**
 * @file Notification channel config (shared #315 / #488 / #492).
 *
 * The persisted (secret-free) channel routing config, its loader, and the helpers
 * that resolve which channels an alert should use — including the per-alert
 * routing added by #492. `useAlerts` and `NotificationChannelsModal` both read the
 * same `STORAGE_KEYS.notificationChannels` record, so this module is the single
 * place that knows its shape (minus secrets — see `types/notifications.ts`).
 */
import type { NotificationChannelId } from '../types'
import { readJson, STORAGE_KEYS } from '../utils/storage'

/** Persisted, secret-free channel routing config (mirrors NotificationChannelsModal). */
export interface NotifConfig {
  email: { address: string; enabled: boolean }
  webPush: { enabled: boolean }
  webhook: { url: string; enabled: boolean }
  telegram: { chatId: string; enabled: boolean }
  discord: { channelId: string; enabled: boolean }
}

const DEFAULT_CONFIG: NotifConfig = {
  email: { address: '', enabled: false },
  webPush: { enabled: false },
  webhook: { url: '', enabled: false },
  telegram: { chatId: '', enabled: false },
  discord: { channelId: '', enabled: false },
}

/** Loads the persisted (secret-free) notification channel config. */
export function loadNotifConfig(): NotifConfig {
  return readJson<NotifConfig>(STORAGE_KEYS.notificationChannels, {
    // Merge over defaults so a partial/legacy record never yields undefined shapes.
    email: { ...DEFAULT_CONFIG.email },
    webPush: { ...DEFAULT_CONFIG.webPush },
    webhook: { ...DEFAULT_CONFIG.webhook },
    telegram: { ...DEFAULT_CONFIG.telegram },
    discord: { ...DEFAULT_CONFIG.discord },
  })
}

/**
 * Returns the channel ids that are both configured and enabled at the global level
 * (e.g. email with an address and enabled=true). This is the "global default"
 * routing set used when an alert does not override it per-channel.
 */
export function getEnabledChannels(cfg: NotifConfig): NotificationChannelId[] {
  const ids: NotificationChannelId[] = []
  if (cfg.email.enabled && cfg.email.address) ids.push('email')
  if (cfg.webPush.enabled) ids.push('webPush')
  if (cfg.webhook.enabled && cfg.webhook.url) ids.push('webhook')
  if (cfg.telegram.enabled && cfg.telegram.chatId) ids.push('telegram')
  if (cfg.discord.enabled && cfg.discord.channelId) ids.push('discord')
  // inApp is always available — the base alert-fire path always produces the
  // in-app sound/notification regardless of routing.
  if (ids.length === 0) return ['inApp']
  return ids
}

/**
 * Resolves the set of channels an alert is actually routed to (#492).
 *
 * - When `alertChannels` is `null`/empty the alert falls back to the global
 *   default set (`getEnabledChannels`).
 * - When specified, the alert's chosen channels are intersected with the
 *   currently-enabled global channels, so a channel that has since been disabled
 *   or unconfigured is skipped. `inApp` is always included.
 */
export function resolveAlertChannels(
  cfg: NotifConfig,
  alertChannels: NotificationChannelId[] | null | undefined,
): Set<NotificationChannelId> {
  const enabled = new Set(getEnabledChannels(cfg))
  if (!alertChannels || alertChannels.length === 0) return enabled

  const chosen = new Set(alertChannels)
  chosen.delete('inApp') // always handled by the base fire path
  const resolved = new Set<NotificationChannelId>(['inApp'])
  for (const ch of chosen) {
    if (enabled.has(ch)) resolved.add(ch)
  }
  // Guarantee delivery is never silently empty: an override list that somehow
  // resolves to nothing falls back to every enabled channel.
  if (resolved.size === 1) {
    for (const ch of enabled) resolved.add(ch)
  }
  return resolved
}