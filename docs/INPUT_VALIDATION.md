# Input Validation & Sanitization System

**File:** `src/utils/inputValidation.ts`

## Overview

Centralized input validation and sanitization system using Zod to handle all user input across the application with consistent, type-safe validation.

## Key Principles

1. **Centralized** — All validators in one place
2. **Type-Safe** — Zod provides runtime validation + TypeScript types
3. **Fail-Safe** — Safe parsing never throws, strict parsing throws on invalid input
4. **Clear Errors** — Meaningful error messages for invalid input
5. **Sanitization** — Strip dangerous characters (HTML, control chars)
6. **Normalization** — Whitespace, case handling, trimming

## Validators

### Search Query

**Purpose:** Validate user search input

```typescript
validators.search.safeParse(input)
```

**Rules:**
- Non-empty
- Max 100 characters
- Strips HTML tags
- Removes control characters
- Normalizes whitespace

**Examples:**
```typescript
✅ validators.search.safeParse('BTC')         // {success: true, data: 'BTC'}
✅ validators.search.safeParse('ethereum')    // {success: true, data: 'ethereum'}
❌ validators.search.safeParse('')             // {success: false, ...}
✅ validators.search.safeParse('<b>BTC</b>')  // {success: true, data: 'BTC'}
```

### Asset Pair

**Purpose:** Validate asset pair names (e.g., "BTC/USD")

```typescript
validators.assetPair.safeParse(input)
```

**Rules:**
- Format: `BASE/QUOTE`
- 3-6 characters per component (letters only)
- Case-insensitive (normalized to uppercase)

**Examples:**
```typescript
✅ validators.assetPair.safeParse('BTC/USD')   // {success: true, data: 'BTC/USD'}
✅ validators.assetPair.safeParse('btc/usd')   // {success: true, data: 'BTC/USD'}
❌ validators.assetPair.safeParse('BTC')       // {success: false, ...}
❌ validators.assetPair.safeParse('BTC/US D')  // {success: false, ...}
```

### Alert Threshold

**Purpose:** Validate price thresholds for alerts

```typescript
validators.alertThreshold.safeParse(input)
```

**Rules:**
- Must be finite number (no Infinity, NaN)
- Range: -1,000,000 to 1,000,000
- Max 2 decimal places
- Coerces string numbers

**Examples:**
```typescript
✅ validators.alertThreshold.safeParse(50000)      // {success: true, data: 50000}
✅ validators.alertThreshold.safeParse('50000')    // {success: true, data: 50000}
✅ validators.alertThreshold.safeParse(99.99)      // {success: true, data: 99.99}
❌ validators.alertThreshold.safeParse(Infinity)   // {success: false, ...}
❌ validators.alertThreshold.safeParse(99.999)     // {success: false, ...}
```

### Percentage

**Purpose:** Validate percentage values (0–100)

```typescript
validators.percentage.safeParse(input)
```

**Rules:**
- Must be 0–100
- Max 2 decimal places
- Coerces string numbers

**Examples:**
```typescript
✅ validators.percentage.safeParse(50)      // {success: true, data: 50}
✅ validators.percentage.safeParse('25.5')  // {success: true, data: 25.5}
❌ validators.percentage.safeParse(150)     // {success: false, ...}
```

### Email

**Purpose:** Validate email addresses

```typescript
validators.email.safeParse(input)
```

**Rules:**
- Valid email format (RFC 5321)
- Max 254 characters
- Case-insensitive (normalized to lowercase)

### URL

**Purpose:** Validate webhook URLs and other endpoints

```typescript
validators.url.safeParse(input)
```

**Rules:**
- Valid URL format
- HTTP or HTTPS only
- No credentials (prevents user:pass@host)
- Max 2048 characters

### History Limit

**Purpose:** Validate pagination limit parameter

```typescript
validators.historyLimit.safeParse(input)
```

**Rules:**
- Integer 1–500
- Default: 100

### Offset

**Purpose:** Validate pagination offset parameter

```typescript
validators.offset.safeParse(input)
```

**Rules:**
- Non-negative integer
- Max: 100,000 (prevents database scanning)
- Default: 0

## Composite Validators

### Alert Form

**Purpose:** Validate complete alert creation form

```typescript
validators.alertForm.safeParse({
  assetPair: 'BTC/USD',
  upperThreshold: 50000,
  lowerThreshold: 40000,
  percentageThreshold: null,
})
```

Validates all fields together with cross-field consistency.

### Price History Query

**Purpose:** Validate price history API query parameters

```typescript
validators.priceHistoryQuery.safeParse({
  pair: 'BTC/USD',
  limit: 100,
  offset: 0,
})
```

Provides defaults for limit and offset.

## Usage Patterns

### Pattern 1: Safe Parsing (Recommended)

```typescript
const result = validators.search.safeParse(userInput)

if (result.success) {
  // Use result.data - fully validated and sanitized
  const cleanInput = result.data
} else {
  // Handle error - display to user
  const errorMessage = result.error.issues[0]?.message
  console.error('Invalid input:', errorMessage)
}
```

### Pattern 2: Strict Parsing

