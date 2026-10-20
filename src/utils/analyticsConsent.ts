/**
 * Granular opt-in and opt-out controls for product analytics (#847).
 *
 * ## Privacy Guarantees
 * - No personal identifying information (PII) or wallet addresses collected.
 * - Respects Do Not Track (DNT) and Global Privacy Control (GPC).
 * - Full granular control: users can opt into/out of specific categories independently.
 * - Zero third-party tracking cookies or ad tech.
 * - Backwards-compatible with legacy `STORAGE_KEYS.analyticsOptOut`.
 */

import { useState, useEffect, useCallback } from 'react'
import { STORAGE_KEYS, readJson, readRaw, writeJson, writeRaw } from './storage'

export type AnalyticsCategory = 'navigation' | 'feature' | 'performance' | 'engagement'

export interface AnalyticsCategoryInfo {
  id: AnalyticsCategory
  name: string
  description: string
  examples: string
}

export const ANALYTICS_CATEGORIES: readonly AnalyticsCategoryInfo[] = Object.freeze([
  {
    id: 'navigation',
    name: 'Navigation & Page Views',
    description: 'Tracks page route transitions and navigation paths to understand feature discoverability.',
    examples: 'Route changes, page views, external documentation links',
  },
  {
    id: 'feature',
    name: 'Feature Usage & Interactions',
    description: 'Measures how core features are used to help prioritize product improvements.',
    examples: 'CSV/JSON exports, price alert creation/dismissal, search queries, chart zoom/pan',
  },
  {
    id: 'performance',
    name: 'Performance & Diagnostics',
    description: 'Monitors client-side latency, memory usage, and Web Vitals to keep the oracle interface fast.',
    examples: 'LCP, FID, CLS Web Vitals, API response times, websocket reconnect events',
  },
  {
    id: 'engagement',
    name: 'UI Engagement & Usability',
    description: 'Captures UI control interactions to identify workflow friction points.',
    examples: 'Keyboard shortcut triggers, settings/alert drawer toggles, metric help views',
  },
])

export interface AnalyticsConsent {
  /** Master switch: if false, suppresses all analytics regardless of category */
  enabled: boolean
  /** Granular category opt-in/opt-out status */
  categories: Record<AnalyticsCategory, boolean>
  /** ISO timestamp when consent choices were last updated */
  updatedAt: string
  /** Whether the user has actively selected or confirmed their consent preferences */
  hasExplicitChoice: boolean
}

export const DEFAULT_ANALYTICS_CONSENT: AnalyticsConsent = Object.freeze({
  enabled: true,
  categories: {
    navigation: true,
    feature: true,
    performance: true,
    engagement: true,
  },
  updatedAt: new Date(0).toISOString(),
  hasExplicitChoice: false,
})

export const ANALYTICS_CONSENT_EVENT = 'stellar:analytics-consent-changed'

/**
 * Checks if browser has signaled Do Not Track (DNT) or Global Privacy Control (GPC).
 */
export function isDoNotTrackActive(): boolean {
  if (typeof navigator === 'undefined') return false
  try {
    const nav = navigator as Navigator & { doNotTrack?: string; globalPrivacyControl?: boolean }
    return nav.doNotTrack === '1' || nav.globalPrivacyControl === true
  } catch {
    return false
  }
}

/**
 * Validates parsed value conforms to AnalyticsConsent structure.
 */
function isAnalyticsConsent(val: unknown): val is AnalyticsConsent {
  if (!val || typeof val !== 'object') return false
  const c = val as Record<string, unknown>
  if (typeof c.enabled !== 'boolean') return false
  if (!c.categories || typeof c.categories !== 'object') return false
  const cats = c.categories as Record<string, unknown>
  const requiredCategories: AnalyticsCategory[] = ['navigation', 'feature', 'performance', 'engagement']
  return requiredCategories.every((k) => typeof cats[k] === 'boolean')
}

/**
 * Reads current granular consent preferences, handling legacy migration.
 */
export function getAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === 'undefined') return { ...DEFAULT_ANALYTICS_CONSENT }

  // 1. Read stored granular consent if present
  const stored = readJson<AnalyticsConsent | null>(
    STORAGE_KEYS.analyticsConsent,
    null,
    isAnalyticsConsent
  )

  if (stored) {
    return stored
  }

  // 2. If no granular consent is saved, migrate from legacy opt-out flag
  const legacyOptOut = readRaw(STORAGE_KEYS.analyticsOptOut)
  if (legacyOptOut === '1') {
    return {
      enabled: false,
      categories: {
        navigation: false,
        feature: false,
        performance: false,
        engagement: false,
      },
      updatedAt: new Date().toISOString(),
      hasExplicitChoice: true,
    }
  }

  if (legacyOptOut === '0') {
    return {
      ...DEFAULT_ANALYTICS_CONSENT,
      hasExplicitChoice: true,
    }
  }

  return { ...DEFAULT_ANALYTICS_CONSENT }
}

/**
 * Persists updated granular consent choices and dispatches event.
 */
