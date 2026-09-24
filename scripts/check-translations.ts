#!/usr/bin/env node

/**
 * Translation completeness check script.
 *
 * Validates that:
 * 1. All language files have the same keys as English
 * 2. No translation keys are empty
 * 3. All interpolation variables match between languages
 * 4. No extra or missing keys exist
 *
 * Exit codes:
 * - 0: All translations valid
 * - 1: Validation errors found
 *
 * Usage:
 * ```bash
 * npx ts-node scripts/check-translations.ts
 * npm run check:translations
 * ```
 */

import en from '../src/i18n/locales/en'
import es from '../src/i18n/locales/es'
import fr from '../src/i18n/locales/fr'
import ja from '../src/i18n/locales/ja'
import {
  getKeysByLanguage,
  compareKeysByLanguage,
  validateAllInterpolations,
} from '../src/i18n/keyExtractor'

const locales = { en, es, fr, ja }

let hasErrors = false

console.log('🔍 Checking translation completeness...\n')

// ─────────────────────────────────────────────────────────────────────────
// 1. Check key consistency
// ─────────────────────────────────────────────────────────────────────────

console.log('📋 Checking key consistency...')
const keysByLanguage = getKeysByLanguage(locales)
const report = compareKeysByLanguage(keysByLanguage, 'en')

for (const [lang, { missing, extra }] of Object.entries(report)) {
  if (missing.length > 0) {
    console.error(`❌ ${lang.toUpperCase()}: Missing ${missing.length} key(s):`)
    missing.forEach((key) => console.error(`   - ${key}`))
    hasErrors = true
  }

  if (extra.length > 0) {
    console.error(`❌ ${lang.toUpperCase()}: Extra ${extra.length} key(s):`)
    extra.forEach((key) => console.error(`   - ${key}`))
    hasErrors = true
  }
}

if (Object.values(report).every((r) => r.missing.length === 0 && r.extra.length === 0)) {
  console.log('✅ All languages have consistent keys with English\n')
} else {
  console.log('')
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Check for empty strings
// ─────────────────────────────────────────────────────────────────────────

console.log('🔤 Checking for empty translations...')

function checkEmptyStrings(
  obj: Record<string, unknown>,
  lang: string,
  prefix = '',
): { hasErrors: boolean; count: number } {
  let errors = 0
  let count = 0

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const result = checkEmptyStrings(value as Record<string, unknown>, lang, fullKey)
      errors += result.errors
      count += result.count
    } else if (typeof value === 'string') {
      count++
      if (value.length === 0) {
        console.error(`❌ ${lang.toUpperCase()}: Empty string at ${fullKey}`)
        errors++
        hasErrors = true
      }
    }
  }

  return { errors, count: count }
}

for (const [lang, locale] of Object.entries(locales)) {
  const { count } = checkEmptyStrings(locale as Record<string, unknown>, lang)
  console.log(`✅ ${lang.toUpperCase()}: ${count} non-empty translations`)
}
console.log('')

// ─────────────────────────────────────────────────────────────────────────
// 3. Check interpolation consistency
// ─────────────────────────────────────────────────────────────────────────

console.log('🔗 Checking interpolation variable consistency...')

const languages = ['es', 'fr', 'ja'] as const
let interpolationErrors = 0

for (const lang of languages) {
  const errors = validateAllInterpolations(en, locales[lang])
  if (errors.length > 0) {
    console.error(`❌ ${lang.toUpperCase()}: Interpolation errors:`)
    errors.forEach((err) => console.error(`   - ${err}`))
    interpolationErrors += errors.length
    hasErrors = true
  }
}

if (interpolationErrors === 0) {
  console.log('✅ All interpolation variables match English\n')
} else {
  console.log('')
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Summary
// ─────────────────────────────────────────────────────────────────────────

if (hasErrors) {
  console.log('❌ Translation validation failed')
  process.exit(1)
} else {
  console.log('✅ All translations valid!')
  const stats = Object.entries(keysByLanguage).map(([lang, keys]) => `${lang}: ${keys.size} keys`)
  console.log(`📊 ${stats.join(', ')}`)
  process.exit(0)
}
