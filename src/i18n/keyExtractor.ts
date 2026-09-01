/**
 * Translation key extraction utility.
 *
 * Recursively extracts all translation keys from the i18n locale objects
 * to enable validation, completeness checking, and testing.
 *
 * @example
 * ```tsx
 * import { getAllKeys, getKeysByLanguage } from './keyExtractor'
 *
 * // Get all keys from a single language
 * const enKeys = getAllKeys(enLocale)
 *
 * // Get keys from all languages for comparison
 * const keysByLang = getKeysByLanguage({
 *   en: enLocale,
 *   es: esLocale,
 *   fr: frLocale,
 *   ja: jaLocale,
 * })
 *
 * // Find differences
 * const missing = findMissingKeys(keysByLang.en, keysByLang.es)
 * ```
 */

/**
 * Recursively extracts all translation keys from a nested object.
 *
 * Flattens the nested structure into a Set of dot-notation key paths.
 *
 * @param obj - Nested translation object
 * @param prefix - Internal prefix for recursion (start with empty string)
 * @returns Set of all keys in dot notation (e.g., 'nav.dashboard', 'error.title')
 *
 * @example
 * ```
 * const keys = getAllKeys({ nav: { dashboard: 'Dashboard', home: 'Home' } })
 * // Returns Set { 'nav.dashboard', 'nav.home' }
 * ```
 */
export function getAllKeys(obj: Record<string, unknown>, prefix = ''): Set<string> {
  const keys = new Set<string>()

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recurse into nested objects
      const nestedKeys = getAllKeys(value as Record<string, unknown>, fullKey)
      nestedKeys.forEach((k) => keys.add(k))
    } else if (typeof value === 'string') {
      // Leaf node with translation string
      keys.add(fullKey)
    }
    // Skip arrays and other types
  }

  return keys
}

/**
 * Extracts keys from multiple language objects for comparison.
 *
 * Useful for checking that all languages have the same keys.
 *
 * @param locales - Object mapping language codes to their locale objects
 * @returns Object mapping language codes to their Sets of keys
 *
 * @example
 * ```
 * const keysByLang = getKeysByLanguage({
 *   en: enLocale,
 *   es: esLocale,
 *   fr: frLocale,
 * })
 * // Returns { en: Set(...), es: Set(...), fr: Set(...) }
 * ```
 */
export function getKeysByLanguage(
  locales: Record<string, Record<string, unknown>>,
): Record<string, Set<string>> {
  const result: Record<string, Set<string>> = {}

  for (const [lang, locale] of Object.entries(locales)) {
    result[lang] = getAllKeys(locale)
  }

  return result
}

/**
 * Finds keys that are missing from a target language.
 *
 * @param sourceKeys - Set of keys that should exist (typically from 'en')
 * @param targetKeys - Set of keys in the target language
 * @returns Array of key strings missing from target
 *
 * @example
 * ```
 * const missing = findMissingKeys(enKeys, esKeys)
 * // Returns ['error.newKey', 'settings.newOption']
 * ```
 */
export function findMissingKeys(sourceKeys: Set<string>, targetKeys: Set<string>): string[] {
  return Array.from(sourceKeys).filter((key) => !targetKeys.has(key)).sort()
}

/**
 * Finds keys that exist in target but not in source.
 *
 * Useful for detecting extra keys that should be removed.
 *
 * @param sourceKeys - Set of keys that should exist (typically from 'en')
 * @param targetKeys - Set of keys in the target language
 * @returns Array of extra key strings in target
 */
export function findExtraKeys(sourceKeys: Set<string>, targetKeys: Set<string>): string[] {
  return Array.from(targetKeys).filter((key) => !sourceKeys.has(key)).sort()
}

/**
 * Compares all language key sets against a source language.
 *
 * Returns a report of missing and extra keys for each language.
 *
 * @param keysByLanguage - Object mapping languages to their key sets
 * @param sourceLanguage - Reference language (typically 'en')
 * @returns Report object with missing and extra keys per language
 *
 * @example
 * ```
 * const report = compareKeysByLanguage(keysByLang, 'en')
 * console.log(report)
 * // {
 * //   es: { missing: ['error.newKey'], extra: [] },
 * //   fr: { missing: [], extra: [] },
 * //   ja: { missing: ['settings.option'], extra: [] }
 * // }
 * ```
 */
