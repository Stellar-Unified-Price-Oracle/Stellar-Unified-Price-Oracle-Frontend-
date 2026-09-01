import { useEffect, useState } from 'react'
import { usePreferences } from '../preferences/PreferencesContext'

/**
 * Hook that returns whether reduced motion is currently active.
 *
 * Respects both the user's accessibility preference AND the system-level
 * prefers-reduced-motion media query. Returns true if either is enabled.
 *
 * Use this hook to conditionally disable animations or transitions in your components:
 *
 * @example Basic usage
 * ```tsx
 * const reducedMotion = useReducedMotion()
 * return (
 *   <div style={{
 *     transition: reducedMotion ? 'none' : 'opacity 0.3s ease'
 *   }}>
 *     Content
 *   </div>
 * )
 * ```
 *
 * @example In Recharts animations
 * ```tsx
 * const reducedMotion = useReducedMotion()
 * return (
 *   <Area
 *     isAnimationActive={!reducedMotion}
 *     animationDuration={reducedMotion ? 0 : 300}
 *   />
 * )
 * ```
 *
 * @returns true if reduced motion is active (user pref OR system setting)
 */
export function useReducedMotion(): boolean {
  const { preferences } = usePreferences()
  const [systemReducedMotion, setSystemReducedMotion] = useState(false)

  useEffect(() => {
    // Check initial system setting
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setSystemReducedMotion(mediaQuery.matches)

    // Listen for system setting changes
    const handler = (e: MediaQueryListEvent) => {
      setSystemReducedMotion(e.matches)
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return preferences.reducedMotion || systemReducedMotion
}
