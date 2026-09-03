# Locale-Aware Formatting Guide

This document explains how to use locale-aware formatting for numbers, currencies, and dates in the Stellar Unified Price Oracle frontend.

## Overview

Numbers, dates, and times are formatted according to the user's locale preference, respecting both:
1. **i18n language** (e.g., English → en-US, German → de-DE)
2. **Format locale override** in accessibility/data preferences

This ensures:
- European users see `1.234,56` instead of `1,234.56`
- Dates appear in local conventions (DD/MM/YYYY vs MM/DD/YYYY)
- Timezone names are properly localized
- Users can override the locale independently of language

## Supported Locales

The following locales are fully supported with examples:

| Locale | Language | Numbers | Dates |
|--------|----------|---------|-------|
| `auto` | Auto (from language) | Derived | Derived |
| `en-US` | English (United States) | 1,234.56 | 1/15/24, 2:30 PM |
| `de-DE` | Deutsch (Deutschland) | 1.234,56 | 15.1.24, 14:30 |
| `fr-FR` | Français (France) | 1 234,56 | 15/01/24 14:30 |
| `ja-JP` | 日本語 (Japan) | 1,234.56 | 2024/1/15 14:30 |
| `es-ES` | Español (España) | 1.234,56 | 15/1/24 14:30 |
| `ar-SA` | العربية (Saudi Arabia) | ١٬٢٣٤٫٥٦ | 15/1/1445 AH, 14:30 |
| `pt-BR` | Português (Brasil) | 1.234,56 | 15/01/24 14:30 |

## Core Concepts

### Locale vs Language

- **Language** (from i18n): What language UI text is displayed in. Set via Settings → Language.
- **Locale** (from preferences): How numbers, dates, and currencies are formatted. Set via Settings → Data → Number & Date Format.

They're independent: you can use English (en) language with German (de-DE) number formatting.

### Automatic Locale Derivation

When the format locale is set to **"Auto (from language)"**, the locale is automatically derived:

| Language | Auto Locale |
|----------|-------------|
| English | en-US |
| German | de-DE |
| Spanish | es-ES |
| French | fr-FR |
| Japanese | ja-JP |

This ensures numbers and dates follow the language's typical regional convention.

## Usage

### With the useLocale Hook

For components that need locale-aware formatting:

```tsx
import { useLocale } from '../hooks/useLocale'
import { formatPrice } from '../utils/format'

export function PriceCard({ price }: { price: number }) {
  const locale = useLocale()
  const formatted = formatPrice(price, locale)
  
  return <div>${formatted}</div>
}
```

The `useLocale()` hook handles:
- Getting the current language from i18n
- Getting the format locale preference
- Resolving "auto" to the derived locale
- Re-computing when either preference changes

### Format Functions

All formatting functions accept an optional locale parameter:

#### Numbers and Prices

```tsx
import { formatPrice, formatPriceShort, formatChartPrice } from '../utils/format'

const locale = useLocale()

// Full precision
formatPrice(1234.56, locale)        // "1,234.56" (en-US) or "1.234,56" (de-DE)

// Short (no max decimals)
formatPriceShort(0.123456, locale)  // "0.123456" (en-US) or "0,123456" (de-DE)

// Chart labels
formatChartPrice(1234.5, locale)    // "1,234.5" (en-US) or "1.234,5" (de-DE)
```

#### Dates and Times

```tsx
import { formatTimestamp, formatChartTime, formatChartTimeWithTz } from '../utils/format'

const locale = useLocale()
const ts = Date.now()

// Full datetime
formatTimestamp(ts, locale)             // "Jan 15, 02:30:45 PM" (en-US) or "15. Jan., 14:30:45" (de-DE)

// Time only (for charts)
formatChartTime(ts, locale)             // "02:30 PM" (en-US) or "14:30" (de-DE)

// Time with timezone
formatChartTimeWithTz(ts, 'UTC', locale) // Same as above, respects timezone
```

#### Timezones

