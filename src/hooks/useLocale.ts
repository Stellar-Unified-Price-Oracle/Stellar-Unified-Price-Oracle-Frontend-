import { useTranslation } from 'react-i18next'
import { usePreferences } from '../preferences/PreferencesContext'
import { getEffectiveLocale } from '../i18n/localeMapping'
import type { SupportedLanguage } from '../i18n'

/**
 * Hook that returns the effective locale for Intl formatting APIs.
 *
 * Combines the user's language preference (from i18n) with their format locale
 * override (from preferences). If format locale is 'auto', it derives the locale
 * from the current language.
 *
 * @returns Intl-compatible locale string (e.g., 'en-US', 'de-DE'), or undefined
 * to use the browser's default locale
 *
 * @example Basic usage
 * ```tsx
 * const locale = useLocale()
 * const formatted = new Intl.NumberFormat(locale).format(1234.56)
 * // Output depends on locale:
 * //   en-US: "1,234.56"
 * //   de-DE: "1.234,56"
 * //   fr-FR: "1 234,56"
 * ```
 *
 * @example In formatting functions
 * ```tsx
 * import { useLocale } from '../hooks/useLocale'
 *
 * export function PriceDisplay({ price }: { price: number }) {
 *   const locale = useLocale()
 *   const formatted = new Intl.NumberFormat(locale, {
 *     style: 'currency',
 *     currency: 'USD',
 *   }).format(price)
 *   return <span>{formatted}</span>
 * }
 * ```
 *
 * @example Responding to preference changes
 * ```tsx
 * const locale = useLocale()
 * useEffect(() => {
 *   // Re-format whenever locale changes
 *   const formatted = formatPrice(price, locale)
 *   setDisplayValue(formatted)
 * }, [locale, price])
 * ```
 *
 * ### How it works
 *
 * 1. Gets the current i18n language from `useTranslation()`
 * 2. Gets the user's format locale preference from `usePreferences()`
 * 3. Calls `getEffectiveLocale()` to resolve the final locale:
 *    - If preference is 'auto': uses the language-derived locale (e.g., 'en' → 'en-US')
 *    - Otherwise: uses the explicitly selected locale (e.g., 'de-DE')
 *
 * ### Dependency tracking
 *
 * The hook returns a new locale string whenever either condition changes:
 * - User changes their language in i18next
 * - User changes their format locale in preferences
 * - User changes formatLocale from 'auto' to an explicit value or vice versa
 *
 * This ensures formatted values re-compute correctly when either preference changes.
 */
export function useLocale(): string | undefined {
  const { i18n } = useTranslation()
  const { preferences } = usePreferences()

  const currentLanguage = i18n.language.split('-')[0] as SupportedLanguage
  const effectiveLocale = getEffectiveLocale(preferences.formatLocale, currentLanguage)

  return effectiveLocale
}
