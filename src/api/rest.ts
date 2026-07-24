import { config } from '../config'
import { fetchWithRetry } from './retry'
import { showApiErrorToast } from '../context/ToastContext'
import type { PriceData, PriceHistoryResponse, RateLimitInfo } from '../types'
import {
  PriceDataSchema,
  PriceHistoryResponseSchema,
  BatchHistoryResponseSchema,
  HealthSchema,
} from './schemas'
import { validate } from './validate'

/** Categorical classification of an {@link ApiError}, derived from the HTTP status. */
export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR'

/**
 * Typed error thrown by {@link request} for non-ok, non-retryable HTTP responses
 * (retryable statuses — 5xx and 429 exhausted after retrying — surface as
 * {@link HttpRetryError} from `./retry` instead).
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode

  constructor(message: string, status: number, code: ApiErrorCode) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function statusToErrorCode(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return 'BAD_REQUEST'
    case 401:
      return 'UNAUTHORIZED'
    case 403:
      return 'FORBIDDEN'
    case 404:
      return 'NOT_FOUND'
    case 429:
      return 'RATE_LIMITED'
    default:
      return status >= 500 ? 'SERVER_ERROR' : 'UNKNOWN_ERROR'
  }
}

// ---------------------------------------------------------------------------
// Error toast notifications
// ---------------------------------------------------------------------------
// useSwr retries failed fetches (with backoff) before settling into an error
// state, and polls on refreshInterval — without de-duping, a single outage
// would fire a new toast for every retry attempt and every poll cycle. Only
// notify again once the message changes or the window has elapsed.
const ERROR_TOAST_DEDUPE_WINDOW_MS = 5000
let lastErrorToastMessage: string | null = null
let lastErrorToastTime = 0

function notifyApiError(message: string): void {
  const now = Date.now()
  if (message === lastErrorToastMessage && now - lastErrorToastTime < ERROR_TOAST_DEDUPE_WINDOW_MS) {
    return
  }
  lastErrorToastMessage = message
  lastErrorToastTime = now
  showApiErrorToast(message)
}

/** Resets error-toast de-duplication state. Exposed for test isolation between cases. */
export function resetApiErrorToastState(): void {
  lastErrorToastMessage = null
  lastErrorToastTime = 0
}

function apiErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return 'An unexpected error occurred'
}

let rateLimitInfo: RateLimitInfo | null = null

/** Returns the rate-limit metadata parsed from the most recent API response headers, or `null` if none has been received yet. */
export function getRateLimitInfo(): RateLimitInfo | null {
  return rateLimitInfo
}

function setRateLimitInfo(response: Response): void {
  try {
    const limit = response.headers.get('x-ratelimit-limit')
    const remaining = response.headers.get('x-ratelimit-remaining')
    const reset = response.headers.get('x-ratelimit-reset')

    if (limit && remaining && reset) {
      rateLimitInfo = {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: parseInt(reset, 10),
      }
    }
  } catch {
    // Silently fail to parse headers
  }
}

async function request<T>(path: string, init?: RequestInit, signal?: AbortSignal): Promise<T> {
  const url = `${config.apiUrl}${path}`

  try {
    const res = await fetchWithRetry(url, {
      ...init,
      signal,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })

    setRateLimitInfo(res)

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new ApiError(`${res.status} ${res.statusText}: ${text}`, res.status, statusToErrorCode(res.status))
    }

    return (await res.json()) as T
  } catch (err) {
    // Cancelled requests (unmount, pair change, etc.) are not failures — don't toast them.
    if (err instanceof DOMException && err.name === 'AbortError') throw err

    notifyApiError(apiErrorMessage(err))
    throw err
  }
}

// ---------------------------------------------------------------------------
// Request coalescing for fetchPriceHistory
// ---------------------------------------------------------------------------
interface Waiter {
  resolve: (value: PriceHistoryResponse) => void
  reject: (reason: unknown) => void
  signal?: AbortSignal
}

const pending = new Map<string, Waiter[]>()
let coalesceTimer: ReturnType<typeof setTimeout> | null = null
const COALESCE_WINDOW_MS = 50

function keyToPair(key: string): string {
  const parts = key.split(':')
  return parts.slice(0, parts.length - 2).join(':')
}

function keyToLimitOffset(key: string): { limit: number; offset: number } {
  const parts = key.split(':')
  return { limit: Number(parts[parts.length - 2]), offset: Number(parts[parts.length - 1]) }
}