```tsx
import { getTimezoneAbbr } from '../utils/format'

const locale = useLocale()

// Get timezone abbreviation
getTimezoneAbbr('America/New_York', Date.now(), locale) // "EST" or "EDT" (en-US) or "EST" (de-DE)
```

### Examples

#### Example 1: Display a price with locale awareness

```tsx
import { useLocale } from '../hooks/useLocale'
import { formatPrice } from '../utils/format'

export function PriceDisplay({ price }: { price: number }) {
  const locale = useLocale()
  return <span className="price">{formatPrice(price, locale)}</span>
}
```

#### Example 2: Format a date in the user's locale

```tsx
import { useLocale } from '../hooks/useLocale'
import { formatTimestamp } from '../utils/format'

export function LastUpdated({ timestamp }: { timestamp: number }) {
  const locale = useLocale()
  const formatted = formatTimestamp(timestamp, locale)
  return <small>Last updated: {formatted}</small>
}
```

#### Example 3: Chart with locale-aware labels

```tsx
import { useLocale } from '../hooks/useLocale'
import { formatChartPrice, formatChartTime } from '../utils/format'
import { AreaChart, Area, XAxis, YAxis } from 'recharts'

export function PriceChart({ data }: { data: ChartPoint[] }) {
  const locale = useLocale()
  
  // Create formatters that capture locale
  const priceFormatter = (val: number) => formatChartPrice(val, locale)
  const timeFormatter = (val: number) => formatChartTime(val, locale)
  
  return (
    <AreaChart data={data}>
      <XAxis dataKey="time" tickFormatter={timeFormatter} />
      <YAxis tickFormatter={priceFormatter} />
      <Area dataKey="price" />
    </AreaChart>
  )
}
```

## Architecture

### Locale Resolution

The locale is resolved using the `getEffectiveLocale()` function:

```tsx
import { getEffectiveLocale } from '../i18n/localeMapping'

// User's format preference is 'auto', current language is 'de'
const locale = getEffectiveLocale('auto', 'de')  // Returns 'de-DE'

// User explicitly chose 'de-DE', current language is 'en'
const locale = getEffectiveLocale('de-DE', 'en') // Returns 'de-DE'
```

### Preferences Storage

The user's format locale is stored in the preferences system:

```tsx
import { usePreferences } from '../preferences/PreferencesContext'

export function Component() {
  const { preferences, updatePreference } = usePreferences()
  
  // Current format locale (e.g., 'auto', 'en-US', 'de-DE')
  console.log(preferences.formatLocale)
  
  // Change it
  updatePreference('formatLocale', 'de-DE')
}
```

### Locale Mapping

Language codes map to IANA locale codes in `src/i18n/localeMapping.ts`:

```tsx
import { getLocaleFromLanguage } from '../i18n/localeMapping'

getLocaleFromLanguage('de')  // 'de-DE'
getLocaleFromLanguage('fr')  // 'fr-FR'
getLocaleFromLanguage('ja')  // 'ja-JP'
```

## Settings UI

Users configure formatting locale in **Settings → Data → Number & Date Format**:

1. **Auto (from language)** — Derives from current language setting (recommended for most users)
2. **English (US)** — Always 1,234.56 format
3. **Deutsch (Deutschland)** — Always 1.234,56 format
4. **Français (France)** — Always 1 234,56 format
5. **日本語 (日本)** — Japanese numerals and date format
6. **Español (España)** — Spanish formatting
7. **العربية (السعودية)** — Arabic numerals and Hijri calendar
8. **Português (Brasil)** — Brazilian Portuguese formatting

When the user changes this setting, all components using `useLocale()` automatically re-format their output.

## Backward Compatibility

All formatting functions default to `'en-US'` when no locale is provided:

```tsx
// Without locale (backward compatible)
formatPrice(1234.56)           // Always "1,234.56"
formatTimestamp(Date.now())    // Always uses en-US format

// With locale (recommended)
formatPrice(1234.56, locale)   // Uses user's locale
formatTimestamp(Date.now(), locale)
```

This ensures existing code continues to work without changes.

## Testing

### Unit Tests

Run the formatting tests:

```bash
npm run test:run -- src/utils/format.test.ts
```

