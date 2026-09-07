/**
 * Number and date formatting utilities with locale support.
 *
 * All format functions support an optional `locale` parameter for Intl formatting.
 * If locale is undefined, the browser's default locale is used.
 *
 * @example Default (en-US hardcoded for backward compatibility)
 * ```tsx
 * const formatted = formatPrice(1234.56)
 * // Always returns "1,234.56"
 * ```
 *
 * @example With locale (recommended)
 * ```tsx
 * import { useLocale } from '../hooks/useLocale'
 *
 * export function PriceCard({ price }: { price: number }) {
 *   const locale = useLocale()
 *   return <div>{formatPrice(price, locale)}</div>
 * }
 * ```
 */

/**
 * Formats a price with variable decimal precision: 2 dp for ≥1000, 4 dp for ≥1, 6–8 dp otherwise.
 *
 * @param price - The price value to format
 * @param locale - Optional IANA locale code (e.g., 'en-US', 'de-DE'). Defaults to 'en-US' for backward compatibility.
 * @returns Formatted price string
 *
 * @example
 * ```
 * formatPrice(1234.56, 'en-US') // "1,234.56"
 * formatPrice(1234.56, 'de-DE') // "1.234,56"
 * formatPrice(1234.56, 'fr-FR') // "1 234,56"
 * ```
 */
export function formatPrice(price: number, locale: string | undefined = 'en-US'): string {
  if (price >= 1000) return price.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (price >= 1) return price.toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  return price.toLocaleString(locale, { minimumFractionDigits: 6, maximumFractionDigits: 6 })
}

/**
 * Same scale tiers as {@link formatPrice} but without a fixed maximum decimal count (for chart labels).
 *
 * @param price - The price value to format
 * @param locale - Optional IANA locale code. Defaults to 'en-US' for backward compatibility.
 * @returns Formatted price string without max decimal limit
 */
export function formatPriceShort(price: number, locale: string | undefined = 'en-US'): string {
  // `maximumFractionDigits` must be set explicitly — Intl clamps it to the
  // minimum when omitted, which would round small prices to the same digits
  // as formatPrice and defeat the point of the "short/unrounded" variant.
  if (price >= 1000) return price.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 20 })
  if (price >= 1) return price.toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 20 })
  return price.toLocaleString(locale, { minimumFractionDigits: 6, maximumFractionDigits: 20 })
}

/** Returns a human-readable relative time string (e.g. "5s ago", "2m ago") from a Unix timestamp in ms. */
export function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  return `${Math.floor(min / 60)}h ago`
}

/**
 * Formats a Unix timestamp in ms as a localised short datetime string in
 * 24-hour time (price data is timezone/clock-cycle agnostic, and mixing 12h
 * cycles per locale makes chart and detail timestamps hard to compare).
 *
 * @param ts - Unix timestamp in milliseconds
 * @param locale - Optional IANA locale code. Defaults to 'en-US' for backward compatibility.
 * @returns Formatted datetime string (e.g., "Jan 15, 14:30:45")
 *
 * @example
 * ```
 * formatTimestamp(1705327200000, 'en-US') // "Jan 15, 14:30:45"
 * formatTimestamp(1705327200000, 'de-DE') // "15. Jan., 14:30:45"
 * formatTimestamp(1705327200000, 'ja-JP') // "1月15日 14:30:45"
 * ```
 */
export function formatTimestamp(ts: number, locale: string | undefined = 'en-US'): string {
  return new Date(ts).toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

/**
 * Formats a Unix timestamp in ms as "HH:MM" for chart x-axis labels.
 *
 * @param ts - Unix timestamp in milliseconds
 * @param locale - Optional IANA locale code. Defaults to 'en-US' for backward compatibility.
 * @returns Formatted time string (e.g., "14:30")
 */
export function formatChartTime(ts: number, locale: string | undefined = 'en-US'): string {
  const d = new Date(ts)
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

/**
 * Formats a Unix timestamp in ms for chart x-axis labels using the given IANA
 * timezone identifier (or 'UTC' / 'Local').
 * Returns "HH:MM" format with the timezone abbreviation appended when it is
 * different from the browser local timezone.
 *
 * @param ts - Unix timestamp in milliseconds
 * @param timezone - IANA timezone identifier ('UTC', 'Local', or e.g., 'America/New_York')
 * @param locale - Optional IANA locale code for time formatting. Defaults to 'en-US'.
 * @returns Formatted time string (e.g., "14:30")
 *
 * @example
 * ```
 * formatChartTimeWithTz(1705327200000, 'UTC', 'en-US') // "14:30"
 * formatChartTimeWithTz(1705327200000, 'America/New_York', 'de-DE') // "14:30"
 * ```
 */
export function formatChartTimeWithTz(ts: number, timezone: string, locale: string | undefined = 'en-US'): string {
  const tz = timezone === 'Local' ? undefined : timezone
  const d = new Date(ts)
  return d.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  })
}

/**
 * Returns the short timezone abbreviation (e.g. "UTC", "EST", "JST") for a
 * given IANA timezone string and a reference timestamp. Falls back to the raw
 * timezone value if the Intl API is unavailable.
 *
 * @param timezone - IANA timezone identifier ('UTC', 'Local', or e.g., 'America/New_York')
 * @param ts - Reference Unix timestamp (defaults to now). Used for daylight saving time detection.
 * @param locale - Optional IANA locale code for timezone name formatting. Defaults to 'en-US'.
 * @returns Timezone abbreviation string
 *
 * @example
 * ```
 * getTimezoneAbbr('UTC', Date.now(), 'en-US') // "UTC"
 * getTimezoneAbbr('America/New_York', Date.now(), 'en-US') // "EST" or "EDT"
 * getTimezoneAbbr('Asia/Tokyo', Date.now(), 'ja-JP') // "JST"
 * ```
 */
export function getTimezoneAbbr(timezone: string, ts = Date.now(), locale: string | undefined = 'en-US'): string {
  if (timezone === 'Local') {
    return 'Local'
  }
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      timeZoneName: 'short',
    }).formatToParts(ts)
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? timezone
  } catch {
    return timezone
  }
}

/**
 * Formats a price value for chart y-axis tick labels using the same scale tiers as {@link formatPrice}.
 *
 * @param val - The price value to format
 * @param locale - Optional IANA locale code. Defaults to 'en-US' for backward compatibility.
 * @returns Formatted price string for chart labels
 *
 * @example
 * ```
 * formatChartPrice(1234.56, 'en-US') // "1,234.56"
 * formatChartPrice(1234.56, 'de-DE') // "1.234,56"
 * ```
 */
export function formatChartPrice(val: number, locale: string | undefined = 'en-US'): string {
  if (val >= 1000) return val.toLocaleString(locale, { maximumFractionDigits: 2 })
  if (val >= 1) return val.toLocaleString(locale, { maximumFractionDigits: 4 })
  return val.toLocaleString(locale, { maximumFractionDigits: 8 })
}
