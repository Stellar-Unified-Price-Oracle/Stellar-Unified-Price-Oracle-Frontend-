import { useId, useMemo, useState } from 'react';

/**
 * Client-side validation for price values entered by the user.
 *
 * Guards against malformed and extreme inputs before they reach the API:
 * empty/whitespace, non-numeric, NaN, Infinity, negative, zero, locale
 * separators, and values that overflow safe numeric ranges.
 */

const MAX_PRICE = 1_000_000_000;
const MAX_DECIMALS = 7;

// Accepts an optional sign, digits with optional single decimal separator,
// and rejects anything else (letters, exponents, multiple separators, etc.).
const NUMERIC_PATTERN = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

export type PriceValidation =
  | { valid: true; value: number }
  | { valid: false; error: string };

export function validatePrice(raw: string): PriceValidation {
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Enter a price.' };
  }

  // Normalize a single comma used as a decimal separator (e.g. "1,5").
  // Thousands separators (multiple commas) are rejected as malformed.
  const normalized = trimmed.includes(',') && !trimmed.includes('.')
    ? trimmed.replace(',', '.')
    : trimmed;

  if (!NUMERIC_PATTERN.test(normalized)) {
    return { valid: false, error: 'Price must be a number.' };
  }

  const value = Number(normalized);

  if (!Number.isFinite(value)) {
    return { valid: false, error: 'Price is out of range.' };
  }

  if (value <= 0) {
    return { valid: false, error: 'Price must be greater than zero.' };
  }

  if (value > MAX_PRICE) {
    return { valid: false, error: `Price must not exceed ${MAX_PRICE.toLocaleString()}.` };
  }

  const decimals = normalized.split('.')[1];
  if (decimals && decimals.length > MAX_DECIMALS) {
    return { valid: false, error: `Price supports at most ${MAX_DECIMALS} decimal places.` };
  }

  return { valid: true, value };
}

export interface PriceInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: number) => void;
  disabled?: boolean;
  label?: string;
}

export function PriceInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  label = 'Price',
}: PriceInputProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [touched, setTouched] = useState(false);

  const validation = useMemo(() => validatePrice(value), [value]);
  const showError = touched && !validation.valid;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (validation.valid && onSubmit) {
      onSubmit(validation.value);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="text"
        inputMode="decimal"
        value={value}
        disabled={disabled}
        aria-invalid={showError}
        aria-describedby={showError ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => setTouched(true)}
      />
      {showError && (
        <p id={errorId} role="alert">
          {validation.error}
        </p>
      )}
      <button type="submit" disabled={disabled || !validation.valid}>
        Submit
      </button>
    </form>
  );
}
