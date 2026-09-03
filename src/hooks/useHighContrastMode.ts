import { useEffect, useCallback, useSyncExternalStore } from 'react'

/**
 * High Contrast Mode support for accessibility.
 * 
 * Detects:
 * - Windows High Contrast Mode (forced-colors: active)
 * - prefers-contrast media query (enhanced contrast preference)
 * 
 * When enabled, the app should:
 * - Use system colors (Canvas, ButtonText, etc.)
 * - Add visible borders to all interactive elements
 * - Ensure information is conveyed through non-color means
 * - Increase text contrast ratios
 */

export interface HighContrastMode {
  /** True if High Contrast Mode is active */
  isActive: boolean
  /** True if forced-colors is active (Windows High Contrast) */
  isForcedColors: boolean
  /** True if prefers-contrast is set to more */
  prefersHigherContrast: boolean
}

// Global state for cross-component syncing
let currentState: HighContrastMode = {
  isActive: false,
  isForcedColors: false,
  prefersHigherContrast: false,
}
const listeners = new Set<() => void>()

function updateHighContrastState(): void {
  const forcedColors = window.matchMedia('(forced-colors: active)').matches
  const highContrast = window.matchMedia('(prefers-contrast: more)').matches

  currentState = {
    isActive: forcedColors || highContrast,
    isForcedColors: forcedColors,
    prefersHigherContrast: highContrast,
  }

  notifyListeners()
}

function notifyListeners(): void {
  for (const listener of listeners) {
    listener()
  }
}

/**
 * Hook to detect and respond to High Contrast Mode changes.
 * 
 * Returns current high contrast mode status and automatically updates
 * when system preferences change.
 * 
 * @example
 * const { isActive, isForcedColors } = useHighContrastMode()
 * 
 * if (isActive) {
 *   // Apply high contrast styles
 * }
 */
export function useHighContrastMode(): HighContrastMode {
  const subscribe = useCallback((callback: () => void) => {
    listeners.add(callback)
    return () => {
      listeners.delete(callback)
    }
  }, [])

  const state = useSyncExternalStore(subscribe, () => currentState)

  // Listen for high contrast mode changes
  useEffect(() => {
    const forcedColorsMql = window.matchMedia('(forced-colors: active)')
    const contrastMql = window.matchMedia('(prefers-contrast: more)')

    const handleChange = () => {
      updateHighContrastState()
    }

    // Modern browsers support addEventListener
    forcedColorsMql.addEventListener('change', handleChange)
    contrastMql.addEventListener('change', handleChange)

    return () => {
      forcedColorsMql.removeEventListener('change', handleChange)
      contrastMql.removeEventListener('change', handleChange)
    }
  }, [])

  // Initial detection on mount
  useEffect(() => {
    updateHighContrastState()
  }, [])

  return state
}

/**
 * Get current high contrast mode status (for use outside React components).
 */
export function getHighContrastMode(): HighContrastMode {
  return { ...currentState }
}

/**
 * Check if High Contrast Mode is currently active.
 * Safe to call on both client and server.
 */
export function isHighContrastModeActive(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(forced-colors: active)').matches ||
    window.matchMedia('(prefers-contrast: more)').matches
  )
}

export type { HighContrastMode }
