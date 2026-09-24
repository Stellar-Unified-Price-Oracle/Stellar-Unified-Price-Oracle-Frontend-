import { describe, it, expect } from 'vitest'
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
})
