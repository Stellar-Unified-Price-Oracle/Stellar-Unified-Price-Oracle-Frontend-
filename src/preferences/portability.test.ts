import { describe, it, expect } from 'vitest'
import { DEFAULT_PREFERENCES } from './constants'
import {
  PORTABLE_KEYS,
  PREFERENCES_FORMAT,
  PREFERENCES_SCHEMA_VERSION,
  exportPreferences,
  importPreferences,
} from './portability'

const FIXED_DATE = new Date('2026-01-02T03:04:05.000Z')

function envelope(overrides: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    format: PREFERENCES_FORMAT,
    schemaVersion: PREFERENCES_SCHEMA_VERSION,
    exportedAt: FIXED_DATE.toISOString(),
    preferences: { ...exportPreferencesPayload(), ...overrides },
    ...extra,
  })
}

function exportPreferencesPayload(): Record<string, unknown> {
  return JSON.parse(exportPreferences(DEFAULT_PREFERENCES, FIXED_DATE)).preferences
}

describe('exportPreferences', () => {
  it('wraps only the portable keys in a versioned envelope', () => {
    const parsed = JSON.parse(exportPreferences(DEFAULT_PREFERENCES, FIXED_DATE))

    expect(parsed.format).toBe(PREFERENCES_FORMAT)
    expect(parsed.schemaVersion).toBe(PREFERENCES_SCHEMA_VERSION)
    expect(parsed.exportedAt).toBe('2026-01-02T03:04:05.000Z')
    expect(Object.keys(parsed.preferences).sort()).toEqual([...PORTABLE_KEYS].sort())
  })

  it('never exports the privacy opt-out or backtest presets', () => {
    const parsed = JSON.parse(exportPreferences({ ...DEFAULT_PREFERENCES, analyticsOptOut: true }, FIXED_DATE))

    expect(parsed.preferences).not.toHaveProperty('analyticsOptOut')
    expect(parsed.preferences).not.toHaveProperty('backtestPresets')
  })
})

describe('importPreferences', () => {
  it('round-trips an export back to the same portable values', () => {
    const exported = exportPreferences({ ...DEFAULT_PREFERENCES, refreshInterval: 30000, largeText: true })
    const result = importPreferences(exported)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.preferences.refreshInterval).toBe(30000)
    expect(result.preferences.largeText).toBe(true)
    expect(result.preferences.sourcePriority).toEqual(DEFAULT_PREFERENCES.sourcePriority)
  })

  it('rejects text that is not JSON', () => {
    const result = importPreferences('{not json')

    expect(result).toEqual({ ok: false, error: 'The file is not valid JSON.' })
  })

  it('rejects JSON that is not a preferences export', () => {
    expect(importPreferences('{"hello":"world"}')).toEqual({
      ok: false,
      error: 'The file is not a preferences export.',
    })
  })

  it('refuses files written by a newer schema version', () => {
    const newer = JSON.stringify({
      format: PREFERENCES_FORMAT,
      schemaVersion: PREFERENCES_SCHEMA_VERSION + 1,
      preferences: {},
    })
    const result = importPreferences(newer)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain(`v${PREFERENCES_SCHEMA_VERSION + 1}`)
  })

  it('names the invalid fields when a value is outside its allowed set', () => {
    const result = importPreferences(envelope({ refreshInterval: 7000, dashboardView: 'grid' }))

    expect(result).toEqual({
      ok: false,
      error: 'Invalid preference values: refreshInterval, dashboardView.',
    })
  })

  it('reports a missing portable field as invalid', () => {
    const payload = exportPreferencesPayload()
    delete payload.formatLocale
    const result = importPreferences(
      JSON.stringify({ format: PREFERENCES_FORMAT, schemaVersion: PREFERENCES_SCHEMA_VERSION, preferences: payload }),
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('formatLocale')
  })

  it('drops unknown fields instead of importing them', () => {
    const withExtra = JSON.parse(envelope())
    withExtra.preferences.analyticsOptOut = true
    withExtra.preferences.injected = 'x'
    const result = importPreferences(JSON.stringify(withExtra))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.preferences).not.toHaveProperty('analyticsOptOut')
    expect(result.preferences).not.toHaveProperty('injected')
  })

  it('caps list length so a crafted file cannot bloat the store', () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => `src-${i}`)
    const result = importPreferences(envelope({ cardOrder: tooMany }))

    expect(result).toEqual({ ok: false, error: 'Invalid preference values: cardOrder.' })
  })
})
