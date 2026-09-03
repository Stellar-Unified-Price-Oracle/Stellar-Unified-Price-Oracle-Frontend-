import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import en from './locales/en'
import i18n from './index'

describe('i18n infrastructure', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('is initialised with English as the default language', () => {
    expect(i18n.language).toBe('en')
    expect(i18n.isInitialized).toBe(true)
  })

  it('resolves top-level English translation keys', () => {
    expect(i18n.t('nav.dashboard')).toBe(en.nav.dashboard)
    expect(i18n.t('notFound.heading')).toBe(en.notFound.heading)
    expect(i18n.t('error.title')).toBe(en.error.title)
  })

  it('resolves dashboard translations', () => {
    expect(i18n.t('dashboard.title')).toBe(en.dashboard.title)
    expect(i18n.t('dashboard.subtitle')).toBe(en.dashboard.subtitle)
  })

  it('interpolates variables correctly', () => {
    expect(i18n.t('dashboard.select.buttonWithCount', { count: 3 })).toBe('Select (3)')
    expect(i18n.t('connection.rateLimitedWithTimer', { seconds: 10 })).toBe('Rate limited (10s)')
    expect(i18n.t('filter.confidence', { min: 20, max: 80 })).toBe('Confidence: 20%–80%')
  })

  it('falls back to English for missing keys in other languages', async () => {
    await i18n.changeLanguage('ja')
    // Japanese locale does not define alertPanel — falls back to English
    expect(i18n.t('alertPanel.empty')).toBe(en.alertPanel.empty)
  })

  it('switches to Spanish and resolves Spanish translations', async () => {
    await i18n.changeLanguage('es')
    expect(i18n.t('notFound.message')).toBe('Página no encontrada')
    expect(i18n.t('error.reload')).toBe('Recargar página')
  })

  it('switches to French and resolves French translations', async () => {
    await i18n.changeLanguage('fr')
    expect(i18n.t('error.title')).toBe("Une erreur s'est produite")
    expect(i18n.t('notFound.backToDashboard')).toBe('Retour au tableau de bord')
  })

  it('switches to Japanese and resolves Japanese translations', async () => {
    await i18n.changeLanguage('ja')
    expect(i18n.t('nav.dashboard')).toBe('ダッシュボード')
    expect(i18n.t('dashboard.title')).toBe('価格オラクルダッシュボード')
  })

  it('falls back to English gracefully for unsupported language', async () => {
    await i18n.changeLanguage('zz') // unsupported code
    expect(i18n.t('nav.dashboard')).toBe(en.nav.dashboard)
  })

  it('all English keys are non-empty strings', () => {
    function assertStrings(obj: Record<string, unknown>, path = ''): void {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = path ? `${path}.${key}` : key
        if (typeof value === 'object' && value !== null) {
          assertStrings(value as Record<string, unknown>, fullKey)
        } else {
          expect(typeof value, `key "${fullKey}" should be a string`).toBe('string')
          expect((value as string).length, `key "${fullKey}" should not be empty`).toBeGreaterThan(0)
        }
      }
    }
    assertStrings(en as unknown as Record<string, unknown>)
  })
})
