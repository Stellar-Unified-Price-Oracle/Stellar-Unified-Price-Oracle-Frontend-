import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { DEFAULT_PREFERENCES } from './constants'
import { exportPreferences, importPreferences, PORTABLE_KEYS } from './portability'
import type { Preferences } from './types'

// Generators cover the real option sets so the property holds for every value the UI can produce.
const preferencesArb = fc.record({
  refreshInterval: fc.constantFrom(5000, 10000, 30000, 60000, 300000),
  chartTimeRange: fc.constantFrom('24h', '7d', '30d'),
  chartHistoryPageSize: fc.constantFrom(50, 100, 250),
  staleThresholdMinutes: fc.integer({ min: 1, max: 60 }),
  sourcePriority: fc.array(fc.string({ minLength: 1, maxLength: 16 }), { maxLength: 10 }),
  onChainDivergenceThresholdPercent: fc.double({ min: 0, max: 100, noNaN: true }),
  dashboardView: fc.constantFrom('card', 'table'),
  cardOrder: fc.array(fc.string({ minLength: 1, maxLength: 16 }), { maxLength: 10 }),
  reducedMotion: fc.boolean(),
  highContrast: fc.boolean(),
  largeText: fc.boolean(),
  rtlEnabled: fc.boolean(),
  chartTimezone: fc.constantFrom('UTC', 'Local', 'America/New_York', 'Europe/London', 'Asia/Tokyo'),
  formatLocale: fc.constantFrom('auto', 'en-US', 'de-DE', 'fr-FR', 'ja-JP', 'es-ES', 'ar-SA', 'he', 'pt-BR'),
  showExcludedSources: fc.boolean(),
})

describe('preferences portability (properties)', () => {
  it('export followed by import restores every portable value', () => {
    fc.assert(
      fc.property(preferencesArb, (portable) => {
        const prefs: Preferences = { ...DEFAULT_PREFERENCES, ...portable }
        const result = importPreferences(exportPreferences(prefs))

        expect(result.ok).toBe(true)
        if (!result.ok) return
        for (const key of PORTABLE_KEYS) {
          expect(result.preferences[key]).toEqual(prefs[key])
        }
      }),
    )
  })

  it('import never throws, whatever text it is given', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const result = importPreferences(text)
        expect(typeof result.ok).toBe('boolean')
      }),
    )
  })
})