function notifyWaiters(waiters: Waiter[], value: PriceHistoryResponse): void {
  for (const w of waiters) w.resolve(value)
}

function rejectWaiters(waiters: Waiter[], reason: unknown): void {
  for (const w of waiters) w.reject(reason)
}

function flushCoalesced(): void {
  coalesceTimer = null
  if (pending.size === 0) return

  const snapshot = new Map(pending)
  pending.clear()

  // Drop keys where all waiters already aborted
  for (const [key, waiters] of snapshot) {
    const active = waiters.filter((w) => !w.signal?.aborted)
    if (active.length === 0) {
      for (const w of waiters) w.reject(new DOMException('Aborted', 'AbortError'))
      snapshot.delete(key)
    } else {
      snapshot.set(key, active)
    }
  }

  if (snapshot.size === 0) return

  const keys = [...snapshot.keys()]
  const pairs = keys.map(keyToPair)

  fetchBatchHistory(pairs)
    .then((results) => {
      const byPair = new Map(results.map((r) => [r.pair, r]))
      for (const [key, waiters] of snapshot) {
        const pair = keyToPair(key)
        const result = byPair.get(pair)
        if (result) {
          notifyWaiters(waiters, result)
        } else {
          const { limit, offset } = keyToLimitOffset(key)
          _fetchHistoryDirect(pair, limit, offset).then(
            (r) => notifyWaiters(waiters, r),
            (e) => rejectWaiters(waiters, e),
          )
        }
      }
    })
    .catch(() => {
      for (const [key, waiters] of snapshot) {
        const pair = keyToPair(key)
        const { limit, offset } = keyToLimitOffset(key)
        _fetchHistoryDirect(pair, limit, offset).then(
          (r) => notifyWaiters(waiters, r),
          (e) => rejectWaiters(waiters, e),
        )
      }
    })
}

async function _fetchHistoryDirect(
  pair: string,
  limit: number,
  offset: number,
  signal?: AbortSignal,
): Promise<PriceHistoryResponse> {
  const raw = await request<PriceHistoryResponse>(
    `/api/prices/${encodeURIComponent(pair)}/history?limit=${limit}&offset=${offset}`,
    undefined,
    signal,
  )
  return validate(PriceHistoryResponseSchema, raw)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Fetches the latest aggregated price for every tracked asset pair, or a filtered subset when `pairs` is provided. */
export async function fetchAllPrices(pairs?: string[], signal?: AbortSignal): Promise<PriceData[]> {
  const params = pairs?.length ? `?pairs=${pairs.join(',')}` : ''
  const raw = await request<PriceData[]>(`/api/prices${params}`, undefined, signal)
  return validate(PriceDataSchema.array(), raw)
}

/** Fetches the latest aggregated price for a single asset pair. */
export async function fetchPrice(pair: string): Promise<PriceData> {
  const raw = await request<PriceData>(`/api/prices/${encodeURIComponent(pair)}`)
  return validate(PriceDataSchema, raw)
}

/**
 * Fetches the price history for an asset pair.
 *
 * Requests from multiple callers within a 50 ms window are coalesced into a single
 * batch POST to `/api/prices/history/batch`, reducing parallel round-trips when many
 * cards mount simultaneously.
 */
export function fetchPriceHistory(
  pair: string,
  limit = 100,
  offset = 0,
  _startTs?: number,
  _endTs?: number,
  signal?: AbortSignal,
): Promise<PriceHistoryResponse> {
  const key = `${pair}:${limit}:${offset}`

  return new Promise<PriceHistoryResponse>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    const existing = pending.get(key)
    if (existing) {
      existing.push({ resolve, reject, signal })
    } else {
      pending.set(key, [{ resolve, reject, signal }])
    }
    if (!coalesceTimer) {
      coalesceTimer = setTimeout(flushCoalesced, COALESCE_WINDOW_MS)
    }

    signal?.addEventListener('abort', () => {
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}

/** Fetches price history for multiple asset pairs in a single POST request. */
export async function fetchBatchHistory(pairs: string[], signal?: AbortSignal): Promise<PriceHistoryResponse[]> {
  const raw = await request<PriceHistoryResponse[]>('/api/prices/history/batch', {
    method: 'POST',
    body: JSON.stringify({ pairs }),
  }, signal)
  return validate(BatchHistoryResponseSchema, raw)
}

/** Checks the API server health endpoint. Returns the server status and uptime in seconds. */
export async function fetchHealth(): Promise<{ status: string; uptime: number }> {
  const raw = await request('/health')
  return validate(HealthSchema, raw)
}
