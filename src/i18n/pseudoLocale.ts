/**
 * Pseudo-localization utilities for detecting missing or broken translations.
 *
 * Pseudo-localization wraps English text with markers to make it easy to spot
 * UI issues caused by untranslated strings, missing keys, or text overflow.
 *
 * Common pseudo-localization formats:
 * - [key_name] — Wraps each key with brackets, e.g., "[nav.dashboard]"
 * - Expansion — Adds padding to simulate longer European languages
 * - RTL markers — Marks text direction changes for RTL testing
 *
 * @example
 * ```tsx
 * import { createPseudoLocale, getPseudoLocaleVariant } from './pseudoLocale'
 *
 * // Create pseudo locale with key wrapping
 * const pseudoEn = createPseudoLocale(enLocale, { mode: 'keys' })
 *
 * // Use in i18n
 * i18n.addResourceBundle('pseudo', 'translation', pseudoEn)
 * await i18n.changeLanguage('pseudo')
 *
 * // Now all UI text shows keys: [nav.dashboard], [error.title], etc.
 * ```
 *
 * @see https://www.w3.org/International/articles/pseudolocales/
 */

/**
 * Pseudo-localization mode.
 *
 * - 'keys' — Wrap each translation value with its key name: "[key_name]"
 * - 'expand' — Add 30% padding to simulate longer languages (e.g., German, French)
 * - 'both' — Apply both key wrapping and expansion
 * - 'rtl' — Mark RTL text with directionality markers for RTL testing
 */
export type PseudoLocaleMode = 'keys' | 'expand' | 'both' | 'rtl'

/**
 * Options for pseudo-localization.
 */
export interface PseudoLocaleOptions {
  /** Pseudo-localization mode (default: 'keys') */
  mode?: PseudoLocaleMode
  /** Expansion factor for 'expand' mode (default: 1.3 = 30% padding) */
  expansionFactor?: number
  /** Prefix for key wrapping (default: '[') */
  keyPrefix?: string
  /** Suffix for key wrapping (default: ']') */
  keySuffix?: string
  /** Character to use for expansion padding (default: '·') */
  paddingChar?: string
}

/**
 * Expands a string by adding padding characters to simulate longer translations.
 *
 * Useful for detecting UI layout issues that occur with longer European languages.
 *
 * @param text - Original text
 * @param factor - Expansion factor (1.3 = 30% padding)
 * @param paddingChar - Character to add (default: '·')
 * @returns Expanded string
 *
 * @example
 * ```
 * expandText('Dashboard', 1.3, '·')  // "Dashboard······"
 * expandText('Home', 1.5, '-')        // "Home----------"
 * ```
 */
export function expandText(text: string, factor = 1.3, paddingChar = '·'): string {
  const targetLength = Math.ceil(text.length * factor)
  const paddingLength = Math.max(0, targetLength - text.length)
  return text + paddingChar.repeat(paddingLength)
}

/**
 * Wraps a text with key markers for pseudo-localization.
 *
 * Makes it easy to see which UI text is using which translation key.
 *
 * @param text - Original text
 * @param key - Translation key
 * @param prefix - Wrapping prefix (default: '[')
 * @param suffix - Wrapping suffix (default: ']')
 * @returns Wrapped text with key
 *
 * @example
 * ```
 * wrapWithKey('Dashboard', 'nav.dashboard')     // "[nav.dashboard] Dashboard"
 * wrapWithKey('Home', 'nav.home', '{', '}')     // "{nav.home} Home"
 * ```
 */
export function wrapWithKey(
  text: string,
  key: string,
  prefix = '[',
  suffix = ']',
): string {
  return `${prefix}${key}${suffix} ${text}`
}

/**
 * Adds RTL markers to text for testing RTL layout.
 *
 * Unicode RTL markers help test that RTL languages render correctly.
 *
 * @param text - Original text
 * @param addMarkers - Whether to add Unicode markers (default: true)
 * @returns Text with RTL markers
 *
 * @example
 * ```
 * markRTL('Dashboard')  // "\u202EDashboard\u202C" (RTL-marked)
 * ```
 */
