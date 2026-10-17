import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { initSentry } from './sentry'

const { init } = vi.hoisted(() => ({ init: vi.fn() }))
vi.mock('@sentry/react', () => ({ init }))

describe('initSentry breadcrumb scrubbing (#846)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://public@example.ingest.sentry.io/1')
    init.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('installs a beforeBreadcrumb hook that removes personal data', async () => {
    await initSentry()

    expect(init).toHaveBeenCalledTimes(1)
    const options = init.mock.calls[0][0] as { beforeBreadcrumb: (b: object) => { message?: string; data?: unknown } }
    const scrubbed = options.beforeBreadcrumb({
      category: 'fetch',
      message: 'GET https://api.example.test/prices?api_key=sk-live&symbol=XLM',
      data: { requester: 'ada@example.com' },
    })

    expect(scrubbed.message).toBe('GET https://api.example.test/prices?api_key=[redacted]&symbol=XLM')
    expect(scrubbed.data).toEqual({ requester: '[email]' })
  })
})