```typescript
try {
  const cleanInput = validators.search.parse(userInput)
  // Use cleanInput
} catch (error) {
  // Handle error
  console.error('Invalid input:', error.message)
}
```

### Pattern 3: Safe Validate Utility

```typescript
const cleanInput = safeValidate(validators.search, userInput)

if (cleanInput) {
  // Use cleanInput - never throws
} else {
  // Input is invalid, cleanInput is null
}
```

### Pattern 4: Batch Validation

```typescript
const result = batchValidate({
  pair: [validators.assetPair, userPair],
  limit: [validators.historyLimit, userLimit],
  offset: [validators.offset, userOffset],
})

if (result.success) {
  const { pair, limit, offset } = result.data
  // All validated and sanitized
} else {
  // result.errors contains errors per field
  console.error('Validation errors:', result.errors)
}
```

## Integration Guide

### In React Components

```tsx
import { validators } from '../utils/inputValidation'

export function SearchBar() {
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string>()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const result = validators.search.safeParse(value)

    if (result.success) {
      setSearch(result.data)
      setError(undefined)
    } else {
      setSearch(value)
      setError(result.error.issues[0]?.message)
    }
  }

  return (
    <div>
      <input value={search} onChange={handleChange} />
      {error && <span className="error">{error}</span>}
    </div>
  )
}
```

### In API Calls

```typescript
import { validators } from './utils/inputValidation'

export async function getPriceHistory(pair: string, limit: number, offset: number) {
  // Validate all inputs before making API call
  const result = batchValidate({
    pair: [validators.assetPair, pair],
    limit: [validators.historyLimit, limit],
    offset: [validators.offset, offset],
  })

  if (!result.success) {
    throw new Error(`Invalid parameters: ${JSON.stringify(result.errors)}`)
  }

  const { pair: validPair, limit: validLimit, offset: validOffset } = result.data

  const url = `/api/prices/${encodeURIComponent(validPair)}/history?limit=${validLimit}&offset=${validOffset}`
  return fetch(url).then(r => r.json())
}
```

### In Forms

```tsx
import { validators } from '../utils/inputValidation'

export function AlertForm() {
  const [form, setForm] = useState({
    assetPair: '',
    upperThreshold: null,
    lowerThreshold: null,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const result = validators.alertForm.safeParse(form)

    if (!result.success) {
      // Show validation errors
      const errors = result.error.flatten()
      console.error('Form errors:', errors)
      return
    }

    // All fields validated and sanitized
    const validatedForm = result.data
    submitAlert(validatedForm)
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
    </form>
  )
}
```

## Sanitization Details

### Removed Characters

1. **Control Characters** — 0x00–0x1F, 0x7F (prevent injection)
2. **HTML Tags** — `<script>`, `<style>`, etc. (prevent XSS)
3. **Excessive Whitespace** — Collapsed to single spaces

### Normalized Values

1. **Whitespace** — Trimmed and collapsed
2. **Case** — Uppercase for pairs, lowercase for emails
3. **Numbers** — Coerced from strings where appropriate

## Type Inference

```typescript
import { ValidatedInput, validators } from './utils/inputValidation'

// Infer type from validator
type ValidSearch = ValidatedInput<typeof validators.search>
// ValidSearch = string

type ValidAlertForm = ValidatedInput<typeof validators.alertForm>
// ValidAlertForm = {assetPair: string; upperThreshold: number | null; ...}
```

## Testing

All validators have comprehensive tests in `inputValidation.test.ts`:

```bash
npm run test:run -- src/utils/inputValidation.test.ts
```

Tests cover:
- Valid inputs
- Invalid inputs
- Edge cases
- Sanitization
- Normalization
- Error messages

## Performance Considerations

- Validators are created once and reused
- Zod validation is optimized for common cases
- Use `safeParse` for user input (non-throwing)
- Batch validation collects all errors at once

## Security

This system prevents:
- ✅ XSS through HTML tag injection
- ✅ Control character injection
- ✅ Invalid data type coercion
- ✅ Out-of-range values
- ✅ Format validation bypass

## Migration Guide

### Before (Inconsistent)

```typescript
// Search component
const sanitized = input.replace(/<[^>]*>/g, '')

// Alert component
if (threshold < -1000000 || threshold > 1000000) {
  throw new Error('Invalid')
}

// API layer
const pair = userInput.toUpperCase()
```

### After (Centralized)

```typescript
// Everywhere
const result = validators.search.safeParse(input)
const result = validators.alertThreshold.safeParse(threshold)
const result = validators.assetPair.safeParse(userInput)
```

## Best Practices

1. **Always validate before use** — Validate at component boundaries
2. **Use safeParse** — Never throws, clear error handling
3. **Batch when possible** — Collect multiple errors at once
4. **Store validated data** — Only use result.data from validation
5. **Document requirements** — Comment complex validation rules
6. **Test with edge cases** — Unicode, special chars, limits

## References

- [Zod Documentation](https://zod.dev)
- [OWASP Input Validation](https://owasp.org/www-community/attacks/xss/)
- [RFC 5321 Email Format](https://tools.ietf.org/html/rfc5321)