export function saveAnalyticsConsent(consent: AnalyticsConsent): void {
  if (typeof window === 'undefined') return

  const updated: AnalyticsConsent = {
    ...consent,
    updatedAt: new Date().toISOString(),
    categories: {
      navigation: Boolean(consent.categories.navigation),
      feature: Boolean(consent.categories.feature),
      performance: Boolean(consent.categories.performance),
      engagement: Boolean(consent.categories.engagement),
    },
  }

  // Write granular configuration
  writeJson(STORAGE_KEYS.analyticsConsent, updated)

  // Maintain sync with legacy key when an explicit choice is registered
  if (updated.hasExplicitChoice) {
    writeRaw(STORAGE_KEYS.analyticsOptOut, updated.enabled ? '0' : '1')
  }

  // Notify active listeners
  try {
    window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_EVENT, { detail: updated }))
  } catch {
    /* swallow in environments without CustomEvent support */
  }
}

/**
 * Updates a single category opt-in/opt-out status.
 */
export function updateCategoryConsent(category: AnalyticsCategory, optedIn: boolean): AnalyticsConsent {
  const current = getAnalyticsConsent()
  const next: AnalyticsConsent = {
    ...current,
    enabled: optedIn ? true : current.enabled, // Re-enable master if user explicitly enables a category
    categories: {
      ...current.categories,
      [category]: optedIn,
    },
    hasExplicitChoice: true,
  }
  saveAnalyticsConsent(next)
  return next
}

/**
 * Sets master analytics toggle.
 */
export function setMasterAnalyticsConsent(enabled: boolean): AnalyticsConsent {
  const current = getAnalyticsConsent()
  const next: AnalyticsConsent = {
    ...current,
    enabled,
    hasExplicitChoice: true,
  }
  saveAnalyticsConsent(next)
  return next
}

/**
 * Accept all categories and mark explicit choice.
 */
export function acceptAllAnalyticsConsent(): AnalyticsConsent {
  const next: AnalyticsConsent = {
    enabled: true,
    categories: {
      navigation: true,
      feature: true,
      performance: true,
      engagement: true,
    },
    updatedAt: new Date().toISOString(),
    hasExplicitChoice: true,
  }
  saveAnalyticsConsent(next)
  return next
}

/**
 * Decline/opt-out of all non-essential analytics.
 */
export function declineAllAnalyticsConsent(): AnalyticsConsent {
  const next: AnalyticsConsent = {
    enabled: false,
    categories: {
      navigation: false,
      feature: false,
      performance: false,
      engagement: false,
    },
    updatedAt: new Date().toISOString(),
    hasExplicitChoice: true,
  }
  saveAnalyticsConsent(next)
  return next
}

/**
 * Resets consent to default values.
 */
export function resetAnalyticsConsent(): AnalyticsConsent {
  const reset: AnalyticsConsent = {
    ...DEFAULT_ANALYTICS_CONSENT,
    updatedAt: new Date().toISOString(),
    hasExplicitChoice: false,
  }
  saveAnalyticsConsent(reset)
  return reset
}

/**
 * Evaluates whether tracking is permitted for a specific category or in general.
 */
export function isCategoryAllowed(category?: AnalyticsCategory | string): boolean {
  if (isDoNotTrackActive()) return false

  const consent = getAnalyticsConsent()
  if (!consent.enabled) return false

  if (!category) {
    return Object.values(consent.categories).some(Boolean)
  }

  const catKey = category as AnalyticsCategory
  if (catKey in consent.categories) {
    return Boolean(consent.categories[catKey])
  }

  return consent.enabled
}

/**
 * React hook for consuming and updating analytics consent state reactively.
 */
export function useAnalyticsConsent() {
  const [consent, setConsent] = useState<AnalyticsConsent>(() => getAnalyticsConsent())
  const [dntActive] = useState<boolean>(() => isDoNotTrackActive())

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<AnalyticsConsent>
      if (customEvent.detail) {
        setConsent(customEvent.detail)
      } else {
        setConsent(getAnalyticsConsent())
      }
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.analyticsConsent || e.key === STORAGE_KEYS.analyticsOptOut) {
        setConsent(getAnalyticsConsent())
      }
    }

    window.addEventListener(ANALYTICS_CONSENT_EVENT, handleUpdate)
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, handleUpdate)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const updateCategory = useCallback((category: AnalyticsCategory, optedIn: boolean) => {
    const updated = updateCategoryConsent(category, optedIn)
    setConsent(updated)
  }, [])

  const setMaster = useCallback((enabled: boolean) => {
    const updated = setMasterAnalyticsConsent(enabled)
    setConsent(updated)
  }, [])

  const acceptAll = useCallback(() => {
    const updated = acceptAllAnalyticsConsent()
    setConsent(updated)
  }, [])

  const declineAll = useCallback(() => {
    const updated = declineAllAnalyticsConsent()
    setConsent(updated)
  }, [])

  const resetToDefaults = useCallback(() => {
    const updated = resetAnalyticsConsent()
    setConsent(updated)
  }, [])

  return {
    consent,
    dntActive,
    updateCategory,
    setMaster,
    acceptAll,
    declineAll,
    resetToDefaults,
  }
}
