import { describe, it, expect } from 'vitest'
import {
  formatPrice,
  formatPriceShort,
  formatChartPrice,
  formatTimestamp,
  formatChartTime,
  formatChartTimeWithTz,
  getTimezoneAbbr,
} from './format'

describe('Locale-aware formatting', () => {
  // Test timestamp (2024-01-15T14:30:45 UTC)
  const testTimestamp = 1705327845000

  describe('formatPrice', () => {
    it('formats prices with en-US locale (default)', () => {
      expect(formatPrice(1234.5678)).toBe('1,234.5678')
      expect(formatPrice(1234.5678, 'en-US')).toBe('1,234.5678')
    })

    it('formats prices with de-DE locale (comma decimals)', () => {
      expect(formatPrice(1234.5678, 'de-DE')).toBe('1.234,57')
    })

    it('formats prices with fr-FR locale (space thousands)', () => {
      expect(formatPrice(1234.5678, 'fr-FR')).toBe('1 234,57')
    })

    it('uses correct decimal places based on magnitude', () => {
      // >= 1000: 2 decimal places
      expect(formatPrice(1000.123456, 'en-US')).toBe('1,000.12')
      // >= 1: 4 decimal places
      expect(formatPrice(10.123456, 'en-US')).toBe('10.1235')
      // < 1: 6-8 decimal places
      expect(formatPrice(0.123456789, 'en-US')).toMatch(/0\.123457/)
    })

    it('handles different locales for small numbers', () => {
      expect(formatPrice(0.123456, 'de-DE')).toContain(',')
      expect(formatPrice(0.123456, 'fr-FR')).toContain(',')
    })

    it('defaults to en-US when no locale provided', () => {
      const result = formatPrice(1234.56)
      expect(result).toBe('1,234.56')
    })
  })

  describe('formatPriceShort', () => {
    it('formats without maximum fraction digits', () => {
      const price = 0.123456789
      const result = formatPriceShort(price, 'en-US')
      // Should have more precision than formatPrice
      expect(result.length).toBeGreaterThan(formatPrice(price, 'en-US').length)
    })

    it('respects locale decimal separators', () => {
      expect(formatPriceShort(1234.5, 'en-US')).toContain(',')
      expect(formatPriceShort(1234.5, 'de-DE')).toContain('.')
    })
  })

  describe('formatChartPrice', () => {
    it('formats chart prices with correct scale', () => {
      expect(formatChartPrice(5000.1, 'en-US')).toBe('5,000.1')
      expect(formatChartPrice(50.123456, 'en-US')).toBe('50.1235')
      expect(formatChartPrice(0.5, 'en-US')).toBe('0.5')
    })

    it('respects locale formatting', () => {
      expect(formatChartPrice(1234.5, 'de-DE')).toBe('1.234,5')
      expect(formatChartPrice(1234.5, 'fr-FR')).toContain(' ')
    })

    it('defaults to en-US when no locale provided', () => {
      const result = formatChartPrice(1234.56)
      expect(result).toContain(',')
    })
  })

  describe('formatTimestamp', () => {
    it('formats timestamps with en-US locale (default)', () => {
      const result = formatTimestamp(testTimestamp, 'en-US')
      expect(result).toMatch(/Jan.*15.*14:30:45/)
    })

    it('formats timestamps with de-DE locale', () => {
      const result = formatTimestamp(testTimestamp, 'de-DE')
      // German format: "15. Jan., 14:30:45"
      expect(result).toContain('15')
      expect(result).toContain('14:30:45')
    })

    it('formats timestamps with ja-JP locale', () => {
      const result = formatTimestamp(testTimestamp, 'ja-JP')
      // Japanese has different characters
      expect(result.length).toBeGreaterThan(0)
    })

    it('defaults to en-US when no locale provided', () => {
      const result = formatTimestamp(testTimestamp)
      expect(result).toMatch(/Jan.*15.*14:30:45/)
    })
  })

  describe('formatChartTime', () => {
    it('formats time with en-US locale (default)', () => {
      const result = formatChartTime(testTimestamp, 'en-US')
      expect(result).toMatch(/\d{1,2}:\d{2}/)
    })

    it('formats time with different locales', () => {
      const enResult = formatChartTime(testTimestamp, 'en-US')
      const deResult = formatChartTime(testTimestamp, 'de-DE')
      const jaResult = formatChartTime(testTimestamp, 'ja-JP')
      
      expect(enResult).toBeDefined()
      expect(deResult).toBeDefined()
      expect(jaResult).toBeDefined()
    })

    it('defaults to en-US when no locale provided', () => {
      const result = formatChartTime(testTimestamp)
      expect(result).toMatch(/\d{1,2}:\d{2}/)
    })
  })

  describe('formatChartTimeWithTz', () => {
    it('formats time with UTC timezone', () => {
      const result = formatChartTimeWithTz(testTimestamp, 'UTC', 'en-US')
      expect(result).toMatch(/\d{1,2}:\d{2}/)
    })

    it('formats time with specific timezone', () => {
      const resultUTC = formatChartTimeWithTz(testTimestamp, 'UTC', 'en-US')
      const resultNY = formatChartTimeWithTz(testTimestamp, 'America/New_York', 'en-US')
      // Both should be valid time strings, though times may differ due to TZ offset
      expect(resultUTC).toMatch(/\d{1,2}:\d{2}/)
      expect(resultNY).toMatch(/\d{1,2}:\d{2}/)
    })

    it('handles Local timezone', () => {
      const result = formatChartTimeWithTz(testTimestamp, 'Local', 'en-US')
      expect(result).toMatch(/\d{1,2}:\d{2}/)
    })

    it('defaults to en-US locale when not specified', () => {
      const result = formatChartTimeWithTz(testTimestamp, 'UTC')
      expect(result).toMatch(/\d{1,2}:\d{2}/)
    })
  })

  describe('getTimezoneAbbr', () => {
    it('returns UTC for UTC timezone', () => {
      const abbr = getTimezoneAbbr('UTC', testTimestamp, 'en-US')
      expect(abbr).toBe('UTC')
    })

    it('returns Local for Local timezone', () => {
      const abbr = getTimezoneAbbr('Local', testTimestamp, 'en-US')
      expect(abbr).toBe('Local')
    })

    it('returns timezone abbreviation for specific timezone', () => {
      // Test with America/New_York which should give EST or EDT
      const abbr = getTimezoneAbbr('America/New_York', testTimestamp, 'en-US')
      expect(abbr).toBeTruthy()
      expect(abbr.length).toBeGreaterThan(0)
    })

    it('respects locale for timezone names', () => {
      const enAbbr = getTimezoneAbbr('UTC', testTimestamp, 'en-US')
      const deAbbr = getTimezoneAbbr('UTC', testTimestamp, 'de-DE')
      // Both should be valid
      expect(enAbbr).toBeTruthy()
      expect(deAbbr).toBeTruthy()
    })

    it('defaults to en-US locale when not specified', () => {
      const abbr = getTimezoneAbbr('UTC', testTimestamp)
      expect(abbr).toBe('UTC')
    })

    it('handles invalid timezone gracefully', () => {
      const abbr = getTimezoneAbbr('Invalid/Timezone', testTimestamp, 'en-US')
      // Should fall back to the timezone string itself
      expect(abbr).toBeDefined()
    })
  })

  describe('locale comparison', () => {
    const testPrice = 1234.567

    it('differentiates between decimal separators', () => {
      const enUS = formatPrice(testPrice, 'en-US') // 1,234.57
      const deDE = formatPrice(testPrice, 'de-DE') // 1.234,57
      const frFR = formatPrice(testPrice, 'fr-FR') // 1 234,57

      expect(enUS).toContain('.')
      expect(enUS).not.toContain(',')
      
      expect(deDE).toContain(',')
      expect(deDE).toContain('.')
      
      expect(frFR).toContain(',')
      expect(frFR).toContain(' ')
    })

    it('differentiates between thousands separators', () => {
      const enUS = formatPrice(testPrice, 'en-US')
      const deDE = formatPrice(testPrice, 'de-DE')
      const frFR = formatPrice(testPrice, 'fr-FR')

      // en-US uses comma for thousands
      expect(enUS).toMatch(/1,234/)
      // de-DE uses period for thousands
      expect(deDE).toMatch(/1\.234/)
      // fr-FR uses space for thousands
      expect(frFR).toMatch(/1 234/)
    })

    it('produces locale-specific output', () => {
      const results = {
        'en-US': formatPrice(testPrice, 'en-US'),
        'de-DE': formatPrice(testPrice, 'de-DE'),
        'fr-FR': formatPrice(testPrice, 'fr-FR'),
        'es-ES': formatPrice(testPrice, 'es-ES'),
        'ja-JP': formatPrice(testPrice, 'ja-JP'),
      }

      // Each locale should produce distinct formatting
      const uniqueFormats = new Set(Object.values(results))
      expect(uniqueFormats.size).toBeGreaterThan(1)
    })
  })
})
