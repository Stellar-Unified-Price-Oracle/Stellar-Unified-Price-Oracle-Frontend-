import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPageview } from '../hooks/useAnalytics'
import { trackAnalytics } from './analytics'

/**
 * Hook to track page views and route changes with analytics.
 * Automatically sends pageview events when the route changes.
 *
 * Usage:
 * ```tsx
 * function App() {
 *   useAnalyticsRouting()
 *   return <Routes>...</Routes>
 * }
 * ```
 */
export function useAnalyticsRouting(): void {
  const location = useLocation()

  useEffect(() => {
    // Track pageview with the provider (Plausible/Umami)
    trackPageview(location.pathname)

    // Also send to our analytics utility for custom endpoint
    trackAnalytics('navigation', 'pageview', {
      path: location.pathname,
      search: location.search || undefined,
    })

    if (import.meta.env.DEV) {
      console.debug('[Analytics] Page view:', location.pathname)
    }
  }, [location.pathname, location.search])
}

/**
 * Track navigation to a specific page/section.
 * Use this for custom navigation events (e.g., click on a link).
 */
export function trackNavigation(
  destination: string,
  source?: string,
): void {
  trackAnalytics('navigation', 'navigate', {
    destination,
    source: source || 'unknown',
  })
}

/**
 * Track when user leaves the application (e.g., clicks external link).
 */
export function trackExternalNavigation(
  url: string,
  source?: string,
): void {
  trackAnalytics('navigation', 'external_link', {
    url,
    source: source || 'unknown',
  })
}
