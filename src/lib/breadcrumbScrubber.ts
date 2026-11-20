export type BreadcrumbPayload = {
  message?: string;
  data?: Record<string, unknown>;
  category?: string;
  level?: string;
  [key: string]: unknown;
};

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const REDACTED = '[REDACTED]';

/**
 * Removes email-shaped tokens from a free-text string.
 */
export function scrubPersonalText(text: string): string {
  if (typeof text !== 'string') {
    return text;
  }
  return text.replace(EMAIL_PATTERN, REDACTED);
}

function scrubValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return scrubPersonalText(value);
  }
  if (Array.isArray(value)) {
    return value.map(scrubValue);
  }
  if (value && typeof value === 'object') {
    return scrubPersonalData(value as Record<string, unknown>);
  }
  return value;
}

/**
 * Recursively scrubs personal data from a breadcrumb payload while preserving
 * its overall shape.
 */
export function scrubPersonalData<T extends Record<string, unknown>>(payload: T): T {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(payload)) {
    result[key] = scrubValue(payload[key]);
  }
  return result as T;
}

/**
 * Sentry `beforeBreadcrumb` hook that strips personal data from breadcrumbs.
 */
export function scrubBreadcrumb<T extends BreadcrumbPayload>(breadcrumb: T): T {
  return scrubPersonalData(breadcrumb as Record<string, unknown>) as T;
}
