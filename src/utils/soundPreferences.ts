/**
 * Persistence for alert sound preferences (#308): whether alert sounds are
 * enabled and the playback volume. Kept as its own small module (mirroring
 * `loadNotifConfig` in `useAlerts.tsx`) rather than routed through the
 * `Preferences` slice system, since it's read from a non-React code path
 * (the alert-firing effect) and doesn't need undo/redo history.
 */

import { readJson, writeJson, STORAGE_KEYS } from './storage'

export interface SoundPreferences {
  enabled: boolean
  /** 0-1 */
  volume: number
}

export const DEFAULT_SOUND_PREFERENCES: SoundPreferences = {
  enabled: true,
  volume: 0.5,
}

function isSoundPreferences(value: unknown): value is SoundPreferences {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.enabled === 'boolean' && typeof v.volume === 'number' && v.volume >= 0 && v.volume <= 1
}

/** Reads the persisted sound preferences, falling back to defaults on absent/invalid data. */
export function loadSoundPreferences(): SoundPreferences {
  return readJson<SoundPreferences>(STORAGE_KEYS.soundPreferences, DEFAULT_SOUND_PREFERENCES, isSoundPreferences)
}

/** Persists the given sound preferences. */
export function saveSoundPreferences(prefs: SoundPreferences): void {
  writeJson(STORAGE_KEYS.soundPreferences, prefs)
}
