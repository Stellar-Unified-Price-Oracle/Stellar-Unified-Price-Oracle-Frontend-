/**
 * @file Input Validation & Sanitization Module
 *
 * Centralizes all user input validation and sanitization across the application.
 * Provides type-safe validators for:
 * - Search queries
 * - Asset pair names
 * - Alert thresholds
 * - URL parameters
 * - Numeric inputs
 *
 * All validation is strict by default with clear error messages.
 *
 * @example
 * ```tsx
 * // Validate search input
 * const result = validators.search.safeParse(userInput)
 * if (!result.success) {
 *   console.error('Invalid search:', result.error.message)
 * } else {
 *   const cleanInput = result.data
 * }
 *
 * // Validate alert threshold
 * const threshold = validators.alertThreshold.parse(userValue)
 * ```
 */

import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// SANITIZATION UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Control characters to remove from user input (0x00–0x1F, 0x7F)
 * Prevents injection of special characters and control sequences
 */
const CONTROL_CHARS_REGEX = new RegExp(
  '[' +
    String.fromCharCode(0) +
    '-' +
    String.fromCharCode(8) +
    String.fromCharCode(11) +
    String.fromCharCode(12) +
    String.fromCharCode(14) +
    '-' +
    String.fromCharCode(31) +
    String.fromCharCode(127) +
    ']',
  'g',
)

/**
 * Removes control characters that could be used for injection attacks
 * Does not remove regular whitespace (space, newline, tab which are safe)
 */
function removeControlChars(input: string): string {
  return input.replace(CONTROL_CHARS_REGEX, '')
}

/**
 * Removes HTML tags from user input to prevent XSS
 * Preserves text content between tags
 */
function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}

/**
 * Normalizes whitespace: trims and collapses multiple spaces
 */
function normalizeWhitespace(input: string): string {
  return input.trim().replace(/\s+/g, ' ')
}

/**
 * Converts input to uppercase for case-insensitive comparison
 * Useful for pair names (BTC/USD, etc.)
 */
function toUpperCase(input: string): string {
  return input.toUpperCase()
}

// ─────────────────────────────────────────────────────────────────────────────
// ZOD VALIDATORS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validator for search queries
 *
 * Rules:
 * - Required, non-empty
 * - Max 100 characters
 * - No HTML tags
 * - No control characters
 * - Whitespace normalized
 *
 * @example
 * ```
 * validators.search.safeParse("BTC")  // ✅ {success: true, data: "BTC"}
 * validators.search.safeParse("")     // ❌ {success: false, error: ...}
 * validators.search.safeParse("<script>")  // ✅ {success: true, data: "script>"}
 * ```
 */
export const searchQueryValidator = z
  .string()
  .trim()
  .min(1, 'Search query cannot be empty')
  .max(100, 'Search query must be 100 characters or less')
  .transform(stripHtmlTags)
  .transform(removeControlChars)
  .transform(normalizeWhitespace)
  .refine((val) => val.length > 0, 'Search query cannot contain only invalid characters')

/**
 * Validator for asset pair names (e.g., "BTC/USD")
 *
 * Rules:
 * - Required
 * - Format: BASE/QUOTE (uppercase letters and /)
 * - 3-6 characters per component
 * - No spaces, special chars, or numbers
 *
 * @example
 * ```
 * validators.assetPair.safeParse("BTC/USD")   // ✅
 * validators.assetPair.safeParse("btc/usd")   // ✅ (normalized to BTC/USD)
 * validators.assetPair.safeParse("BTC")       // ❌ (missing quote)
 * validators.assetPair.safeParse("BTC/US D")  // ❌ (space)
 * ```
 */
export const assetPairValidator = z
  .string()
  .trim()
  .transform(toUpperCase)
  .refine((val) => /^[A-Z]{3,6}\/[A-Z]{3,6}$/.test(val), {
    message: 'Asset pair must be in format BASE/QUOTE (e.g., BTC/USD)',
  })

/**
 * Validator for numeric thresholds in alerts
 *
 * Rules:
 * - Required
 * - Must be a valid finite number
 * - Range: -1,000,000 to 1,000,000
 * - Max 2 decimal places
 *
 * @example
 * ```
 * validators.alertThreshold.safeParse(50000)      // ✅
 * validators.alertThreshold.safeParse("50000")    // ✅ (coerced)
 * validators.alertThreshold.safeParse("abc")      // ❌
 * validators.alertThreshold.safeParse(Infinity)   // ❌
 * ```
 */
export const alertThresholdValidator = z
  .union([z.number(), z.string()])
  .transform((val) => {
    if (typeof val === 'string') {
      return parseFloat(val)
    }
    return val
  })
  .refine((val) => Number.isFinite(val), {
    message: 'Threshold must be a valid finite number',
  })
  .refine((val) => val >= -1_000_000 && val <= 1_000_000, {
    message: 'Threshold must be between -1,000,000 and 1,000,000',
  })
  .refine((val) => Number.isInteger(val * 100), {
    message: 'Threshold must have at most 2 decimal places',
  })

/**
 * Validator for percentage values (0-100)
 *
 * Rules:
 * - Must be 0 or greater
 * - Must be 100 or less
 * - Max 2 decimal places
 *
 * @example
 * ```
 * validators.percentage.safeParse(50)      // ✅
 * validators.percentage.safeParse("25.5")  // ✅
 * validators.percentage.safeParse(150)     // ❌ (> 100)
 * ```
 */
export const percentageValidator = z
  .union([z.number(), z.string()])
  .transform((val) => {
    if (typeof val === 'string') {
      return parseFloat(val)
    }
    return val
  })
  .refine((val) => Number.isFinite(val), {
    message: 'Percentage must be a valid number',
  })
  .refine((val) => val >= 0 && val <= 100, {
    message: 'Percentage must be between 0 and 100',
  })
  .refine((val) => Number.isInteger(val * 100), {
    message: 'Percentage must have at most 2 decimal places',
  })

