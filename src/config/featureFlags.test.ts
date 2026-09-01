import { describe, it, expect, afterEach, vi } from 'vitest'
import { isFeatureEnabled, hashToPercent, subscribeFeatureFlagOverrides } from './featureFlags'

type WindowWithFeatureFlags = Window & {
  __featureFlags?: {
    list: () => Record<string, boolean>
    override: (key: string, value: boolean) => void
    clear: (key?: string) => void
  }
}

function devFlags() {
  const flags = (window as WindowWithFeatureFlags).__featureFlags
  if (!flags) throw new Error('window.__featureFlags was not installed (expected in DEV)')
  return flags
}

afterEach(() => {
  devFlags().clear()
  vi.unstubAllEnvs()
})

describe('isFeatureEnabled', () => {
  it('falls back to defaultEnabled when no override applies', () => {
    expect(isFeatureEnabled('memoryWarningReporting')).toBe(true)
  })

  it('an env override wins over defaultEnabled', () => {
    vi.stubEnv('VITE_FLAG_MEMORY_WARNING_REPORTING', 'false')
    expect(isFeatureEnabled('memoryWarningReporting')).toBe(false)
  })

  it('a dev-console override wins over an env override', () => {
    vi.stubEnv('VITE_FLAG_MEMORY_WARNING_REPORTING', 'false')
    devFlags().override('memoryWarningReporting', true)
    expect(isFeatureEnabled('memoryWarningReporting')).toBe(true)
  })

  it('clearing a dev-console override falls back through env/default again', () => {
    devFlags().override('memoryWarningReporting', false)
    expect(isFeatureEnabled('memoryWarningReporting')).toBe(false)
    devFlags().clear('memoryWarningReporting')
    expect(isFeatureEnabled('memoryWarningReporting')).toBe(true)
  })
})

describe('window.__featureFlags (dev toggling, #359)', () => {
  it('notifies subscribers when a flag is overridden', () => {
    let notified = false
    const unsubscribe = subscribeFeatureFlagOverrides(() => {
      notified = true
    })
    devFlags().override('memoryWarningReporting', false)
    expect(notified).toBe(true)
    unsubscribe()
  })

  it('list() reports the current evaluated state of every flag', () => {
    devFlags().override('memoryWarningReporting', false)
    expect(devFlags().list()).toEqual({ memoryWarningReporting: false })
  })
})

describe('hashToPercent', () => {
  it('is deterministic for the same input', () => {
    expect(hashToPercent('bucket-123:someFlag')).toBe(hashToPercent('bucket-123:someFlag'))
  })

  it('always returns a value in [0, 100)', () => {
    for (const input of ['a', 'bucket-1:flag', '', 'x'.repeat(50)]) {
      const pct = hashToPercent(input)
      expect(pct).toBeGreaterThanOrEqual(0)
      expect(pct).toBeLessThan(100)
    }
  })
})