export function compareKeysByLanguage(
  keysByLanguage: Record<string, Set<string>>,
  sourceLanguage: string,
): Record<
  string,
  {
    missing: string[]
    extra: string[]
  }
> {
  const sourceKeys = keysByLanguage[sourceLanguage]
  if (!sourceKeys) {
    throw new Error(`Source language "${sourceLanguage}" not found in keysByLanguage`)
  }

  const result: Record<string, { missing: string[]; extra: string[] }> = {}

  for (const [lang, keys] of Object.entries(keysByLanguage)) {
    if (lang === sourceLanguage) continue

    result[lang] = {
      missing: findMissingKeys(sourceKeys, keys),
      extra: findExtraKeys(sourceKeys, keys),
    }
  }

  return result
}

/**
 * Validates that a key has proper interpolation syntax.
 *
 * Checks for i18next placeholder syntax: {{variableName}}
 *
 * @param value - Translation string to validate
 * @returns Array of detected interpolation variables, or empty if none
 *
 * @example
 * ```
 * getInterpolationVars('Hello {{name}}!')          // ['name']
 * getInterpolationVars('Count: {{count}} items')   // ['count']
 * getInterpolationVars('No variables here')        // []
 * ```
 */
export function getInterpolationVars(value: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g
  const vars: string[] = []
  let match

  while ((match = regex.exec(value)) !== null) {
    vars.push(match[1])
  }

  return vars
}

/**
 * Validates that all translation strings have consistent interpolation.
 *
 * Checks that if a source key uses a variable, the target key uses the same variable.
 *
 * @param sourceValue - Source translation string (typically from 'en')
 * @param targetValue - Target translation string
 * @param key - Key name (for error reporting)
 * @returns Array of validation errors, or empty if valid
 *
 * @example
 * ```
 * validateInterpolation(
 *   'Count: {{count}}',
 *   'Cantidad: {{count}}',
 *   'es.items.count'
 * ) // [] (valid)
 *
 * validateInterpolation(
 *   'Count: {{count}}',
 *   'Cantidad: {{amount}}',  // Wrong variable name!
 *   'es.items.count'
 * ) // ['es.items.count: source uses {{count}}, target uses {{amount}}']
 * ```
 */
export function validateInterpolation(sourceValue: string, targetValue: string, key: string): string[] {
  const sourceVars = getInterpolationVars(sourceValue)
  const targetVars = getInterpolationVars(targetValue)

  const errors: string[] = []

  // Check for missing variables
  sourceVars.forEach((varName) => {
    if (!targetVars.includes(varName)) {
      errors.push(`${key}: missing variable {{${varName}}}`)
    }
  })

  // Check for extra variables
  targetVars.forEach((varName) => {
    if (!sourceVars.includes(varName)) {
      errors.push(`${key}: extra variable {{${varName}}} not in source`)
    }
  })

  return errors
}

/**
 * Validates that all translation strings in target match source interpolation.
 *
 * Recursively compares nested translation objects.
 *
 * @param sourceObj - Source translation object (typically from 'en')
 * @param targetObj - Target translation object
 * @param prefix - Internal prefix for recursion
 * @returns Array of validation errors, or empty if all valid
 *
 * @example
 * ```
 * const errors = validateAllInterpolations(enLocale, esLocale)
 * if (errors.length > 0) {
 *   console.log('Translation errors:')
 *   errors.forEach(err => console.log('  ' + err))
 * }
 * ```
 */
export function validateAllInterpolations(
  sourceObj: Record<string, unknown>,
  targetObj: Record<string, unknown>,
  prefix = '',
): string[] {
  const errors: string[] = []

  for (const [key, sourceValue] of Object.entries(sourceObj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    const targetValue = targetObj[key]

    if (typeof sourceValue === 'object' && sourceValue !== null && !Array.isArray(sourceValue)) {
      if (typeof targetValue === 'object' && targetValue !== null && !Array.isArray(targetValue)) {
        // Recurse into nested objects
        const nestedErrors = validateAllInterpolations(
          sourceValue as Record<string, unknown>,
          targetValue as Record<string, unknown>,
          fullKey,
        )
        errors.push(...nestedErrors)
      }
    } else if (typeof sourceValue === 'string' && typeof targetValue === 'string') {
      // Validate interpolation at leaf node
      const interpolationErrors = validateInterpolation(sourceValue, targetValue, fullKey)
      errors.push(...interpolationErrors)
    }
  }

  return errors
}
