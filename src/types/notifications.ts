/**
 * @file Notification channel registry types (#488).
 *
 * Adds Telegram and Discord as bot-delivered notification targets alongside the
 * existing email/web-push/webhook channels (see `NotificationChannelsModal`).
 * Also used by escalation policies (#487) to address a given step at a channel.
 *
 * ## Secret handling
 * Bot tokens and the Discord webhook URL are bearer credentials — anyone holding
 * one can post as the bot. Per the app's Client Storage Conventions
 * (see `src/utils/storage.ts`), they are never written to `localStorage`. They are
 * kept in `sessionStorage` (cleared when the tab closes) via the helpers in
 * `src/services/botNotifications.ts`, mirroring how the existing webhook signing
 * secret is handled in `NotificationChannelsModal`.
 */

/** Every notification channel an alert (directly or via an escalation step) can target. */
export type NotificationChannelId = 'inApp' | 'email' | 'webPush' | 'webhook' | 'telegram' | 'discord'

/** Non-secret Telegram routing config — safe to persist to `localStorage`. */
export interface TelegramChannelConfig {
  chatId: string
  enabled: boolean
}

/** Non-secret Discord routing config — safe to persist to `localStorage`. */
export interface DiscordChannelConfig {
  /** Discord channel id, shown to the user for reference; not itself a credential. */
  channelId: string
  enabled: boolean
}

/** Bot credentials — session-only, see the file-level doc comment. Never persisted to disk. */
export interface BotSecrets {
  telegramBotToken: string
  discordWebhookUrl: string
}

export const EMPTY_BOT_SECRETS: BotSecrets = { telegramBotToken: '', discordWebhookUrl: '' }

/** Standardized payload shape passed to a bot dispatcher before channel-specific formatting. */
export interface BotNotificationPayload {
  assetPair: string
  price: number
  message: string
  timestamp: number
  /** Present when this dispatch is an escalation step rather than the initial fire. */
  escalation?: { stepId: string; delayMinutes: number }
}

/** Result of attempting a bot dispatch — used by the "Send Test Message" UI action. */
export interface BotDispatchResult {
  ok: boolean
  error?: string
}
