import { describe, expect, it, vi } from 'vitest'
import { sendWebPush, WEB_PUSH_FAILURE_MESSAGES, type WebPushEnvironment } from './webPushDelivery'

function env(overrides: Partial<WebPushEnvironment> = {}): WebPushEnvironment {
  return { notificationSupported: true, permission: 'granted', show: vi.fn(), ...overrides }
}

describe('sendWebPush', () => {
  it('shows the notification and reports success when permission is granted', () => {
    const show = vi.fn()
    expect(sendWebPush('Price Alert Triggered', 'XLM crossed $0.1', env({ show }))).toEqual({ ok: true })
    expect(show).toHaveBeenCalledWith('Price Alert Triggered', { body: 'XLM crossed $0.1' })
  })

  it('reports a denied permission without attempting to show anything', () => {
    const show = vi.fn()
    const result = sendWebPush('t', 'b', env({ permission: 'denied', show }))
    expect(result).toEqual({ ok: false, error: WEB_PUSH_FAILURE_MESSAGES.permissionDenied })
    expect(show).not.toHaveBeenCalled()
  })

  it('reports a permission that was never granted as required, not denied', () => {
    const result = sendWebPush('t', 'b', env({ permission: 'default' }))
    expect(result).toEqual({ ok: false, error: WEB_PUSH_FAILURE_MESSAGES.permissionRequired })
  })

  it('reports unsupported browsers', () => {
    const result = sendWebPush('t', 'b', env({ notificationSupported: false, permission: null }))
    expect(result).toEqual({ ok: false, error: WEB_PUSH_FAILURE_MESSAGES.unsupported })
  })

  it('treats a constructor that throws (for example, a revoked permission) as a failed delivery', () => {
    const show = vi.fn(() => {
      throw new TypeError('Illegal constructor')
    })
    expect(sendWebPush('t', 'b', env({ show }))).toEqual({
      ok: false,
      error: WEB_PUSH_FAILURE_MESSAGES.constructionFailed,
    })
  })

  it('every failure message tells the user alerts still reach them in-app', () => {
    for (const message of Object.values(WEB_PUSH_FAILURE_MESSAGES)) {
      expect(message).toMatch(/in-app/)
    }
  })
})
