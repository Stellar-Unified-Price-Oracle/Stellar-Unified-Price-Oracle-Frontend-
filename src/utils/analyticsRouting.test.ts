import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { useAnalyticsRouting, trackNavigation, trackExternalNavigation } from './analyticsRouting'

// Mock the analytics modules
vi.mock('../hooks/useAnalytics', () => ({
  trackPageview: vi.fn(),
}))

vi.mock('./analytics', () => ({
  trackAnalytics: vi.fn(),
}))

describe('Analytics Routing', () => {
  describe('useAnalyticsRouting hook', () => {
    it('can be called without errors', () => {
      expect(() => {
        renderHook(() => useAnalyticsRouting(), {
          wrapper: BrowserRouter,
        })
      }).not.toThrow()
    })
  })

  describe('trackNavigation', () => {
    it('is a function', () => {
      expect(typeof trackNavigation).toBe('function')
    })

    it('can be called with destination', () => {
      expect(() => trackNavigation('/dashboard')).not.toThrow()
    })

    it('can be called with destination and source', () => {
      expect(() => trackNavigation('/dashboard', 'navigation_bar')).not.toThrow()
    })
  })

  describe('trackExternalNavigation', () => {
    it('is a function', () => {
      expect(typeof trackExternalNavigation).toBe('function')
    })

    it('can be called with external URL', () => {
      expect(() => trackExternalNavigation('https://example.com')).not.toThrow()
    })

    it('can be called with URL and source', () => {
      expect(() => trackExternalNavigation('https://stellar.org', 'footer_link')).not.toThrow()
    })
  })
})