/**
 * Validator for URL parameters (e.g., limit, offset)
 *
 * Rules:
 * - Must be a positive integer
 * - Min: 1, Max: configurable (default 500)
 *
 * @example
 * ```
 * validators.urlParam.safeParse("50")      // ✅
 * validators.urlParam.safeParse("0")       // ❌ (must be > 0)
 * validators.urlParam.safeParse("abc")     // ❌
 * ```
 */
export const urlParamValidator = (min = 1, max = 500) =>
  z
    .union([z.number(), z.string()])
    .transform((val) => {
      if (typeof val === 'string') {
        return parseInt(val, 10)
      }
      return val
    })
    .refine((val) => Number.isInteger(val), {
      message: 'Parameter must be an integer',
    })
    .refine((val) => val >= min && val <= max, {
      message: `Parameter must be between ${min} and ${max}`,
    })

/**
 * Validator for email addresses
 *
 * Rules:
 * - Must be valid email format
 * - Max 254 characters (RFC 5321)
 * - Case-insensitive
 */
export const emailValidator = z
  .string()
  .trim()
  .toLowerCase()
  .email('Must be a valid email address')
  .max(254, 'Email must be 254 characters or less')

/**
 * Validator for URLs (for webhook endpoints, etc.)
 *
 * Rules:
 * - Must be valid HTTPS or HTTP URL
 * - Max 2048 characters
 * - Must not contain credentials
 */
export const urlValidator = z
  .string()
  .trim()
  .url('Must be a valid URL')
  .refine((url) => url.startsWith('http://') || url.startsWith('https://'), {
    message: 'URL must use HTTP or HTTPS protocol',
  })
  .refine((url) => !url.includes('@'), {
    message: 'URL must not contain credentials',
  })
  .max(2048, 'URL must be 2048 characters or less')

/**
 * Validator for alert limit parameters
 *
 * Rules:
 * - Must be 1–500
 */
export const historyLimitValidator = urlParamValidator(1, 500)

/**
 * Validator for pagination offset
 *
 * Rules:
 * - Must be non-negative integer
 * - Max: 100,000 (prevents scanning entire database)
 */
export const offsetValidator = urlParamValidator(0, 100_000)

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSITE VALIDATORS (for complex inputs)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validator for alert creation form
 *
 * Combines multiple field validators into one schema
 */
export const alertFormValidator = z.object({
  assetPair: assetPairValidator,
  upperThreshold: alertThresholdValidator.nullable(),
  lowerThreshold: alertThresholdValidator.nullable(),
  percentageThreshold: percentageValidator.nullable(),
})

/**
 * Validator for price history query parameters
 */
export const priceHistoryQueryValidator = z.object({
  pair: assetPairValidator,
  limit: historyLimitValidator.default(100),
  offset: offsetValidator.default(0),
})

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Centralized validators object for easy access
 *
 * All validators use Zod's `safeParse` for safe validation
 * and `parse` for strict validation with exceptions
 *
 * @example
 * ```tsx
 * // Safe validation (recommended)
 * const result = validators.search.safeParse(userInput)
 * if (result.success) {
 *   console.log('Clean input:', result.data)
 * } else {
 *   console.error('Validation failed:', result.error.flatten())
 * }
 *
 * // Strict validation (throws on error)
 * try {
 *   const clean = validators.search.parse(userInput)
 * } catch (error) {
 *   console.error('Invalid input:', error.message)
 * }
 * ```
 */
export const validators = {
  search: searchQueryValidator,
  assetPair: assetPairValidator,
  alertThreshold: alertThresholdValidator,
  percentage: percentageValidator,
  urlParam: urlParamValidator,
  email: emailValidator,
  url: urlValidator,
  historyLimit: historyLimitValidator,
  offset: offsetValidator,
  alertForm: alertFormValidator,
  priceHistoryQuery: priceHistoryQueryValidator,
} as const

/**
 * Type inference for validated inputs
 * @example
 * type ValidatedSearch = ValidatedInput<typeof validators.search>
 */
export type ValidatedInput<T extends z.ZodType> = z.infer<T>

/**
 * Utility to safely validate any input and return data or null
 *
 * Useful for try-catch-free validation in React components
 *
 * @example
 * ```tsx
 * const cleanPair = safeValidate(validators.assetPair, userInput)
 * if (cleanPair) {
 *   // Use cleaned pair name
 * }
 * ```
 */
export function safeValidate<T extends z.ZodType>(
  validator: T,
  input: unknown,
): z.infer<T> | null {
  const result = validator.safeParse(input)
  return result.success ? result.data : null
}

/**
 * Utility to batch validate multiple inputs
 *
 * @example
 * ```tsx
 * const results = batchValidate({
 *   pair: [validators.assetPair, userPair],
 *   limit: [validators.historyLimit, userLimit],
 * })
 *
 * if (results.success) {
 *   const { pair, limit } = results.data
 * }
 * ```
 */
export function batchValidate(
  inputs: Record<string, [z.ZodType, unknown]>,
): { success: boolean; data?: Record<string, unknown>; errors?: Record<string, string> } {
  const data: Record<string, unknown> = {}
  const errors: Record<string, string> = {}

  for (const [key, [validator, input]] of Object.entries(inputs)) {
    const result = validator.safeParse(input)
    if (result.success) {
      data[key] = result.data
    } else {
      errors[key] = result.error.issues[0]?.message || 'Validation failed'
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors }
  }

  return { success: true, data }
}
