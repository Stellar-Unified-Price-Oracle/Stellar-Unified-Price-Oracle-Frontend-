import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('config defaults', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses the README documented defaults when env vars are missing', async () => {
    vi.stubEnv('VITE_API_URL', '')
    vi.stubEnv('VITE_WS_URL', '')

    const { config } = await import('./index')

    expect(config.apiUrl).toBe('/api')
    expect(config.wsUrl).toBe('ws://localhost:3000')
  })

  it('exposes retry configuration with sane defaults', async () => {
    const { config } = await import('./index')
    expect(config.retry).toBeDefined()
    expect(config.retry.maxAttempts).toBe(3)
    expect(config.retry.baseDelayMs).toBe(1000)
    expect(config.retry.backoffMultiplier).toBe(2)
    expect(config.retry.maxDelayMs).toBe(30_000)
    expect(config.retry.jitter).toBe(true)
  })
})
