import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  loadBotSecrets,
  saveBotSecrets,
  clearBotSecrets,
  buildTelegramPayload,
  buildDiscordPayload,
  sendTelegramMessage,
  sendDiscordMessage,
  shouldDispatch,
} from './botNotifications'
import type { BotNotificationPayload, TelegramChannelConfig, DiscordChannelConfig } from '../types'

const payload: BotNotificationPayload = {
  assetPair: 'BTC/USD',
  price: 65000.5,
  message: 'crossed your threshold',
  timestamp: 1_700_000_000_000,
}

const escalationPayload: BotNotificationPayload = {
  ...payload,
  escalation: { stepId: 'step-1', delayMinutes: 15 },
}

beforeEach(() => {
  sessionStorage.clear()
})

describe('bot secret storage (session-only)', () => {
  it('starts empty', () => {
    expect(loadBotSecrets()).toEqual({ telegramBotToken: '', discordWebhookUrl: '' })
  })

  it('round-trips secrets through sessionStorage', () => {
    saveBotSecrets({ telegramBotToken: 'tg-token', discordWebhookUrl: 'https://discord.com/api/webhooks/x' })
    expect(loadBotSecrets()).toEqual({ telegramBotToken: 'tg-token', discordWebhookUrl: 'https://discord.com/api/webhooks/x' })
  })

  it('never writes to localStorage', () => {
    saveBotSecrets({ telegramBotToken: 'tg-token', discordWebhookUrl: 'wh-url' })
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBeGreaterThan(0)
  })

  it('clearBotSecrets removes the stored value', () => {
    saveBotSecrets({ telegramBotToken: 'tg-token', discordWebhookUrl: 'wh-url' })
    clearBotSecrets()
    expect(loadBotSecrets()).toEqual({ telegramBotToken: '', discordWebhookUrl: '' })
  })

  it('tolerates corrupt sessionStorage content', () => {
    sessionStorage.setItem('stellar-oracle-bot-secrets', 'not json')
    expect(loadBotSecrets()).toEqual({ telegramBotToken: '', discordWebhookUrl: '' })
  })
})

describe('buildTelegramPayload', () => {
  it('formats a base trigger message', () => {
    const body = buildTelegramPayload('12345', payload)
    expect(body.chat_id).toBe('12345')
    expect(body.parse_mode).toBe('Markdown')
    expect(body.text).toContain('BTC/USD')
    expect(body.text).toContain('65000.5')
    expect(body.text).not.toContain('Escalation')
  })

  it('marks an escalation step distinctly', () => {
    const body = buildTelegramPayload('12345', escalationPayload)
    expect(body.text).toContain('Escalation')
    expect(body.text).toContain('+15m')
  })
})

describe('buildDiscordPayload', () => {
  it('formats a base trigger message with no content prefix', () => {
    const body = buildDiscordPayload(payload)
    expect(body.content).toBeUndefined()
    expect(body.embeds[0].title).toContain('BTC/USD')
    expect(body.embeds[0].fields[0].value).toBe('$65000.5')
  })

  it('adds an escalation content prefix and distinct color', () => {
    const base = buildDiscordPayload(payload)
    const escalated = buildDiscordPayload(escalationPayload)
    expect(escalated.content).toContain('Escalation')
    expect(escalated.embeds[0].color).not.toBe(base.embeds[0].color)
  })
})

describe('sendTelegramMessage / sendDiscordMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not call fetch when the Telegram channel is disabled', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    const config: TelegramChannelConfig = { chatId: '123', enabled: false }
    const result = await sendTelegramMessage(config, 'token', payload)
    expect(result.ok).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does not call fetch when the Telegram bot token is missing', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    const config: TelegramChannelConfig = { chatId: '123', enabled: true }
    const result = await sendTelegramMessage(config, '', payload)
    expect(result.ok).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('posts to the Telegram Bot API when configured', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response)
    const config: TelegramChannelConfig = { chatId: '123', enabled: true }
    const result = await sendTelegramMessage(config, 'tok', payload)
    expect(result.ok).toBe(true)
    expect(fetchSpy).toHaveBeenCalledWith('https://api.telegram.org/bottok/sendMessage', expect.objectContaining({ method: 'POST' }))
  })

  it('reports a Telegram API error response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 401 } as Response)
    const result = await sendTelegramMessage({ chatId: '123', enabled: true }, 'tok', payload)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('401')
  })

  it('does not call fetch when the Discord webhook URL is missing', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    const config: DiscordChannelConfig = { channelId: 'c1', enabled: true }
    const result = await sendDiscordMessage(config, '', payload)
    expect(result.ok).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('posts to the Discord webhook URL when configured', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response)
    const config: DiscordChannelConfig = { channelId: 'c1', enabled: true }
    const result = await sendDiscordMessage(config, 'https://discord.com/api/webhooks/x', payload)
    expect(result.ok).toBe(true)
    expect(fetchSpy).toHaveBeenCalledWith('https://discord.com/api/webhooks/x', expect.objectContaining({ method: 'POST' }))
  })

  it('handles a network failure gracefully', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'))
    const result = await sendTelegramMessage({ chatId: '1', enabled: true }, 'tok', payload)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/network/i)
  })
})

describe('shouldDispatch (cooldown filtering)', () => {
  it('allows dispatch when never sent before', () => {
    expect(shouldDispatch(null, 15)).toBe(true)
  })

  it('blocks dispatch inside the cooldown window', () => {
    const now = 1_700_000_000_000
    expect(shouldDispatch(now - 5 * 60_000, 15, now)).toBe(false)
  })

  it('allows dispatch once the cooldown window has elapsed', () => {
    const now = 1_700_000_000_000
    expect(shouldDispatch(now - 15 * 60_000, 15, now)).toBe(true)
  })

  it('treats a negative cooldown as zero (always allowed)', () => {
    const now = 1_700_000_000_000
    expect(shouldDispatch(now, -5, now)).toBe(true)
  })
})
