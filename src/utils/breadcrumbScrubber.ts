/**
 * Strips personal data from error breadcrumbs before they are reported (#846).
 *
 * Breadcrumbs carry free text (messages, URLs) and arbitrary payloads, so an email,
 * a wallet address or a secret in a query string can reach the error tracker
 * unnoticed. These are pure functions: the input is never mutated.
 */

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
/** Stellar account (StrKey G...): 56 base32 characters. */
const STELLAR_ACCOUNT = /\bG[A-Z2-7]{55}\b/g
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
/** Credential-bearing query parameters, e.g. `?access_token=...` in a fetch URL. */
const SENSITIVE_QUERY = /([?&](?:access_token|token|code|api[_-]?key|secret|password)=)[^&#\s]*/gi

/** Object keys whose values are always personal, regardless of content. Lower-cased. */
const PERSONAL_KEYS = new Set(['email', 'username', 'ip', 'ipaddress', 'phone', 'fullname', 'firstname', 'lastname'])

const REDACTED = '[redacted]'
/** Payloads nest shallowly; anything deeper is dropped rather than passed through unscanned. */
const MAX_DEPTH = 6

/** Replaces personal data inside a free-text string. */
export function scrubPersonalText(text: string): string {
  return text
    .replace(SENSITIVE_QUERY, `$1${REDACTED}`)
    .replace(EMAIL, '[email]')
    .replace(STELLAR_ACCOUNT, '[account]')
    .replace(IPV4, '[ip]')
}

/** Recursively scrubs a payload: strings are scanned, personal keys are redacted wholesale. */
export function scrubPersonalData<T>(value: T, depth = 0): T {
  if (typeof value === 'string') return scrubPersonalText(value) as T
  if (value === null || typeof value !== 'object') return value
  if (depth >= MAX_DEPTH) return REDACTED as T
  if (Array.isArray(value)) return value.map((item) => scrubPersonalData(item, depth + 1)) as T

  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    out[key] = PERSONAL_KEYS.has(key.toLowerCase()) ? REDACTED : scrubPersonalData(item, depth + 1)
  }
  return out as T
}

/** Scrubs a Sentry-style breadcrumb's message and data. Used as Sentry's `beforeBreadcrumb`. */
export function scrubBreadcrumb<T extends { category?: string; message?: string; data?: Record<string, unknown> }>(
  breadcrumb: T,
): T {
  return {
    ...breadcrumb,
    ...(breadcrumb.message !== undefined ? { message: scrubPersonalText(breadcrumb.message) } : {}),
    ...(breadcrumb.data ? { data: scrubPersonalData(breadcrumb.data) } : {}),
  }
}
