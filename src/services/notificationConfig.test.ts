import { describe, it, expect } from 'vitest'
import { getEnabledChannels, resolveAlertChannels, type NotifConfig } from './notificationConfig'

const defaultConfig: NotifConfig = {
  email: { address: '', enabled: false },
  webPush: { enabled: false },
  webhook: { url: '', enabled: false },
  telegram: { chatId: '', enabled: false },
  discord: { channelId: '', enabled: false },
}

function cfg(overrides?: Partial<NotifConfig>): NotifConfig {
  return { ...defaultConfig, ...overrides }
}

describe('getEnabledChannels (#492)', () => {
  it('returns an empty global default as inApp-only', () => {
    expect(getEnabledChannels(defaultConfig)).toEqual(['inApp'])
  })

  it('only includes channels that are both configured and enabled', () => {
    const enabled = getEnabledChannels(
      cfg({
        email: { address: 'a@b.co', enabled: true },
        webPush: { enabled: true },
        webhook: { url: 'https://x', enabled: true },
        telegram: { chatId: '', enabled: true }, // missing chatId → excluded
      }),
    )
    expect(enabled).toEqual(expect.arrayContaining(['email', 'webPush', 'webhook']))
    expect(enabled).not.toContain('telegram')
  })
})

describe('resolveAlertChannels (#492)', () => {
  const all = cfg({
    email: { address: 'a@b.co', enabled: true },
    webPush: { enabled: true },
    webhook: { url: 'https://x', enabled: true },
  })

  it('falls back to the global default set when the alert has no override', () => {
    expect(resolveAlertChannels(all, null)).toEqual(new Set(['inApp', 'email', 'webPush', 'webhook']))
    expect(resolveAlertChannels(all, [])).toEqual(new Set(['inApp', 'email', 'webPush', 'webhook']))
  })

  it('per-alert override wins and is intersected with enabled channels', () => {
    expect(resolveAlertChannels(all, ['email'])).toEqual(new Set(['inApp', 'email']))
    // `discord` isn't enabled globally → dropped from the override.
    expect(resolveAlertChannels(all, ['discord', 'webhook'])).toEqual(new Set(['inApp', 'webhook']))
  })

  it('always includes inApp and never delivers to an empty set', () => {
    // Only inApp enabled globally; an explicit override cannot drop delivery entirely.
    const inAppOnly = defaultConfig
    expect(resolveAlertChannels(inAppOnly, ['email'])).toEqual(new Set(['inApp']))
  })
})