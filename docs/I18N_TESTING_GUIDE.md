# i18n Testing Guidelines

This document outlines best practices for testing translations and maintaining translation quality in the Stellar Unified Price Oracle frontend.

## Overview

Translation issues can silently break the UI:
- **Missing keys** lead to displaying untranslated fallback text
- **Text overflow** breaks layouts when translations are longer than English
- **Broken interpolation** causes `{{variable}}` to appear in the UI
- **Key mismatches** between languages make maintenance difficult
- **RTL issues** break layout for Arabic and Hebrew

This testing infrastructure catches all of these issues automatically.

## Testing Infrastructure

### 1. Key Extraction (`src/i18n/keyExtractor.ts`)

Extracts and validates all translation keys from locale objects.

**Core Functions:**
- `getAllKeys(locale)` — Get all keys from a locale (e.g., `['nav.dashboard', 'error.title']`)
- `getKeysByLanguage(locales)` — Extract keys from multiple languages
- `compareKeysByLanguage(keysByLanguage, 'en')` — Find missing/extra keys per language
- `validateAllInterpolations(enLocale, otherLocale)` — Check variable consistency

**Usage in Tests:**
```tsx
import { getAllKeys, compareKeysByLanguage } from '../src/i18n/keyExtractor'

// Check that Spanish has all English keys
const enKeys = getAllKeys(enLocale)
const esKeys = getAllKeys(esLocale)
const missing = findMissingKeys(enKeys, esKeys)
expect(missing).toEqual([]) // Fail if any keys missing
```

### 2. Translation Validation Tests (`src/i18n/translations.test.ts`)

Comprehensive test suite covering:
- All keys present in all languages
- No empty string translations
- Interpolation variables match between languages
- All values are strings (not objects or null)

**Run Tests:**
```bash
npm run test:run -- src/i18n/translations.test.ts
```

**What It Tests:**
```
✅ Key extraction and comparison
✅ Interpolation variable extraction
✅ Interpolation consistency between languages
✅ Translation completeness (no missing/empty keys)
✅ Edge cases (nested objects, arrays, variable spacing)
```

### 3. Pseudo-Localization (`src/i18n/pseudoLocale.ts`)

Transforms translations to make issues visible during development/testing.

**Modes:**

| Mode | Format | Use Case |
|------|--------|----------|
| `keys` | `[nav.dashboard] Dashboard` | Spot missing keys, verify coverage |
| `expand` | `Dashboard······` (30% padding) | Test text overflow, layout issues |
| `both` | Keys + expansion combined | Comprehensive visual testing |
| `rtl` | RTL direction markers | Test RTL layout (Arabic, Hebrew) |

**Usage in Development:**
```tsx
import { createPseudoLocale } from '../src/i18n/pseudoLocale'
import en from '../src/i18n/locales/en'

// Create pseudo locale with key markers
const pseudoEn = createPseudoLocale(en, { mode: 'keys' })

// Add to i18n
i18n.addResourceBundle('pseudo', 'translation', pseudoEn)
await i18n.changeLanguage('pseudo')

// Now UI shows: [nav.dashboard] Dashboard, [error.title] Error, etc.
// Easy to spot which text needs translation keys
```

**Detecting Pseudo-Localization:**
```tsx
import { isPseudoLocalized } from '../src/i18n/pseudoLocale'

const text = '[nav.dashboard] Dashboard'
expect(isPseudoLocalized(text, { hasKeyMarkers: true })).toBe(true)
```

### 4. CI Validation Script (`scripts/check-translations.ts`)

Automated script that validates translations before push/merge.

**Checks:**
1. All languages have same keys as English
2. No empty translation strings
3. All interpolation variables consistent
4. No extra or missing keys

**Run Locally:**
```bash
npx ts-node scripts/check-translations.ts
# or via npm script
npm run check:translations
```

**Output:**
```
🔍 Checking translation completeness...

📋 Checking key consistency...
✅ All languages have consistent keys with English

🔤 Checking for empty translations...
✅ EN: 450 non-empty translations
✅ ES: 450 non-empty translations
✅ FR: 450 non-empty translations
✅ JA: 450 non-empty translations

🔗 Checking interpolation variable consistency...
✅ All interpolation variables match English

✅ All translations valid!
📊 en: 450 keys, es: 450 keys, fr: 450 keys, ja: 450 keys
```

