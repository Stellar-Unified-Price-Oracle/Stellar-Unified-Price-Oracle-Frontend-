import { config } from '../config'
import { fetchWithRetry } from './retry'
import type { PriceData, PriceHistoryResponse } from '../types'
import { idbCache } from '../hooks/useIndexedDB'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${config.apiUrl}${path}`
  const res = await fetchWithRetry(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
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
