import { useEffect } from 'react'
import { usePreferences } from '../preferences/PreferencesContext'

/**
 * Applies accessibility class names to the document root based on user preferences.
 * Also respects the system-level prefers-reduced-motion media query.
 */
export function useAccessibility() {
  const { preferences } = usePreferences()

  useEffect(() => {
    const root = document.documentElement

    // Reduced motion: honour both user pref and system setting
    const systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (preferences.reducedMotion || systemReducedMotion) {
      root.classList.add('reduced-motion')
    } else {
      root.classList.remove('reduced-motion')
    }
  }, [preferences.reducedMotion])

  useEffect(() => {
    const root = document.documentElement
    if (preferences.highContrast) {
      root.classList.add('high-contrast')
    } else {
      root.classList.remove('high-contrast')
    }
  }, [preferences.highContrast])

  useEffect(() => {
    const root = document.documentElement
    if (preferences.largeText) {
      root.classList.add('large-text')
    } else {
      root.classList.remove('large-text')
    }
  }, [preferences.largeText])
}
