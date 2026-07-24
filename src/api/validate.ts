import type { ZodTypeAny, z } from 'zod'

// Validation is always on in dev/test; sampled at 5% in production
const SAMPLE_RATE = 0.05
const isDev = import.meta.env.DEV || import.meta.env.MODE === 'test'

/**
 * Validates untrusted API response data against a Zod schema.
 *
 * - In dev/test mode: always validates.
 * - In production: validates on a random 5% sample.
 *
 * On success the **parsed** Zod output is returned, which may include
 * defaults, coercions, and transformations applied by the schema.
 * On failure a warning is logged and the raw data is returned for
 * graceful degradation, but callers should expect potentially malformed
 * data in that case.
 */
export function validate<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  if (!isDev && Math.random() > SAMPLE_RATE) return data as z.infer<S>

  const result = schema.safeParse(data)
  if (result.success) {
    return result.data
  }

  const message = result.error.issues
    .map((i: { path: (string | number)[]; message: string }) => `${i.path.join('.')}: ${i.message}`)
    .join('; ')
  console.warn(`[API validation] Schema mismatch — ${message}`)
  // Return data anyway to avoid breaking the UI on unexpected server responses
  return data as z.infer<S>
}