## Common Issues and Detection

### Issue: Missing Translation Key

**Symptom:** UI shows `i18n key 'nav.newButton' not found` or fallback English text

**Detection:** 
- `compareKeysByLanguage()` reports missing keys
- CI check fails with "Missing 1 key(s): nav.newButton"

**Fix:**
1. Add key to all language files
2. Run `npm run check:translations` to verify
3. Commit and push

### Issue: Text Overflow

**Symptom:** German/French translation is longer, breaks layout

**Detection:**
- Run with `createPseudoLocale(locale, { mode: 'expand' })`
- Simulate 30% text expansion (common for European languages)
- Visual regression test catches layout breakage

**Fix:**
1. Increase container width or use flexible layouts
2. Test with pseudo-expanded locale
3. Add Playwright E2E test to catch regression

### Issue: Broken Interpolation Variable

**Symptom:** UI shows `{{count}}` instead of the number

**Cause:** Translation uses wrong variable name (e.g., `{{quantity}}` instead of `{{count}}`)

**Detection:**
- `validateAllInterpolations(en, es)` finds mismatches
- CI script reports: "es.items.count: extra variable {{quantity}}"

**Fix:**
1. Update translation to use correct variable: `{{count}}`
2. Run `npm run check:translations` to verify
3. Update tests if new variables added

### Issue: Key Exists but Value is Empty

**Symptom:** UI shows blank text where translation should appear

**Detection:**
- Unit tests fail: "key 'error.title' is empty"
- CI check reports empty string at that key

**Fix:**
1. Fill in the translation value
2. Don't leave placeholder strings like `""`, `"TODO"`, or `"..."`

### Issue: RTL Layout Broken

**Symptom:** Arabic/Hebrew text displays incorrectly in interface

**Detection:**
- E2E test with `createPseudoLocale(locale, { mode: 'rtl' })`
- Visual regression test catches rendering issues

**Fix:**
1. Check `src/i18n/index.ts` applies `dir="rtl"` correctly
2. Test with `applyRtl(language)` function
3. Verify CSS doesn't hardcode `direction: ltr` or `text-align: left`

## Workflow: Adding a New Translation Key

### 1. Add to English (`src/i18n/locales/en.ts`)

```tsx
const en = {
  myFeature: {
    title: 'My Feature Title',
    description: 'This is what {{item}} does',  // Add interpolation if needed
  },
}
```

### 2. Add to All Other Languages

```tsx
// src/i18n/locales/es.ts
const es = {
  myFeature: {
    title: 'Título de Mi Función',
    description: 'Esto es lo que {{item}} hace',  // Same variables!
  },
}
```

### 3. Run Validation

```bash
npm run check:translations
# Should output: ✅ All translations valid!
```

### 4. Run Tests

```bash
npm run test:run -- src/i18n/translations.test.ts
# All tests should pass
```

### 5. Test in UI

```tsx
import { useTranslation } from 'react-i18next'

export function MyFeature({ item }) {
  const { t } = useTranslation()
  return (
    <div>
      <h2>{t('myFeature.title')}</h2>
      <p>{t('myFeature.description', { item })}</p>
    </div>
  )
}
```

### 6. (Optional) Test with Pseudo-Locale

Switch to pseudo locale in development to verify:
- Key markers appear: `[myFeature.title]`
- Text expands properly: `[myFeature.description] Descripción...······`

## Testing Approaches

### Unit Tests (Automated)

**What They Check:**
- All keys present in all languages
- No empty strings
- Interpolation consistent
- No structural differences

**Run:**
```bash
npm run test:run -- src/i18n/translations.test.ts
```

**When to Add:**
- New translation added
- Changing variable names
- Adding new language

### Visual Regression Tests (E2E - Playwright)

**What They Check:**
- UI layouts don't break with expanded text
- RTL layout displays correctly
- Key text renders without overflow

**Example:**
```tsx
import { test, expect } from '@playwright/test'
import i18n from './src/i18n'
import { createPseudoLocale } from './src/i18n/pseudoLocale'

test('layout respects expanded text (German-like)', async ({ page }) => {
  // Create expanded pseudo-locale
  const pseudo = createPseudoLocale(enLocale, { mode: 'expand' })
  i18n.addResourceBundle('pseudo', 'translation', pseudo)
  
  // Navigate and check layout
  await page.goto('http://localhost:5173')
  await i18n.changeLanguage('pseudo')
  
  // Verify no text overflow
  const overflowElements = await page.locator('.overflow-hidden').all()
  for (const el of overflowElements) {
    const isOverflow = await el.evaluate(e => 
      e.scrollWidth > e.clientWidth
    )
    expect(isOverflow).toBe(false)
  }
})
```

