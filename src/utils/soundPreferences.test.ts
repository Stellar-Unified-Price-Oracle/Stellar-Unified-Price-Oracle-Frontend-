import { describe, it, expect, beforeEach } from 'vitest'
import { STORAGE_KEYS, writeJson, writeRaw } from './storage'
import { DEFAULT_SOUND_PREFERENCES, loadSoundPreferences, saveSoundPreferences } from './soundPreferences'

beforeEach(() => {
  localStorage.clear()
})

describe('loadSoundPreferences', () => {
  it('returns the defaults when nothing is stored', () => {
    expect(loadSoundPreferences()).toEqual(DEFAULT_SOUND_PREFERENCES)
  })

  it('round-trips a saved value', () => {
    saveSoundPreferences({ enabled: false, volume: 0.2 })
    expect(loadSoundPreferences()).toEqual({ enabled: false, volume: 0.2 })
  })

  it('falls back to defaults on malformed JSON', () => {
    writeRaw(STORAGE_KEYS.soundPreferences, '{not json')
    expect(loadSoundPreferences()).toEqual(DEFAULT_SOUND_PREFERENCES)
  })

  it('falls back to defaults when the stored shape is invalid', () => {
    writeJson(STORAGE_KEYS.soundPreferences, { enabled: 'yes', volume: 2 })
    expect(loadSoundPreferences()).toEqual(DEFAULT_SOUND_PREFERENCES)
  })
})
