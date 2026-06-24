import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../config', () => ({
  config: { apiUrl: '' },
}))

import { rateLimitManager } from './rateLimit'

const { fetchAllPrices, fetchPrice, fetchPriceHistory, fetchHealth, RateLimitError } = await import('./rest')

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
  rateLimitManager.clearRateLimit()
})

afterEach(() => {
  vi.unstubAllGlobals()
  rateLimitManager.clearRateLimit()
})

function okResponse(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data), text: () => Promise.resolve('') }
}

function errorResponse(status: number, text: string, headers?: Record<string, string>) {
  const headerMap = new Map(Object.entries(headers ?? {}))
  return {
    ok: false,
    status,
    statusText: text,
    headers: { get: (name: string) => headerMap.get(name) ?? null },
    text: () => Promise.resolve(text),
  }
}

describe('fetchAllPrices', () => {
  it('fetches all prices without params', async () => {
    mockFetch.mockResolvedValue(okResponse([{ assetPair: 'BTC/USD' }]))
    const result = await fetchAllPrices()
    expect(result).toEqual([{ assetPair: 'BTC/USD' }])
    expect(mockFetch.mock.calls[0][0]).toBe('/api/prices')
  })

  it('fetches filtered prices with pairs param', async () => {
    mockFetch.mockResolvedValue(okResponse([{ assetPair: 'BTC/USD' }]))
    await fetchAllPrices(['BTC/USD'])
    expect(mockFetch.mock.calls[0][0]).toBe('/api/prices?pairs=BTC/USD')
  })

  it('throws on error', async () => {
    mockFetch.mockResolvedValue(errorResponse(500, 'Server error'))
    await expect(fetchAllPrices()).rejects.toThrow('500 Server error: Server error')
  })

  it('throws RateLimitError on 429 with Retry-After header', async () => {
    mockFetch.mockResolvedValue(
      errorResponse(429, 'Too Many Requests', { 'Retry-After': '30' }),
    )
    try {
      await fetchAllPrices()
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(RateLimitError)
      expect(e).toHaveProperty('retryAfterMs', 30000)
      expect((e as Error).message).toContain('429')
    }
    expect(rateLimitManager.isLimited).toBe(true)
  })

  it('prevents cascading requests when rate limited', async () => {
    // First request triggers rate limit
    mockFetch.mockResolvedValue(
      errorResponse(429, 'Too Many Requests', { 'Retry-After': '60' }),
    )
    await expect(fetchAllPrices()).rejects.toThrow(RateLimitError)

    // Reject first call (mocked above) is now used; clear mock to verify no new fetch is called
    mockFetch.mockClear()

    // Second request should be immediately rejected without making a network call
    await expect(fetchAllPrices()).rejects.toThrow(RateLimitError)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('fetchPrice', () => {
  it('fetches a single price', async () => {
    mockFetch.mockResolvedValue(okResponse({ assetPair: 'BTC/USD', price: 50000 }))
    const result = await fetchPrice('BTC/USD')
    expect(result).toEqual({ assetPair: 'BTC/USD', price: 50000 })
  })

  it('encodes the pair parameter', async () => {
    mockFetch.mockResolvedValue(okResponse({}))
    await fetchPrice('ETH/BTC')
    expect(mockFetch.mock.calls[0][0]).toBe('/api/prices/ETH%2FBTC')
  })
})

describe('fetchPriceHistory', () => {
  it('fetches history with default limit', async () => {
    mockFetch.mockResolvedValue(okResponse({ pair: 'BTC/USD', history: [] }))
    const result = await fetchPriceHistory('BTC/USD')
    expect(result).toEqual({ pair: 'BTC/USD', history: [] })
    expect(mockFetch.mock.calls[0][0]).toBe('/api/prices/BTC%2FUSD/history?limit=100&offset=0')
  })

  it('fetches history with custom limit and offset', async () => {
    mockFetch.mockResolvedValue(okResponse({ pair: 'BTC/USD', history: [] }))
    await fetchPriceHistory('BTC/USD', 50, 10)
    expect(mockFetch.mock.calls[0][0]).toBe('/api/prices/BTC%2FUSD/history?limit=50&offset=10')
  })
})

describe('fetchHealth', () => {
  it('fetches health endpoint', async () => {
    mockFetch.mockResolvedValue(okResponse({ status: 'ok', uptime: 1234 }))
    const result = await fetchHealth()
    expect(result).toEqual({ status: 'ok', uptime: 1234 })
  })
})