export function markRTL(text: string, addMarkers = true): string {
  if (!addMarkers) return text
  // U+202E = RTL Override, U+202C = Pop Directional Formatting
  return '\u202E' + text + '\u202C'
}

/**
 * Creates a pseudo-localized version of a locale object.
 *
 * Recursively transforms all string values according to the pseudo-localization mode.
 *
 * @param locale - Original locale object
 * @param options - Pseudo-localization options
 * @returns Pseudo-localized locale object
 *
 * @example
 * ```
 * const pseudo = createPseudoLocale(enLocale, { mode: 'keys' })
 * // pseudo.nav.dashboard = "[nav.dashboard] Dashboard"
 * ```
 */
export function createPseudoLocale(
  locale: Record<string, unknown>,
  options: PseudoLocaleOptions = {},
): Record<string, unknown> {
  const {
    mode = 'keys',
    expansionFactor = 1.3,
    keyPrefix = '[',
    keySuffix = ']',
    paddingChar = '·',
  } = options

  function transform(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recurse into nested objects
        result[key] = transform(value as Record<string, unknown>, fullKey)
      } else if (typeof value === 'string') {
        // Transform the string value
        let transformed = value

        if (mode === 'keys' || mode === 'both' || mode === 'rtl') {
          transformed = wrapWithKey(transformed, fullKey, keyPrefix, keySuffix)
        }

        if (mode === 'expand' || mode === 'both') {
          transformed = expandText(transformed, expansionFactor, paddingChar)
        }

        if (mode === 'rtl') {
          transformed = markRTL(transformed)
        }

        result[key] = transformed
      } else {
        // Keep other types as-is
        result[key] = value
      }
    }

    return result
  }

  return transform(locale)
}

/**
 * Gets a pseudo-localization variant of a locale for testing.
 *
 * Allows switching pseudo-localization modes dynamically.
 *
 * @param locale - Original locale object
 * @param mode - Pseudo-localization mode
 * @param expansionFactor - Expansion factor for 'expand' mode
 * @returns Pseudo-localized locale object
 *
 * @example
 * ```
 * // For unit tests
 * const keyVariant = getPseudoLocaleVariant(enLocale, 'keys')
 * const expandVariant = getPseudoLocaleVariant(enLocale, 'expand')
 * const rtlVariant = getPseudoLocaleVariant(enLocale, 'rtl')
 * ```
 */
export function getPseudoLocaleVariant(
  locale: Record<string, unknown>,
  mode: PseudoLocaleMode = 'keys',
  expansionFactor = 1.3,
): Record<string, unknown> {
  return createPseudoLocale(locale, { mode, expansionFactor })
}

/**
 * Detects if a string is using pseudo-localization.
 *
 * Useful for assertions in tests to ensure pseudo-locale is active.
 *
 * @param text - Text to check
 * @param options - Detection options
 * @returns true if text appears to be pseudo-localized
 *
 * @example
 * ```
 * isPseudoLocalized('[nav.dashboard] Dashboard')  // true
 * isPseudoLocalized('Dashboard')                  // false
 * ```
 */
export function isPseudoLocalized(
  text: string,
  options: { hasKeyMarkers?: boolean; hasExpansion?: boolean; hasRTL?: boolean } = {},
): boolean {
  const { hasKeyMarkers = true, hasExpansion = false, hasRTL = false } = options

  let matches = true

  if (hasKeyMarkers) {
    // Check for [key] or {key} markers
    matches = matches && /\[[^\]]+\]|\{[^}]+\}/.test(text)
  }

  if (hasExpansion) {
    // Check for padding characters
    matches = matches && /·+|-+|_+/.test(text)
  }

  if (hasRTL) {
    // Check for RTL markers
    matches = matches && /\u202E|\u202C/.test(text)
  }

  return matches
}
