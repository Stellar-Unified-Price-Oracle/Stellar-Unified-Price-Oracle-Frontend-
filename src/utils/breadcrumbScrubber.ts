/**
 * Removes personal data from error-reporting breadcrumbs before they leave the
 * browser (#846). Breadcrumb payloads are free-form, so this works on two
 * levels: values under personal-data keys are dropped wholesale, and email
 * addresses or IPv4 addresses appearing inside any string are masked.
 */

export const SCRUBBED = '[redacted]'

/** Normalized key names (lower-case, letters only) whose values are personal data. */
const PERSONAL_KEYS = new Set([
  'email',
  'phone',
  'phonenumber',
  'ip',
  'ipaddress',
  'username',
  'fullname',
  'firstname',
  'lastname',
  'displayname',
  'address',
  'dateofbirth',
])

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const IPV4_PATTERN = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g

/** Guards against cyclic or pathologically deep payloads. */
const MAX_DEPTH = 8

function isPersonalKey(key: string): boolean {
  return PERSONAL_KEYS.has(key.toLowerCase().replace(/[^a-z]/g, ''))
}

/** Masks email addresses and IPv4 addresses inside a free-text string. */
export function scrubString(text: string): string {
  return text.replace(EMAIL_PATTERN, '[email]').replace(IPV4_PATTERN, '[ip]')
}

/**
 * Returns a copy of a breadcrumb payload with personal data removed. The input
 * is never mutated.
 */
export function scrubBreadcrumbData(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return scrubString(value)
  if (depth >= MAX_DEPTH) return SCRUBBED
  if (Array.isArray(value)) return value.map((item) => scrubBreadcrumbData(item, depth + 1))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isPersonalKey(key) ? SCRUBBED : scrubBreadcrumbData(inner, depth + 1)
    }
    return out
  }
  return value
}

/**
 * Scrubs the message and data of a Sentry breadcrumb. Generic over the breadcrumb
 * shape so this module does not need to import Sentry's types.
 */
export function scrubBreadcrumb<T extends { message?: string; data?: Record<string, unknown> }>(breadcrumb: T): T {
  return {
    ...breadcrumb,
    ...(breadcrumb.message !== undefined && { message: scrubString(breadcrumb.message) }),
    ...(breadcrumb.data !== undefined && { data: scrubBreadcrumbData(breadcrumb.data) as Record<string, unknown> }),
  }
}
