import { describe, it, expect, beforeEach } from 'vitest'
import { STORAGE_KEYS, writeRaw, readRaw } from './storage'
import {
  WEEKLY_REAPPEAR_MS,
  loadExplanationDismissals,
  resetExplanationDismissals,
  saveExplanationDismissals,
  shouldShowExplanation,
  withDismissal,
} from './explanationDismissals'

const NOW = Date.UTC(2026, 0, 15)

beforeEach(() => {
  localStorage.clear()
})

describe('shouldShowExplanation', () => {
  it('shows an explanation that was never dismissed under every policy', () => {
    for (const policy of ['never', 'weekly', 'always'] as const) {
      expect(shouldShowExplanation('gap', policy, {}, NOW)).toBe(true)
    }
  })

  it('keeps a dismissed explanation hidden forever under "never"', () => {
    const dismissals = { gap: NOW - 365 * 24 * 60 * 60 * 1000 }

    expect(shouldShowExplanation('gap', 'never', dismissals, NOW)).toBe(false)
  })

  it('ignores dismissals under "always"', () => {
    expect(shouldShowExplanation('gap', 'always', { gap: NOW }, NOW)).toBe(true)
  })

  it('hides a dismissed explanation under "weekly" until seven days have passed', () => {
    const dismissals = { gap: NOW }

    expect(shouldShowExplanation('gap', 'weekly', dismissals, NOW + WEEKLY_REAPPEAR_MS - 1)).toBe(false)
    expect(shouldShowExplanation('gap', 'weekly', dismissals, NOW + WEEKLY_REAPPEAR_MS)).toBe(true)
  })

  it('treats each explanation id independently', () => {
    const dismissals = { gap: NOW }

    expect(shouldShowExplanation('other', 'never', dismissals, NOW)).toBe(true)
  })
})

describe('explanation dismissal storage', () => {
  it('records a dismissal and reads it back after a save', () => {
    const next = withDismissal({}, 'gap', NOW)

    expect(saveExplanationDismissals(next)).toBe(true)
    expect(loadExplanationDismissals()).toEqual({ gap: NOW })
  })

  it('does not mutate the map it was given', () => {
    const original = { a: 1 }
    withDismissal(original, 'b', NOW)

    expect(original).toEqual({ a: 1 })
  })

  it('falls back to an empty map when the stored value is not a dismissal map', () => {
    writeRaw(STORAGE_KEYS.dismissedExplanations, JSON.stringify(['not', 'a', 'map']))
    expect(loadExplanationDismissals()).toEqual({})

    writeRaw(STORAGE_KEYS.dismissedExplanations, JSON.stringify({ gap: 'yesterday' }))
    expect(loadExplanationDismissals()).toEqual({})
  })

  it('falls back to an empty map when the stored value is corrupt JSON', () => {
    writeRaw(STORAGE_KEYS.dismissedExplanations, '{oops')

    expect(loadExplanationDismissals()).toEqual({})
  })

  it('removes every dismissal on reset', () => {
    saveExplanationDismissals({ gap: NOW })

    resetExplanationDismissals()

    expect(readRaw(STORAGE_KEYS.dismissedExplanations)).toBeNull()
    expect(loadExplanationDismissals()).toEqual({})
  })
})