Tests cover:
- All 8 locales
- Number formatting (decimals, thousands separators)
- Date/time formatting
- Timezone abbreviations
- Locale comparison and edge cases

### Manual Testing

1. **Change format locale:**
   - Open Settings → Data → Number & Date Format
   - Select different locales
   - Observe numbers/dates on dashboard update instantly

2. **Change language:**
   - Open Settings → Language
   - Select a different language
   - If format locale is "Auto", formatting should change accordingly

3. **Test specific locales:**
   - en-US: Should use comma thousands separator (1,234.56)
   - de-DE: Should use period thousands, comma decimal (1.234,56)
   - fr-FR: Should use space thousands, comma decimal (1 234,56)
   - ar-SA: Should use Arabic-Indic numerals (١٬٢٣٤٫٥٦)

## Common Patterns

### Creating a Locale-Aware Component

```tsx
import { useLocale } from '../hooks/useLocale'
import { formatPrice, formatTimestamp } from '../utils/format'

interface PriceAlertProps {
  price: number
  triggeredAt: number
}

export function PriceAlert({ price, triggeredAt }: PriceAlertProps) {
  const locale = useLocale()
  
  return (
    <div className="alert">
      <p>Alert triggered at {formatPrice(price, locale)}</p>
      <p>Time: {formatTimestamp(triggeredAt, locale)}</p>
    </div>
  )
}
```

### Locale-Aware List Formatter

```tsx
import { useLocale } from '../hooks/useLocale'

export function PriceList({ prices }: { prices: number[] }) {
  const locale = useLocale()
  
  // Create a list formatter for the locale
  const listFormatter = new Intl.ListFormat(locale, {
    style: 'long',
    type: 'conjunction',
  })
  
  const formatted = prices.map(p => formatPrice(p, locale))
  return <p>{listFormatter.format(formatted)}</p>
}
```

## Troubleshooting

### Issue: Formatting doesn't change when user selects a new locale

**Check:** Are you passing the locale parameter?

```tsx
// ❌ Wrong: Ignores locale preference
const formatted = formatPrice(price)

// ✅ Correct: Respects locale preference
const locale = useLocale()
const formatted = formatPrice(price, locale)
```

### Issue: "Auto" locale not working

**Check:** The language code must match a supported language in `src/i18n/index.ts`.

```tsx
// Supported languages: 'en', 'es', 'fr', 'ja'
// If i18n.language is 'de', auto derivation won't work
// User should select explicit 'de-DE' locale instead
```

### Issue: Chart labels not updating when locale changes

**Check:** Are you capturing the locale in the formatter function?

```tsx
// ❌ Wrong: locale is undefined when this runs
const priceFormatter = (val: number) => formatChartPrice(val, undefined)

// ✅ Correct: locale is captured
const locale = useLocale()
const priceFormatter = (val: number) => formatChartPrice(val, locale)
```

## Files Reference

| File | Purpose |
|------|---------|
| `src/utils/format.ts` | Formatting functions with locale parameter |
| `src/hooks/useLocale.ts` | Hook to get effective locale |
| `src/i18n/localeMapping.ts` | Language-to-locale mapping utilities |
| `src/preferences/types.ts` | `LocaleCode` type definition |
| `src/preferences/constants.ts` | `FORMAT_LOCALE_OPTIONS` list |
| `src/utils/format.test.ts` | Comprehensive formatting tests |

## Resources

- [MDN: Intl.NumberFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat)
- [MDN: Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)
- [IANA Language Subtag Registry](https://www.iana.org/assignments/language-subtag-registry)
- [Unicode CLDR](http://cldr.unicode.org/)

## Future Improvements

- [ ] Add currency formatting with locale-aware symbols (€, ¥, £, etc.)
- [ ] Support currency-specific decimal places (JPY: 0 decimals, USD: 2 decimals)
- [ ] Add relative time formatting (e.g., "2 hours ago" in any locale)
- [ ] Support for additional locales (de-AT, en-GB, zh-CN, etc.)
- [ ] Allow per-component locale overrides
- [ ] Performance optimization for formatting in tables/grids