### Manual Testing (During Development)

**Test Pseudo-Locale:**
1. Start dev server: `npm run dev`
2. Open Settings → Language
3. (Optional) Temporarily switch to pseudo-locale
4. Verify all UI elements have proper spacing and no overflow

**Test Each Language:**
1. Switch to Spanish, French, Japanese in Settings
2. Verify prices format correctly (from locale formatting)
3. Check date/time displays per language
4. Scroll and interact to spot any overflow

## Best Practices

### ✅ Do

- **Keep English as source of truth** — All new keys added to English first
- **Use meaningful key names** — `nav.dashboard` not `label1`, `button_text`
- **Match variable names** — If English uses `{{count}}`, all translations use `{{count}}`
- **Test before committing** — Run `npm run check:translations`
- **Document complex keys** — Add comments for context-dependent translations
- **Use pseudo-locale during development** — Catch issues early
- **Write E2E tests for layout** — Prevent text overflow regressions

### ❌ Don't

- **Leave empty strings** — Not even as placeholders
- **Hardcode text** — Always use `t('key')`, never inline English
- **Change variable names** — If English uses `{{item}}`, translation must too
- **Skip validation** — Always run checks before merge
- **Assume translations are short** — Many languages are 30%+ longer
- **Forget RTL testing** — Test with Arabic if supporting RTL languages

## CI Integration

### GitHub Actions Workflow

Add to `.github/workflows/ci.yml`:

```yaml
- name: Check translations
  run: npx ts-node scripts/check-translations.ts
```

This runs on every PR to catch translation issues before merge.

### Pre-push Hook

Add to `.husky/pre-push`:

```bash
echo "Checking translations..."
npx ts-node scripts/check-translations.ts || exit 1
```

## Troubleshooting

### "Key not found" Error

**Problem:** `i18n.t('unknownKey')` returns the key itself

**Solution:**
1. Check key exists in `src/i18n/locales/en.ts`
2. Verify spelling matches exactly
3. Run `npm run check:translations` to list all valid keys

### Interpolation Not Working

**Problem:** `{{variable}}` appears in UI instead of actual value

**Solution:**
```tsx
// Wrong: Variable name mismatch
const text = i18n.t('items.count', { count: 5 }) 
// Translation uses {{items}}

// Correct: Variable names must match
i18n.t('items.count', { items: 5 })
```

### Extra/Missing Keys Reported

**Problem:** CI reports "Extra 2 key(s)" or "Missing 3 key(s)"

**Solution:**
1. Run: `npx ts-node scripts/check-translations.ts`
2. Synchronize keys across all language files
3. Run again to verify

### Visual Overflow Not Detected

**Problem:** Pseudo-locale shows expanded text, but E2E test doesn't catch overflow

**Solution:**
1. Verify CSS doesn't use hardcoded widths
2. Use `overflow-hidden` class to cap width (more realistic)
3. Add Playwright test to check `scrollWidth > clientWidth`

## Files Reference

| File | Purpose |
|------|---------|
| `src/i18n/keyExtractor.ts` | Extract and validate translation keys |
| `src/i18n/translations.test.ts` | Comprehensive translation validation tests |
| `src/i18n/pseudoLocale.ts` | Pseudo-localization utilities |
| `src/i18n/locales/en.ts` | English translations (source of truth) |
| `src/i18n/locales/es.ts` | Spanish translations |
| `src/i18n/locales/fr.ts` | French translations |
| `src/i18n/locales/ja.ts` | Japanese translations |
| `scripts/check-translations.ts` | CI validation script |

## Future Improvements

- [ ] Add visual regression tests (Playwright) with all locales
- [ ] Support for Arabic and Hebrew (RTL languages)
- [ ] Automated screenshot comparison for locale variants
- [ ] Translation coverage metrics per page/component
- [ ] Missing key detector (scan code for unused `t()` calls)
- [ ] Performance monitoring for i18n resolution
- [ ] Support for pluralization rules per locale
- [ ] Gender-aware translations for languages that need it
