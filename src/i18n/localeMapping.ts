/**
 * Locale mapping utilities for Intl formatting.
 *
 * Maps i18n language codes to IANA locale codes for use with Intl.DateTimeFormat,
 * Intl.NumberFormat, etc.
 *
 * @example
 * ```tsx
 * const locale = getLocaleFromLanguage('fr') // 'fr-FR'
 * const formatted = new Intl.NumberFormat(locale).format(1234.56)
 * ```
 */

import type { SupportedLanguage } from '../i18n'
import type { LocaleCode } from '../preferences/types'

/**
 * Mapping from i18n language codes to IANA locale codes.
 * Used by Intl APIs for number/date formatting.
 *
 * Format: BCP 47 (e.g., 'en-US', 'de-DE')
 * @see https://www.iana.org/assignments/language-subtag-registry
 */
const LANGUAGE_TO_LOCALE_MAP: Record<SupportedLanguage, LocaleCode> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  ja: 'ja-JP',
}

/**
 * Resolves a locale code to an Intl-compatible locale string.
 *
 * - If 'auto' is passed, returns undefined (uses browser default)
 * - Otherwise returns the IANA locale code as-is
 *
 * @param locale - Locale code from preferences ('auto', 'en-US', 'de-DE', etc.)
 * @returns Intl-compatible locale string, or undefined for 'auto'
 */
export function resolveLocale(locale: LocaleCode): string | undefined {
  if (locale === 'auto') return undefined
  return locale
}

/**
 * Gets the IANA locale code for a given i18n language.
 *
 * @param language - i18n language code ('en', 'es', 'fr', 'ja')
 * @returns IANA locale code (e.g., 'en-US', 'de-DE')
 *
 * @example
 * ```
 * getLocaleFromLanguage('fr') // 'fr-FR'
 * getLocaleFromLanguage('ja') // 'ja-JP'
 * ```
 */
export function getLocaleFromLanguage(language: SupportedLanguage): LocaleCode {
  return LANGUAGE_TO_LOCALE_MAP[language]
}

/**
 * Determines the effective Intl locale for formatting based on user preferences.
 *
 * Priority:
 * 1. If `formatLocale` is 'auto', derives from the i18n language
 * 2. Otherwise uses the explicitly selected `formatLocale`
 *
 * @param formatLocale - User's format locale preference ('auto', 'en-US', etc.)
 * @param currentLanguage - Current i18n language code
 * @returns Intl-compatible locale string, or undefined if 'auto' should use browser default
 *
 * @example
 * ```
 * // User has formatLocale='auto' and language is German
 * getEffectiveLocale('auto', 'de') // Returns 'de-DE' (derived from language)
 *
 * // User explicitly chose German formatting with English language
 * getEffectiveLocale('de-DE', 'en') // Returns 'de-DE'
 * ```
 */
export function getEffectiveLocale(formatLocale: LocaleCode, currentLanguage: SupportedLanguage): string | undefined {
  if (formatLocale === 'auto') {
    // Derive locale from current language
    return getLocaleFromLanguage(currentLanguage)
  }
  // Use explicitly selected locale
  return resolveLocale(formatLocale)
}

/**
 * List of all supported IANA locale codes for Intl formatting.
 * Can be used to validate user selections or provide autocomplete.
 */
export const SUPPORTED_LOCALES: LocaleCode[] = [
  'auto',
  'en-US',
  'de-DE',
  'fr-FR',
  'ja-JP',
  'es-ES',
  'ar-SA',
  'pt-BR',
]

/**
 * Checks if a given locale code is supported.
 *
 * @param locale - Locale code to check
 * @returns true if locale is in SUPPORTED_LOCALES
 */
export function isLocaleSupported(locale: string): locale is LocaleCode {
  return SUPPORTED_LOCALES.includes(locale as LocaleCode)
}
