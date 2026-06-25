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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${config.apiUrl}${path}`
  const res = await fetchWithRetry(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  setRateLimitInfo(res)

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Request coalescing for fetchPriceHistory
// ---------------------------------------------------------------------------
interface Waiter {
  resolve: (value: PriceHistoryResponse) => void
  reject: (reason: unknown) => void
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
          const { limit, offset } = keyToLimitOffset(key)
          _fetchHistoryDirect(pair, limit, offset).then(
            (r) => waiters.forEach((w) => w.resolve(r)),
            (e) => waiters.forEach((w) => w.reject(e)),
          )
        }
      }
    })
    .catch(() => {
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
): Promise<PriceHistoryResponse> {
  const raw = await request<PriceHistoryResponse>(
    `/api/prices/${encodeURIComponent(pair)}/history?limit=${limit}&offset=${offset}`,
  )
  return validate(PriceHistoryResponseSchema, raw)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Fetches the latest aggregated price for every tracked asset pair, or a filtered subset when `pairs` is provided. */
export async function fetchAllPrices(pairs?: string[]): Promise<PriceData[]> {
  const params = pairs?.length ? `?pairs=${pairs.join(',')}` : ''
  const raw = await request<PriceData[]>(`/api/prices${params}`)
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

/** Fetches price history for multiple asset pairs in a single POST request. */
export async function fetchBatchHistory(pairs: string[]): Promise<PriceHistoryResponse[]> {
  const raw = await request<PriceHistoryResponse[]>('/api/prices/history/batch', {
    method: 'POST',
    body: JSON.stringify({ pairs }),
  })
  return validate(BatchHistoryResponseSchema, raw)
}

/** Checks the API server health endpoint. Returns the server status and uptime in seconds. */
export async function fetchHealth(): Promise<{ status: string; uptime: number }> {
  const raw = await request('/health')
  return validate(HealthSchema, raw)
}
