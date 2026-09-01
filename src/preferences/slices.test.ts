import { describe, it, expect } from 'vitest'
import { DEFAULT_PREFERENCES } from './constants'
import {
  ACCESSIBILITY_PREFERENCE_KEYS,
  DATA_PREFERENCE_KEYS,
  LAYOUT_PREFERENCE_KEYS,
  PRIVACY_PREFERENCE_KEYS,
  accessibilityPreferencesReducer,
  dataPreferencesReducer,
  layoutPreferencesReducer,
  preferencesReducer,
  privacyPreferencesReducer,
  setPreference,
} from './slices'

describe('slice ownership', () => {
  const allKeys = [
    ...DATA_PREFERENCE_KEYS,
    ...LAYOUT_PREFERENCE_KEYS,
    ...ACCESSIBILITY_PREFERENCE_KEYS,
    ...PRIVACY_PREFERENCE_KEYS,
  ]

  it('assigns every preference key to exactly one slice', () => {
    expect([...allKeys].sort()).toEqual(Object.keys(DEFAULT_PREFERENCES).sort())
    expect(new Set(allKeys).size).toBe(allKeys.length)
  })
})

describe('dataPreferencesReducer', () => {
  it('applies a key it owns', () => {
    const next = dataPreferencesReducer(DEFAULT_PREFERENCES, setPreference('refreshInterval', 30000))
    expect(next.refreshInterval).toBe(30000)
  })

  it('returns the same reference for a key it does not own', () => {
    const next = dataPreferencesReducer(DEFAULT_PREFERENCES, setPreference('highContrast', true))
    expect(next).toBe(DEFAULT_PREFERENCES)
  })

  it('leaves keys owned by other slices untouched', () => {
    const next = dataPreferencesReducer(DEFAULT_PREFERENCES, setPreference('chartTimeRange', '7d'))
    expect(next.dashboardView).toBe(DEFAULT_PREFERENCES.dashboardView)
    expect(next.highContrast).toBe(DEFAULT_PREFERENCES.highContrast)
    expect(next.analyticsOptOut).toBe(DEFAULT_PREFERENCES.analyticsOptOut)
  })
})

describe('layoutPreferencesReducer', () => {
  it('applies a key it owns', () => {
    const next = layoutPreferencesReducer(DEFAULT_PREFERENCES, setPreference('dashboardView', 'table'))
    expect(next.dashboardView).toBe('table')
  })

  it('ignores a data key', () => {
    const next = layoutPreferencesReducer(DEFAULT_PREFERENCES, setPreference('refreshInterval', 30000))
    expect(next).toBe(DEFAULT_PREFERENCES)
  })
})

describe('accessibilityPreferencesReducer', () => {
  it('applies a key it owns', () => {
    const next = accessibilityPreferencesReducer(DEFAULT_PREFERENCES, setPreference('largeText', true))
    expect(next.largeText).toBe(true)
  })

  it('ignores a privacy key', () => {
    const next = accessibilityPreferencesReducer(DEFAULT_PREFERENCES, setPreference('analyticsOptOut', true))
    expect(next).toBe(DEFAULT_PREFERENCES)
  })
})

describe('privacyPreferencesReducer', () => {
  it('applies a key it owns', () => {
    const next = privacyPreferencesReducer(DEFAULT_PREFERENCES, setPreference('analyticsOptOut', true))
    expect(next.analyticsOptOut).toBe(true)
  })
})

describe('preferencesReducer', () => {
  it('routes each key to its owning slice', () => {
    let state = DEFAULT_PREFERENCES
    state = preferencesReducer(state, setPreference('refreshInterval', 30000))
    state = preferencesReducer(state, setPreference('dashboardView', 'table'))
    state = preferencesReducer(state, setPreference('largeText', true))
    state = preferencesReducer(state, setPreference('analyticsOptOut', true))

    expect(state).toEqual({
      ...DEFAULT_PREFERENCES,
      refreshInterval: 30000,
      dashboardView: 'table',
      largeText: true,
      analyticsOptOut: true,
    })
  })

  it('returns the same reference when the value is unchanged', () => {
    const next = preferencesReducer(
      DEFAULT_PREFERENCES,
      setPreference('refreshInterval', DEFAULT_PREFERENCES.refreshInterval),
    )
    expect(next).toBe(DEFAULT_PREFERENCES)
  })

  it('does not mutate the previous state', () => {
    const before = { ...DEFAULT_PREFERENCES }
    preferencesReducer(DEFAULT_PREFERENCES, setPreference('refreshInterval', 60000))
    expect(DEFAULT_PREFERENCES).toEqual(before)
  })

  it('changes exactly one key per action', () => {
    const next = preferencesReducer(DEFAULT_PREFERENCES, setPreference('staleThresholdMinutes', 15))
    const changed = Object.keys(next).filter(
      (k) => next[k as keyof typeof next] !== DEFAULT_PREFERENCES[k as keyof typeof DEFAULT_PREFERENCES],
    )
    expect(changed).toEqual(['staleThresholdMinutes'])
  })
})
