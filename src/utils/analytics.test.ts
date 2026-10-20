import { describe, it, expect, vi } from 'vitest'
import {
  trackExport,
  trackAlertCreate,
  trackAlertTriggered,
  trackAlertDismiss,
  trackPreferenceChange,
  trackFilterAction,
  trackSearch,
  trackChartInteraction,
  trackPanelToggle,
  trackKeyboardShortcut,
  trackApiDocView,
  type AnalyticsEventCategory,
  type EventProperties,
} from './analytics'

describe('Analytics Utilities', () => {
  describe('exported functions', () => {
    it('exports trackExport function', () => {
      expect(typeof trackExport).toBe('function')
    })

    it('exports trackAlertCreate function', () => {
      expect(typeof trackAlertCreate).toBe('function')
    })

    it('exports trackAlertTriggered function', () => {
      expect(typeof trackAlertTriggered).toBe('function')
    })

    it('exports trackAlertDismiss function', () => {
      expect(typeof trackAlertDismiss).toBe('function')
    })

    it('exports trackPreferenceChange function', () => {
      expect(typeof trackPreferenceChange).toBe('function')
    })

    it('exports trackFilterAction function', () => {
      expect(typeof trackFilterAction).toBe('function')
    })

    it('exports trackSearch function', () => {
      expect(typeof trackSearch).toBe('function')
    })

    it('exports trackChartInteraction function', () => {
      expect(typeof trackChartInteraction).toBe('function')
    })

    it('exports trackPanelToggle function', () => {
      expect(typeof trackPanelToggle).toBe('function')
    })

    it('exports trackKeyboardShortcut function', () => {
      expect(typeof trackKeyboardShortcut).toBe('function')
    })

    it('exports trackApiDocView function', () => {
      expect(typeof trackApiDocView).toBe('function')
    })
  })

  describe('types', () => {
    it('exports AnalyticsEventCategory type', () => {
      const category: AnalyticsEventCategory = 'feature'
      expect(category).toBeDefined()
    })

    it('exports EventProperties type', () => {
      const props: EventProperties = { key: 'value' }
      expect(props).toBeDefined()
    })
  })

  describe('function signatures', () => {
    it('trackExport accepts format and optional row count', () => {
      // Should not throw
      expect(() => trackExport('csv')).not.toThrow()
      expect(() => trackExport('csv', 100)).not.toThrow()
    })

    it('trackAlertCreate accepts alert type', () => {
      expect(() => trackAlertCreate('threshold')).not.toThrow()
      expect(() => trackAlertCreate('percentage')).not.toThrow()
    })

    it('trackFilterAction accepts filter type and action', () => {
      expect(() => trackFilterAction('confidence', 'apply')).not.toThrow()
      expect(() => trackFilterAction('source', 'reset')).not.toThrow()
    })

    it('trackPanelToggle accepts panel type and action', () => {
      expect(() => trackPanelToggle('alerts', 'open')).not.toThrow()
      expect(() => trackPanelToggle('settings', 'close')).not.toThrow()
    })
  })

  describe('granular category consent enforcement', () => {
    it('does not send events when category is opted out', async () => {
      const { updateCategoryConsent, trackAnalytics } = await import('./analytics')
      const beaconMock = vi.fn().mockReturnValue(true)
      Object.defineProperty(navigator, 'sendBeacon', {
        value: beaconMock,
        writable: true,
        configurable: true,
      })

      // Opt out of feature category
      updateCategoryConsent('feature', false)

      trackAnalytics('feature', 'export', { format: 'csv' })
      expect(beaconMock).not.toHaveBeenCalled()
    })

    it('sends events when category is opted in and endpoint configured', async () => {
      const { updateCategoryConsent, trackAnalytics } = await import('./analytics')
      const { config } = await import('../config')
      ;(config as unknown as { analyticsEndpoint: string }).analyticsEndpoint = 'https://analytics.example.com/api'

      const beaconMock = vi.fn().mockReturnValue(true)
      Object.defineProperty(navigator, 'sendBeacon', {
        value: beaconMock,
        writable: true,
        configurable: true,
      })

      // Opt into navigation category
      updateCategoryConsent('navigation', true)

      trackAnalytics('navigation', 'pageview', { path: '/dashboard' })
      expect(beaconMock).toHaveBeenCalledWith(
        'https://analytics.example.com/api',
        expect.any(Blob)
      )

      ;(config as unknown as { analyticsEndpoint: string }).analyticsEndpoint = ''
    })
  })
})
