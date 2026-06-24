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
})
