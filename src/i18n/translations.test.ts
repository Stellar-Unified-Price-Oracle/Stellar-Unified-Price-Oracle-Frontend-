import { describe, it, expect } from 'vitest'
import en from './locales/en'
import es from './locales/es'
import fr from './locales/fr'
import ja from './locales/ja'
import {
  getAllKeys,
  getKeysByLanguage,
  findMissingKeys,
  findExtraKeys,
  compareKeysByLanguage,
  getInterpolationVars,
  validateInterpolation,
  validateAllInterpolations,
} from './keyExtractor'

describe('i18n translation validation', () => {
  const locales = { en, es, fr, ja }

  describe('key extraction', () => {
    it('extracts all keys from English locale', () => {
      const keys = getAllKeys(en)
      expect(keys.size).toBeGreaterThan(100)
      expect(keys.has('nav.dashboard')).toBe(true)
      expect(keys.has('error.title')).toBe(true)
      expect(keys.has('dashboard.title')).toBe(true)
    })

    it('extracts keys with dot notation', () => {
      const keys = getAllKeys(en)
      const allDotNotation = Array.from(keys).every((k) => typeof k === 'string' && k.includes('.'))
      expect(allDotNotation).toBe(true)
    })

    it('extracts keys from multiple languages', () => {
      const keysByLang = getKeysByLanguage(locales)
      expect(keysByLang.en).toBeDefined()
      expect(keysByLang.es).toBeDefined()
      expect(keysByLang.fr).toBeDefined()
      expect(keysByLang.ja).toBeDefined()
      expect(keysByLang.en.size).toBeGreaterThan(0)
    })
  })

  describe('key comparison', () => {
    it('finds missing keys in target language', () => {
      const enKeys = getAllKeys(en)
      const esKeys = getAllKeys(es)
      const missing = findMissingKeys(enKeys, esKeys)
      expect(missing).toEqual([])
    })

    it('finds extra keys in target language', () => {
      const enKeys = getAllKeys(en)
      const esKeys = getAllKeys(es)
      const extra = findExtraKeys(enKeys, esKeys)
      expect(extra).toEqual([])
    })

    it('compares all languages against English', () => {
      const keysByLang = getKeysByLanguage(locales)
      const report = compareKeysByLanguage(keysByLang, 'en')

      expect(report.es).toBeDefined()
      expect(report.fr).toBeDefined()
      expect(report.ja).toBeDefined()
      expect(report.es.missing).toEqual([])
      expect(report.es.extra).toEqual([])
    })

    it('all languages have the same key set as English', () => {
      const keysByLang = getKeysByLanguage(locales)
      const enKeys = keysByLang.en
      const otherLangs = ['es', 'fr', 'ja'] as const

      otherLangs.forEach((lang) => {
        const keys = keysByLang[lang]
        expect(keys.size).toBe(enKeys.size)
      })
    })
  })

  describe('interpolation variable extraction', () => {
    it('extracts single interpolation variable', () => {
      const vars = getInterpolationVars('Hello {{name}}!')
      expect(vars).toEqual(['name'])
    })

    it('extracts multiple interpolation variables', () => {
      const vars = getInterpolationVars('{{name}} has {{count}} items')
      expect(vars).toEqual(['name', 'count'])
    })

    it('returns empty array for no variables', () => {
      const vars = getInterpolationVars('No variables here')
      expect(vars).toEqual([])
    })

    it('handles nested braces correctly', () => {
      const vars = getInterpolationVars('Value: {{value}} (default: {{default}})')
      expect(vars).toEqual(['value', 'default'])
    })
  })

  describe('interpolation validation', () => {
    it('validates matching interpolation variables', () => {
      const errors = validateInterpolation('Count: {{count}}', 'Cantidad: {{count}}', 'es.count')
      expect(errors).toEqual([])
    })

    it('detects missing interpolation variables', () => {
      const errors = validateInterpolation('Count: {{count}}', 'Cantidad:', 'es.count')
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0]).toContain('missing variable')
    })

    it('detects extra interpolation variables', () => {
      const errors = validateInterpolation(
        'Count: {{count}}',
        'Cantidad: {{count}} (máximo: {{max}})',
        'es.count',
      )
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0]).toContain('extra variable')
    })

    it('detects wrong variable names', () => {
      const errors = validateInterpolation('Count: {{count}}', 'Cantidad: {{amount}}', 'es.count')
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('complete translation validation', () => {
    it('validates all Spanish interpolation variables', () => {
      const errors = validateAllInterpolations(en, es)
      expect(errors).toEqual([])
    })

    it('validates all French interpolation variables', () => {
      const errors = validateAllInterpolations(en, fr)
      expect(errors).toEqual([])
    })

    it('validates all Japanese interpolation variables', () => {
      const errors = validateAllInterpolations(en, ja)
      expect(errors).toEqual([])
    })
  })

  describe('translation completeness', () => {
    it('all English keys are non-empty strings', () => {
      function assertStrings(obj: Record<string, unknown>, path = ''): string[] {
        const errors: string[] = []
        for (const [key, value] of Object.entries(obj)) {
          const fullKey = path ? `${path}.${key}` : key
          if (typeof value === 'object' && value !== null) {
            errors.push(...assertStrings(value as Record<string, unknown>, fullKey))
          } else if (typeof value !== 'string') {
            errors.push(`${fullKey} is not a string: ${typeof value}`)
          } else if (value.length === 0) {
            errors.push(`${fullKey} is empty`)
          }
        }
        return errors
      }
      const errors = assertStrings(en as unknown as Record<string, unknown>)
      expect(errors).toEqual([])
    })

    it('all Spanish keys are non-empty strings', () => {
      function assertStrings(obj: Record<string, unknown>, path = ''): string[] {
        const errors: string[] = []
        for (const [key, value] of Object.entries(obj)) {
          const fullKey = path ? `${path}.${key}` : key
          if (typeof value === 'object' && value !== null) {
            errors.push(...assertStrings(value as Record<string, unknown>, fullKey))
          } else if (typeof value !== 'string') {
            errors.push(`${fullKey} is not a string: ${typeof value}`)
          } else if (value.length === 0) {
            errors.push(`${fullKey} is empty`)
          }
        }
        return errors
      }
      const errors = assertStrings(es as unknown as Record<string, unknown>)
      expect(errors).toEqual([])
    })

    it('all French keys are non-empty strings', () => {
      function assertStrings(obj: Record<string, unknown>, path = ''): string[] {
        const errors: string[] = []
        for (const [key, value] of Object.entries(obj)) {
          const fullKey = path ? `${path}.${key}` : key
          if (typeof value === 'object' && value !== null) {
            errors.push(...assertStrings(value as Record<string, unknown>, fullKey))
          } else if (typeof value !== 'string') {
            errors.push(`${fullKey} is not a string: ${typeof value}`)
          } else if (value.length === 0) {
            errors.push(`${fullKey} is empty`)
          }
        }
        return errors
      }
      const errors = assertStrings(fr as unknown as Record<string, unknown>)
      expect(errors).toEqual([])
    })

    it('all Japanese keys are non-empty strings', () => {
      function assertStrings(obj: Record<string, unknown>, path = ''): string[] {
        const errors: string[] = []
        for (const [key, value] of Object.entries(obj)) {
          const fullKey = path ? `${path}.${key}` : key
          if (typeof value === 'object' && value !== null) {
            errors.push(...assertStrings(value as Record<string, unknown>, fullKey))
          } else if (typeof value !== 'string') {
            errors.push(`${fullKey} is not a string: ${typeof value}`)
          } else if (value.length === 0) {
            errors.push(`${fullKey} is empty`)
          }
        }
        return errors
      }
      const errors = assertStrings(ja as unknown as Record<string, unknown>)
      expect(errors).toEqual([])
    })

    it('Spanish and English have same number of keys', () => {
      const enKeys = getAllKeys(en)
      const esKeys = getAllKeys(es)
      expect(esKeys.size).toBe(enKeys.size)
    })

    it('French and English have same number of keys', () => {
      const enKeys = getAllKeys(en)
      const frKeys = getAllKeys(fr)
      expect(frKeys.size).toBe(enKeys.size)
    })

    it('Japanese and English have same number of keys', () => {
      const enKeys = getAllKeys(en)
      const jaKeys = getAllKeys(ja)
      expect(jaKeys.size).toBe(enKeys.size)
    })
  })

  describe('edge cases', () => {
    it('handles nested objects correctly', () => {
      const nested = {
        level1: {
          level2: {
            level3: 'Deep value',
          },
        },
      }
      const keys = getAllKeys(nested)
      expect(keys.has('level1.level2.level3')).toBe(true)
    })

    it('skips arrays in nested objects', () => {
      const withArray = {
        items: ['one', 'two', 'three'], // Arrays are skipped
        name: 'Test',
      }
      const keys = getAllKeys(withArray)
      expect(keys.has('name')).toBe(true)
      expect(Array.from(keys).some((k) => k.includes('items'))).toBe(false)
    })

    it('handles interpolation with spaces', () => {
      const vars = getInterpolationVars('Hello {{ name }} and {{ friend }}!')
      expect(vars).toContain('name')
      expect(vars).toContain('friend')
    })
  })
})
