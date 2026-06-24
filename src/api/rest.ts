import { config } from '../config'
import { fetchWithRetry } from './retry'
import type { PriceData, PriceHistoryResponse } from '../types'
import { idbCache } from '../hooks/useIndexedDB'
import { rateLimitManager } from './rateLimit'

/** Error thrown when a request fails due to rate limiting. */
export class RateLimitError extends Error {
  retryAfterMs: number

  constructor(message: string, retryAfterMs: number) {
    super(message)
    this.name = 'RateLimitError'
    this.retryAfterMs = retryAfterMs
  }
}

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Block request if currently rate limited (prevent cascading)
  if (rateLimitManager.checkAndClear()) {
    throw new RateLimitError(
      `Rate limited. Retry in ${Math.ceil(rateLimitManager.retryAfterMs / 1000)}s`,
      rateLimitManager.retryAfterMs,
    )
  }

  const url = `${config.apiUrl}${path}`
  const res = await fetchWithRetry(url, {
    ...init,
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

export async function fetchAllPrices(pairs?: string[]): Promise<PriceData[]> {
  const params = pairs?.length ? `?pairs=${pairs.join(',')}` : ''
  const cacheKey = `all${params}`
  try {
    const data = await request<PriceData[]>(`/api/prices${params}`)
    idbCache.set('prices', cacheKey, data)
    return data
  } catch (err) {
    // Serve stale cache on network failure (offline support)
    const cached = await idbCache.get<PriceData[]>('prices', cacheKey, Infinity)
    if (cached) return cached
    throw err
  }
}

export async function fetchPrice(pair: string): Promise<PriceData> {
  try {
    const data = await request<PriceData>(`/api/prices/${encodeURIComponent(pair)}`)
    idbCache.set('prices', pair, data)
    return data
  } catch (err) {
    const cached = await idbCache.get<PriceData>('prices', pair, Infinity)
    if (cached) return cached
    throw err
  }
}

export async function fetchPriceHistory(
  pair: string,
  limit = 100,
  offset = 0,
  _startTs?: number,
  _endTs?: number,
): Promise<PriceHistoryResponse> {
  const cacheKey = `${pair}:${limit}:${offset}`
  try {
    const data = await request<PriceHistoryResponse>(
      `/api/prices/${encodeURIComponent(pair)}/history?limit=${limit}&offset=${offset}`
    )
    idbCache.set('history', cacheKey, data)
    return data
  } catch (err) {
    const cached = await idbCache.get<PriceHistoryResponse>('history', cacheKey, Infinity)
    if (cached) return cached
    throw err
  }
}

export async function fetchHealth(): Promise<{ status: string; uptime: number }> {
  return request('/health')
}
