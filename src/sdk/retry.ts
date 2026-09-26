import { OracleError } from './errors'

export interface RetryPolicy {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  jitterRatio: number
}
export const DEFAULT_RETRY_POLICY: RetryPolicy = { maxRetries: 3, baseDelayMs: 250, maxDelayMs: 30_000, jitterRatio: 0.2 }

export function isRetryable(error: unknown): boolean {
  return error instanceof OracleError && error.retryable
}

/** Delay before retry `attempt` (0-based): max(Retry-After, jittered exponential backoff), capped. */
export function computeDelay(policy: RetryPolicy, attempt: number, retryAfterMs: number | null, random: () => number): number {
  const exp = policy.baseDelayMs * 2 ** attempt
  const backoff = exp + exp * policy.jitterRatio * random()
  return Math.min(policy.maxDelayMs, Math.max(retryAfterMs ?? 0, backoff))
}

export function newIdempotencyKey(): string {
  const c = globalThis.crypto
  if (c?.randomUUID) return c.randomUUID()
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
