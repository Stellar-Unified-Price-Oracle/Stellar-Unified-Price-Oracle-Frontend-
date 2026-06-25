import { config } from '../config'

/** Options for `fetchWithRetry` on top of standard `RequestInit`. */
export interface RetryOptions {
  /** Override default maximum attempts. Defaults to `config.retry.maxAttempts`. */
  maxAttempts?: number
  /** Override default base delay in ms. Defaults to `config.retry.baseDelayMs`. */
  baseDelayMs?: number
  /** Override default exponential multiplier. Default: `config.retry.backoffMultiplier`. */
  backoffMultiplier?: number
  /** Override max cap on a single backoff delay. Default: `config.retry.maxDelayMs`. */
  maxDelayMs?: number
  /** Override jitter on/off. Default: `config.retry.jitter`. */
  jitter?: boolean
}

/**
 * Reasons a request is being retried. Useful for tests and observability.
 */
export type RetryReason = 'network-error' | 'http-5xx' | 'http-429'

export class HttpRetryError extends Error {
  readonly cause: unknown
  readonly attempts: number
  readonly reason: RetryReason | 'non-retryable'
  constructor(message: string, opts: { cause?: unknown; attempts: number; reason: RetryReason | 'non-retryable' }) {
    super(message)
    this.name = 'HttpRetryError'
    this.cause = opts.cause
    this.attempts = opts.attempts
    this.reason = opts.reason
  }
}

/**
 * Returns true if the response represents a transient failure that should be retried.
 * - 5xx server errors → retry
 * - 429 Too Many Requests → retry (server instructed back-off)
 * - All other 4xx → do NOT retry
 */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

/**
 * Parse the Retry-After header (RFC 7231) into a delay in milliseconds.
 * Accepts either a number of seconds or an HTTP-date. Returns null when absent or invalid.
 */
function parseRetryAfter(header: string | null, now: number = Date.now()): number | null {
  if (!header) return null
  const trimmed = header.trim()
  if (!trimmed) return null

  // Numeric form (delay-seconds)
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Math.max(0, Math.ceil(parseFloat(trimmed) * 1000))
  }

  // HTTP-date form. `Date.parse` returns NaN if invalid.
  const parsed = Date.parse(trimmed)
  if (!Number.isNaN(parsed)) {
    return Math.max(0, parsed - now)
  }
  return null
}

/**
 * Compute the delay to wait before the next attempt.
 * Uses full jitter (AWS recommendation) when jitter is enabled:
 *   delay = random * (base * multiplier^attempt)
 * Otherwise uses deterministic exponential backoff capped at `maxDelayMs`.
 * If the server provided a Retry-After header, its value takes precedence over the
 * computed exponential delay (still subject to `maxDelayMs`).
 */
export function computeBackoffDelay(
  attempt: number,
  opts: {
    baseDelayMs: number
    backoffMultiplier: number
    maxDelayMs: number
    jitter: boolean
    retryAfter?: string | null
    random?: () => number
    now?: () => number
  },
): number {
  const { baseDelayMs, backoffMultiplier, maxDelayMs, jitter, retryAfter, random = Math.random, now = Date.now } = opts

  const ra = parseRetryAfter(retryAfter ?? null, now())
  if (ra !== null) return Math.min(ra, maxDelayMs)

  const exp = baseDelayMs * Math.pow(backoffMultiplier, attempt)
  const capped = Math.min(exp, maxDelayMs)
  return jitter ? Math.floor(random() * capped) : capped
}

/**
 * Sleep helper that resolves after `ms` milliseconds. Honors AbortSignal — when the
 * signal aborts, the returned promise rejects with an `AbortError` so callers can
 * distinguish user-cancel from network failures.
 */
function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Wraps `fetch` with retry logic for transient failures.
 *
 * Retry triggers:
 * - Network errors (fetch rejects)
 * - 5xx HTTP responses
 * - 429 Too Many Requests (respects Retry-After)
 *
 * Non-retryable responses (other 4xx, 2xx, 3xx) are returned immediately.
 *
 * Backoff: exponential with optional full jitter. The Retry-After header overrides
 * the computed delay when present. AbortSignal cancels retries cleanly.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: RetryOptions = {},
): Promise<Response> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? config.retry.maxAttempts)
  const baseDelayMs = options.baseDelayMs ?? config.retry.baseDelayMs
  const backoffMultiplier = options.backoffMultiplier ?? config.retry.backoffMultiplier
  const maxDelayMs = options.maxDelayMs ?? config.retry.maxDelayMs
  const jitter = options.jitter ?? config.retry.jitter

  let attempt = 0
  while (true) {
    if (init?.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    try {
      const response = await fetch(input, init)
      if (response.ok || !isRetryableStatus(response.status)) {
        return response
      }

      // Retryable status (5xx or 429). Provisional throw; the retry loop below
      // re-reads the response to access its headers.
      if (attempt + 1 >= maxAttempts) {
        throw new HttpRetryError(`HTTP ${response.status} ${response.statusText}`, {
          cause: response,
          attempts: attempt + 1,
          reason: response.status === 429 ? 'http-429' : 'http-5xx',
        })
      }

      const retryAfter = response.headers.get('Retry-After')
      const delay = computeBackoffDelay(attempt, {
        baseDelayMs,
        backoffMultiplier,
        maxDelayMs,
        jitter,
        retryAfter,
      })
      attempt += 1
      await sleep(delay, init?.signal)
    } catch (err) {
      // User-initiated cancellation — do not retry.
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      if (err instanceof HttpRetryError) throw err

      // Network-level failure: fetch itself rejected (CORS, DNS, offline, etc.)
      const reason: RetryReason = 'network-error'
      if (attempt + 1 >= maxAttempts) {
        throw new HttpRetryError(reasonMessage(reason, err), {
          cause: err,
          attempts: attempt + 1,
          reason,
        })
      }

      const delay = computeBackoffDelay(attempt, {
        baseDelayMs,
        backoffMultiplier,
        maxDelayMs,
        jitter,
      })
      attempt += 1
      await sleep(delay, init?.signal)
    }
  }
}

function reasonMessage(reason: RetryReason, err: unknown): string {
  if (err instanceof Error && err.message) return `${reason}: ${err.message}`
  return reason
}
