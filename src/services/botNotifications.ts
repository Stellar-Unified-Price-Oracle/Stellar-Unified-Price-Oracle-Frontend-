/**
 * @file Telegram / Discord bot notification dispatch (#488).
 *
 * Two concerns live here:
 *  1. **Secret storage** — Telegram bot tokens and Discord webhook URLs (itself a
 *     bearer credential — anyone holding the URL can post as the bot) are held in
 *     `sessionStorage`, never `localStorage`, per the Client Storage Conventions
 *     documented in `src/utils/storage.ts` and `src/types/notifications.ts`. They
 *     are cleared automatically when the tab closes and must be re-entered after
 *     a reload, exactly like the existing webhook signing secret in
 *     `NotificationChannelsModal`.
 *  2. **Payload building + dispatch** — pure payload builders (easy to unit test
 *     without a network call) plus thin `fetch`-based senders, and a cooldown
 *     filter shared by the base alert-fire path and every escalation step.
 */
import type { BotDispatchResult, BotNotificationPayload, BotSecrets, DiscordChannelConfig, TelegramChannelConfig } from '../types'
import { EMPTY_BOT_SECRETS } from '../types'

const SESSION_KEY = 'stellar-oracle-bot-secrets'

/** Loads bot credentials from `sessionStorage`. Never touches `localStorage`. */
export function loadBotSecrets(): BotSecrets {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return { ...EMPTY_BOT_SECRETS }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { ...EMPTY_BOT_SECRETS }
    const { telegramBotToken, discordWebhookUrl } = parsed as Partial<BotSecrets>
    return {
      telegramBotToken: typeof telegramBotToken === 'string' ? telegramBotToken : '',
      discordWebhookUrl: typeof discordWebhookUrl === 'string' ? discordWebhookUrl : '',
    }
  } catch {
    return { ...EMPTY_BOT_SECRETS }
  }
}

/** Persists bot credentials to `sessionStorage` (cleared when the tab closes). */
export function saveBotSecrets(secrets: BotSecrets): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(secrets))
  } catch {
    /* storage unavailable (private mode, quota) — secrets simply won't persist across reload */
  }
}

/** Clears bot credentials from `sessionStorage` (e.g. when the user disables both channels). */
export function clearBotSecrets(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* no-op */
  }
}

// ---------------------------------------------------------------------------
// Payload builders (pure — see botNotifications.test.ts)
// ---------------------------------------------------------------------------

export interface TelegramSendMessageBody {
  chat_id: string
  text: string
  parse_mode: 'Markdown'
}

export function buildTelegramPayload(chatId: string, payload: BotNotificationPayload): TelegramSendMessageBody {
  const prefix = payload.escalation ? `⏱ *Escalation* (+${payload.escalation.delayMinutes}m): ` : '🔔 '
  return {
    chat_id: chatId,
    text: `${prefix}*${payload.assetPair}* — ${payload.message}\nPrice: $${payload.price}`,
    parse_mode: 'Markdown',
  }
}

export interface DiscordWebhookBody {
  content?: string
  embeds: Array<{
    title: string
    description: string
    fields: Array<{ name: string; value: string; inline: boolean }>
    timestamp: string
    color: number
  }>
}

const DISCORD_COLOR_ESCALATION = 0xf59e0b // amber
const DISCORD_COLOR_TRIGGER = 0x22d3ee // cyan

export function buildDiscordPayload(payload: BotNotificationPayload): DiscordWebhookBody {
  return {
    content: payload.escalation ? `⏱ Escalation step (+${payload.escalation.delayMinutes}m)` : undefined,
    embeds: [
      {
        title: `${payload.assetPair} price alert`,
        description: payload.message,
        fields: [{ name: 'Price', value: `$${payload.price}`, inline: true }],
        timestamp: new Date(payload.timestamp).toISOString(),
        color: payload.escalation ? DISCORD_COLOR_ESCALATION : DISCORD_COLOR_TRIGGER,
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export async function sendTelegramMessage(
  config: TelegramChannelConfig,
  botToken: string,
  payload: BotNotificationPayload,
): Promise<BotDispatchResult> {
  if (!config.enabled || !config.chatId) return { ok: false, error: 'Telegram channel is not enabled or missing a Chat ID' }
  if (!botToken) return { ok: false, error: 'Telegram bot token is not set for this session' }
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildTelegramPayload(config.chatId, payload)),
    })
    return res.ok ? { ok: true } : { ok: false, error: `Telegram API responded with ${res.status}` }
  } catch {
    return { ok: false, error: 'Network error sending the Telegram message' }
  }
}

export async function sendDiscordMessage(
  config: DiscordChannelConfig,
  webhookUrl: string,
  payload: BotNotificationPayload,
): Promise<BotDispatchResult> {
  if (!config.enabled) return { ok: false, error: 'Discord channel is not enabled' }
  if (!webhookUrl) return { ok: false, error: 'Discord webhook URL is not set for this session' }
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildDiscordPayload(payload)),
    })
    return res.ok ? { ok: true } : { ok: false, error: `Discord webhook responded with ${res.status}` }
  } catch {
    return { ok: false, error: 'Network error sending the Discord message' }
  }
}

/**
 * Cooldown/snooze-aware dispatch filter (#488) shared by the base alert-fire path
 * and every escalation step: has enough time passed since this channel last sent
 * for this alert? Mirrors the existing `cooldownMinutes` semantics used for
 * re-fires (see `useAlerts`) so bot channels never spam faster than any other
 * channel would.
 */
export function shouldDispatch(lastSentAt: number | null, cooldownMinutes: number, now: number = Date.now()): boolean {
  if (lastSentAt === null) return true
  return now - lastSentAt >= Math.max(0, cooldownMinutes) * 60_000
}
