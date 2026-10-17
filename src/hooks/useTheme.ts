import { useEffect, useCallback, useSyncExternalStore } from 'react'
import { readRaw, STORAGE_KEYS, writeRaw } from '../utils/storage'

export type Theme = 'light' | 'dark'
export type ThemeMode = Theme | 'system'

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyThemeClass(theme: Theme): void {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(theme)
}

function resolveTheme(mode: ThemeMode): Theme {
  return mode === 'system' ? getSystemTheme() : mode
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

/**
 * Reads the saved mode. The key is shared with the pre-paint script in
 * `public/theme-init.js`, so a worker-update reload applies the same theme that
 * React will show. Users who saved under the pre-#834 key keep their choice.
 */
function readStoredMode(): ThemeMode {
  const stored = readRaw(STORAGE_KEYS.theme)
  if (isThemeMode(stored)) return stored
  const legacy = readRaw(STORAGE_KEYS.themeLegacy)
  return isThemeMode(legacy) ? legacy : 'system'
}

function writeStoredMode(mode: ThemeMode): void {
  writeRaw(STORAGE_KEYS.theme, mode)
}

export interface UseThemeResult {
  /** The resolved active theme ('light' | 'dark') */
  theme: Theme
  /** The user's selected mode ('light' | 'dark' | 'system') */
  mode: ThemeMode
  /** Set the theme mode */
  setMode: (mode: ThemeMode) => void
  /** Toggle between light and dark (sets mode explicitly, not system) */
  toggle: () => void
}

// Global state for cross-component syncing
let currentMode: ThemeMode = readStoredMode()
let currentTheme: Theme = resolveTheme(currentMode)
const listeners = new Set<() => void>()

function notifyListeners(): void {
  currentTheme = resolveTheme(currentMode)
  applyThemeClass(currentTheme)
  for (const listener of listeners) {
    listener()
  }
}

/**
 * Manages application theme (light/dark/system).
 *
 * Applies the theme class to `<html>`, persists the preference to localStorage,
 * listens for system colour-scheme changes, and syncs across all hook instances.
 *
 * @returns The current theme, mode, and methods to change them.
 */
export function useTheme(): UseThemeResult {
  const subscribe = useCallback((callback: () => void) => {
    listeners.add(callback)
    return () => {
      listeners.delete(callback)
    }
  }, [])

  const mode = useSyncExternalStore(subscribe, () => currentMode)
  const theme = useSyncExternalStore(subscribe, () => currentTheme)

  // Apply theme class on mount
  useEffect(() => {
    applyThemeClass(currentTheme)
  }, [])

  // Listen for system preference changes when mode is 'system'
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = () => {
      if (currentMode === 'system') {
        notifyListeners()
      }
    }

    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])

  const setMode = useCallback((newMode: ThemeMode) => {
    currentMode = newMode
    writeStoredMode(newMode)
    notifyListeners()
  }, [])

  const toggle = useCallback(() => {
    // Read the live module-level currentTheme to determine the next mode
    const next: Theme = currentTheme === 'dark' ? 'light' : 'dark'
    setMode(next)
  }, [setMode])

  return { theme, mode, setMode, toggle }
}
