import { config } from '../config'
import { fetchWithRetry } from './retry'
import type { PriceData, PriceHistoryResponse, RateLimitInfo } from '../types'
import {
  PriceDataSchema,
  PriceHistoryResponseSchema,
  BatchHistoryResponseSchema,
  HealthSchema,
} from './schemas'
import { validate } from './validate'

// ---------------------------------------------------------------------------
// ApiError — typed API error
// ---------------------------------------------------------------------------

/** Machine-readable error codes for API failures. */
export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'UNKNOWN'

/**
 * Maps an HTTP status code to a stable machine-readable {@link ApiErrorCode}.
 * Callers can switch on `code` for fine-grained error handling.
 */
function statusToCode(status: number): ApiErrorCode {
  if (status === 400) return 'BAD_REQUEST'
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 429) return 'RATE_LIMITED'
  if (status >= 500) return 'SERVER_ERROR'
  return 'UNKNOWN'
}

/**
 * Typed error thrown by the REST API client when a request fails with a
 * non-ok HTTP response. Carries a machine-readable `code`, the original
 * `status`, and a human-readable `message`.
 */
export class ApiError extends Error {
  /** Machine-readable code identifying the error category. */
  readonly code: ApiErrorCode
  /** HTTP status code from the failed response. */
  readonly status: number

  constructor(code: ApiErrorCode, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
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
  const res = await fetchWithRetry(url, {
    ...init,
    signal,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  setRateLimitInfo(res)

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ApiError(
      statusToCode(res.status),
      text || res.statusText || `HTTP ${res.status}`,
      res.status,
    )
  }

  return res.json() as Promise<T>
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
