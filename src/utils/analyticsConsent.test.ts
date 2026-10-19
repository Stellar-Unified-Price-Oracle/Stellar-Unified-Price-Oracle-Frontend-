import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  getAnalyticsConsent,
  saveAnalyticsConsent,
  updateCategoryConsent,
  setMasterAnalyticsConsent,
  acceptAllAnalyticsConsent,
  declineAllAnalyticsConsent,
  resetAnalyticsConsent,
  isCategoryAllowed,
  isDoNotTrackActive,
  DEFAULT_ANALYTICS_CONSENT,
  ANALYTICS_CONSENT_EVENT,
  type AnalyticsConsent,
} from './analyticsConsent'
import { STORAGE_KEYS, readRaw, writeRaw } from './storage'

describe('analyticsConsent utility', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('getAnalyticsConsent', () => {
    it('returns default consent when no storage key exists', () => {
      const consent = getAnalyticsConsent()
      expect(consent.enabled).toBe(true)
      expect(consent.hasExplicitChoice).toBe(false)
      expect(consent.categories.navigation).toBe(true)
      expect(consent.categories.feature).toBe(true)
      expect(consent.categories.performance).toBe(true)
      expect(consent.categories.engagement).toBe(true)
    })

    it('migrates legacy analyticsOptOut === "1" to disabled consent with explicit choice', () => {
      writeRaw(STORAGE_KEYS.analyticsOptOut, '1')
      const consent = getAnalyticsConsent()
      expect(consent.enabled).toBe(false)
      expect(consent.hasExplicitChoice).toBe(true)
      expect(consent.categories.navigation).toBe(false)
      expect(consent.categories.feature).toBe(false)
    })

    it('marks hasExplicitChoice: true if legacy opt-out is explicitly "0"', () => {
      writeRaw(STORAGE_KEYS.analyticsOptOut, '0')
      const consent = getAnalyticsConsent()
      expect(consent.enabled).toBe(true)
      expect(consent.hasExplicitChoice).toBe(true)
    })

    it('reads stored granular preferences when valid', () => {
      const custom: AnalyticsConsent = {
        enabled: true,
        categories: {
          navigation: true,
          feature: false,
          performance: true,
          engagement: false,
        },
        updatedAt: '2026-10-19T12:00:00.000Z',
        hasExplicitChoice: true,
      }
      saveAnalyticsConsent(custom)

      const read = getAnalyticsConsent()
      expect(read.categories.feature).toBe(false)
      expect(read.categories.engagement).toBe(false)
      expect(read.categories.navigation).toBe(true)
      expect(read.categories.performance).toBe(true)
      expect(read.hasExplicitChoice).toBe(true)
    })
  })

  describe('saveAnalyticsConsent', () => {
    it('writes to localStorage and syncs legacy analyticsOptOut', () => {
      const listener = vi.fn()
      window.addEventListener(ANALYTICS_CONSENT_EVENT, listener)

      saveAnalyticsConsent({
        enabled: false,
        categories: { navigation: false, feature: false, performance: false, engagement: false },
        updatedAt: new Date().toISOString(),
        hasExplicitChoice: true,
      })

      expect(readRaw(STORAGE_KEYS.analyticsOptOut)).toBe('1')
      expect(listener).toHaveBeenCalled()

      window.removeEventListener(ANALYTICS_CONSENT_EVENT, listener)
    })

    it('syncs analyticsOptOut to "0" when master is enabled', () => {
      saveAnalyticsConsent({
        enabled: true,
        categories: { navigation: true, feature: true, performance: true, engagement: true },
        updatedAt: new Date().toISOString(),
        hasExplicitChoice: true,
      })

      expect(readRaw(STORAGE_KEYS.analyticsOptOut)).toBe('0')
    })
  })

  describe('updateCategoryConsent', () => {
    it('updates specific category and preserves others', () => {
      const initial = acceptAllAnalyticsConsent()
      expect(initial.categories.feature).toBe(true)

      const updated = updateCategoryConsent('feature', false)
      expect(updated.categories.feature).toBe(false)
      expect(updated.categories.navigation).toBe(true)
      expect(updated.hasExplicitChoice).toBe(true)
    })

    it('re-enables master enabled if user turns on a category while disabled', () => {
      declineAllAnalyticsConsent()
      expect(getAnalyticsConsent().enabled).toBe(false)

      const updated = updateCategoryConsent('performance', true)
      expect(updated.enabled).toBe(true)
      expect(updated.categories.performance).toBe(true)
    })
  })

  describe('quick action helpers', () => {
    it('acceptAllAnalyticsConsent enables all categories and marks explicit choice', () => {
      const consent = acceptAllAnalyticsConsent()
      expect(consent.enabled).toBe(true)
      expect(consent.hasExplicitChoice).toBe(true)
      expect(Object.values(consent.categories).every(Boolean)).toBe(true)
    })

    it('declineAllAnalyticsConsent disables all categories and master switch', () => {
      const consent = declineAllAnalyticsConsent()
      expect(consent.enabled).toBe(false)
      expect(consent.hasExplicitChoice).toBe(true)
      expect(Object.values(consent.categories).every((v) => v === false)).toBe(true)
    })

    it('resetAnalyticsConsent restores default state and unmarks explicit choice', () => {
      acceptAllAnalyticsConsent()
      const reset = resetAnalyticsConsent()
      expect(reset.hasExplicitChoice).toBe(false)
      expect(reset.categories.feature).toBe(DEFAULT_ANALYTICS_CONSENT.categories.feature)
    })

    it('setMasterAnalyticsConsent updates master switch', () => {
      setMasterAnalyticsConsent(false)
      expect(getAnalyticsConsent().enabled).toBe(false)
      setMasterAnalyticsConsent(true)
      expect(getAnalyticsConsent().enabled).toBe(true)
    })
  })

  describe('isCategoryAllowed', () => {
    it('returns false if master consent is disabled', () => {
      declineAllAnalyticsConsent()
      expect(isCategoryAllowed('navigation')).toBe(false)
      expect(isCategoryAllowed('feature')).toBe(false)
    })

    it('returns false for disabled category even when master is enabled', () => {
      acceptAllAnalyticsConsent()
      updateCategoryConsent('engagement', false)

      expect(isCategoryAllowed('navigation')).toBe(true)
      expect(isCategoryAllowed('engagement')).toBe(false)
    })

    it('respects Do Not Track header', () => {
      acceptAllAnalyticsConsent()
      expect(isCategoryAllowed('navigation')).toBe(true)

      Object.defineProperty(navigator, 'doNotTrack', {
        value: '1',
        configurable: true,
      })

      expect(isDoNotTrackActive()).toBe(true)
      expect(isCategoryAllowed('navigation')).toBe(false)
      expect(isCategoryAllowed('feature')).toBe(false)

      Object.defineProperty(navigator, 'doNotTrack', {
        value: undefined,
        configurable: true,
      })
    })

    it('checks general allowed state when no category is specified', () => {
      acceptAllAnalyticsConsent()
      expect(isCategoryAllowed()).toBe(true)

      declineAllAnalyticsConsent()
      expect(isCategoryAllowed()).toBe(false)
    })
  })
})
