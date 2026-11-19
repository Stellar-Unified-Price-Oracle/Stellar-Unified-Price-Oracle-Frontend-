/**
 * Client-side validation helpers for price values.
 *
 * These helpers are intentionally defensive: price inputs can arrive from
 * user typing, pasted text, or persisted state, and may be malformed or
 * extreme. All helpers return a discriminated result so callers can render
 * explicit error states instead of relying on truthiness.
 */

export type PriceValidationError =
  | 'empty'
  | 'not-a-number'
  | 'not-finite'
  | 'negative'
  | 'zero'
  | 'too-large'
  | 'too-many-decimals';

export type PriceValidationResult =
  | { ok: true; value: number }
  | { ok: false; error: PriceValidationError };

export interface PriceValidationOptions {
  /** Allow a value of exactly zero. Defaults to false. */
  allowZero?: boolean;
  /** Allow negative values. Defaults to false. */
  allowNegative?: boolean;
  /** Maximum absolute value accepted. Defaults to Number.MAX_SAFE_INTEGER. */
  max?: number;
  /** Maximum number of fractional digits accepted. Defaults to 7 (Stellar). */
  maxDecimals?: number;
}

const DEFAULT_MAX_DECIMALS = 7;

/**
 * Normalize a raw price string: trim whitespace and strip common grouping
 * separators (commas, underscores, thin spaces) while preserving a single
 * decimal point. Returns the normalized string (may be empty).
 */
export function normalizePriceInput(raw: unknown): string {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? String(raw) : '';
  }
  if (typeof raw !== 'string') {
    return '';
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    return '';
  }
  // Strip grouping separators; keep digits, sign, decimal point, exponent.
  return trimmed.replace(/[,_\s\u00a0\u202f]/g, '');
}

/**
 * Validate a raw price input against malformed and extreme values.
 *
 * Handles: empty/whitespace, non-numeric text, NaN, Infinity, negative,
 * zero (configurable), overflow beyond a safe maximum, and excessive
 * fractional precision.
 */
export function validatePriceInput(
  raw: unknown,
  options: PriceValidationOptions = {},
): PriceValidationResult {
  const {
    allowZero = false,
    allowNegative = false,
    max = Number.MAX_SAFE_INTEGER,
    maxDecimals = DEFAULT_MAX_DECIMALS,
  } = options;

  const normalized = normalizePriceInput(raw);
  if (normalized === '') {
    return { ok: false, error: 'empty' };
  }

  // Reject anything that is not a plain decimal number. This excludes
  // Infinity, NaN, hex, and other non-decimal literals.
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(normalized)) {
    return { ok: false, error: 'not-a-number' };
  }

  const value = Number(normalized);
  if (Number.isNaN(value)) {
    return { ok: false, error: 'not-a-number' };
  }
  if (!Number.isFinite(value)) {
    return { ok: false, error: 'not-finite' };
  }

  if (value < 0 && !allowNegative) {
    return { ok: false, error: 'negative' };
  }
  if (value === 0 && !allowZero) {
    return { ok: false, error: 'zero' };
  }

  if (Math.abs(value) > max) {
    return { ok: false, error: 'too-large' };
  }

  const fraction = normalized.split('.')[1];
  if (fraction && fraction.length > maxDecimals) {
    return { ok: false, error: 'too-many-decimals' };
  }

  return { ok: true, value };
}

/** Human-readable message for a validation error, suitable for UI display. */
export function priceValidationMessage(error: PriceValidationError): string {
  switch (error) {
    case 'empty':
      return 'Enter a price value.';
    case 'not-a-number':
      return 'Price must be a number.';
    case 'not-finite':
      return 'Price must be a finite number.';
    case 'negative':
      return 'Price cannot be negative.';
    case 'zero':
      return 'Price must be greater than zero.';
    case 'too-large':
      return 'Price is too large.';
    case 'too-many-decimals':
      return 'Price has too many decimal places.';
    default:
      return 'Invalid price.';
  }
}
