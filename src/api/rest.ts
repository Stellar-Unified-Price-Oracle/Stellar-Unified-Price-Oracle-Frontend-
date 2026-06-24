import { config } from '../config'
import { fetchWithRetry } from './retry'
import type { PriceData, PriceHistoryResponse, RateLimitInfo } from '../types'
import { idbCache } from '../hooks/useIndexedDB'
import {
  PriceDataSchema,
  PriceHistoryResponseSchema,
  BatchHistoryResponseSchema,
  HealthSchema,
} from './schemas'
import { validate } from './validate'

// Global rate limit info store (Issue #93)
let rateLimitInfo: RateLimitInfo | null = null

/**
 * Get current rate limit info if available
 */
export function getRateLimitInfo(): RateLimitInfo | null {
  return rateLimitInfo
}

/**
 * Set rate limit info (used internally)
 */
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

  // Parse rate limit headers (Issue #93)
  setRateLimitInfo(res)

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Request coalescing for fetchPriceHistory
// Requests within a 50ms window are batched into a single POST.
// Falls back to individual GETs when the batch endpoint is unavailable.
// ---------------------------------------------------------------------------
interface Waiter {
  resolve: (value: PriceHistoryResponse) => void
  reject: (reason: unknown) => void
}

// key = `${pair}:${limit}:${offset}`
const pending = new Map<string, Waiter[]>()
let coalesceTimer: ReturnType<typeof setTimeout> | null = null
const COALESCE_WINDOW_MS = 50

// pair may contain ":" (e.g. "BTC/USD") but limit/offset are always the last two segments
function keyToPair(key: string): string {
  const parts = key.split(':')
  return parts.slice(0, parts.length - 2).join(':')
}

function keyToLimitOffset(key: string): { limit: number; offset: number } {
  const parts = key.split(':')
  return { limit: Number(parts[parts.length - 2]), offset: Number(parts[parts.length - 1]) }
}

function flushCoalesced() {
  coalesceTimer = null
  if (pending.size === 0) return

  const snapshot = new Map(pending)
  pending.clear()

  const keys = [...snapshot.keys()]
  const pairs = keys.map(keyToPair)

  fetchBatchHistory(pairs)
    .then((results) => {
      const byPair = new Map(results.map((r) => [r.pair, r]))
      for (const [key, waiters] of snapshot) {
        const pair = keyToPair(key)
        const result = byPair.get(pair)
        if (result) {
          waiters.forEach((w) => w.resolve(result))
        } else {
          // batch returned no entry for this pair — fallback to individual
          const { limit, offset } = keyToLimitOffset(key)
          _fetchHistoryDirect(pair, limit, offset).then(
            (r) => waiters.forEach((w) => w.resolve(r)),
            (e) => waiters.forEach((w) => w.reject(e)),
          )
        }
      }
    })
    .catch(() => {
      // Batch endpoint unavailable — fall back to individual requests
      for (const [key, waiters] of snapshot) {
        const pair = keyToPair(key)
        const { limit, offset } = keyToLimitOffset(key)
        _fetchHistoryDirect(pair, limit, offset).then(
          (r) => waiters.forEach((w) => w.resolve(r)),
          (e) => waiters.forEach((w) => w.reject(e)),
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
  const cacheKey = `${pair}:${limit}:${offset}`
  try {
    const raw = await request<PriceHistoryResponse>(
      `/api/prices/${encodeURIComponent(pair)}/history?limit=${limit}&offset=${offset}`,
      undefined,
      signal,
    )
    const data = validate(PriceHistoryResponseSchema, raw)
    idbCache.set('history', cacheKey, data)
    return data
  } catch (err) {
    const cached = await idbCache.get<PriceHistoryResponse>('history', cacheKey, Infinity)
    if (cached) return cached
    throw err
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function fetchAllPrices(pairs?: string[], signal?: AbortSignal): Promise<PriceData[]> {
  const params = pairs?.length ? `?pairs=${pairs.join(',')}` : ''
  const cacheKey = `all${params}`
  try {
    const raw = await request<PriceData[]>(`/api/prices${params}`, undefined, signal)
    const data = validate(PriceDataSchema.array(), raw)
    idbCache.set('prices', cacheKey, data)
    return data
  } catch (err) {
    const cached = await idbCache.get<PriceData[]>('prices', cacheKey, Infinity)
    if (cached) return cached
    throw err
  }
}

export async function fetchPrice(pair: string, signal?: AbortSignal): Promise<PriceData> {
  try {
    const raw = await request<PriceData>(`/api/prices/${encodeURIComponent(pair)}`, undefined, signal)
    const data = validate(PriceDataSchema, raw)
    idbCache.set('prices', pair, data)
    return data
  } catch (err) {
    const cached = await idbCache.get<PriceData>('prices', pair, Infinity)
    if (cached) return cached
    throw err
  }
}

/** Coalesces concurrent calls within a 50ms window into a single batch request. */
export function fetchPriceHistory(
  pair: string,
  limit = 100,
  offset = 0,
  _startTs?: number,
  _endTs?: number,
): Promise<PriceHistoryResponse> {
  const key = `${pair}:${limit}:${offset}`

  return new Promise<PriceHistoryResponse>((resolve, reject) => {
    const existing = pending.get(key)
    if (existing) {
      existing.push({ resolve, reject })
    } else {
      pending.set(key, [{ resolve, reject }])
    }
    if (!coalesceTimer) {
      coalesceTimer = setTimeout(flushCoalesced, COALESCE_WINDOW_MS)
    }
  })
}

/** Batch-fetch history for multiple pairs in one request. */
export async function fetchBatchHistory(pairs: string[]): Promise<PriceHistoryResponse[]> {
  const raw = await request<PriceHistoryResponse[]>('/api/prices/history/batch', {
    method: 'POST',
    body: JSON.stringify({ pairs }),
  })
  return validate(BatchHistoryResponseSchema, raw)
}

export async function fetchHealth(): Promise<{ status: string; uptime: number }> {
  const raw = await request('/health')
  return validate(HealthSchema, raw)
}
