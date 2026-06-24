import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../config', () => ({
  config: {
    apiUrl: '',
    retry: {
      maxAttempts: 3,
      baseDelayMs: 1000,
      backoffMultiplier: 2,
      maxDelayMs: 30000,
      jitter: true,
    },
  },
}))

const { fetchAllPrices, fetchPrice, fetchPriceHistory, fetchHealth } = await import('./rest')

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function okResponse(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data), text: () => Promise.resolve('') }
}

function errorResponse(status: number, text: string) {
  return { ok: false, status, statusText: text, text: () => Promise.resolve(text) }
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

  it('throws on error for non-retryable 4xx', async () => {
    mockFetch.mockResolvedValue(errorResponse(404, 'Not Found'))
    await expect(fetchAllPrices()).rejects.toThrow('404 Not Found: Not Found')
  })

  it('throws HttpRetryError after retrying transient 5xx failures', async () => {
    mockFetch.mockResolvedValue(errorResponse(500, 'Server error'))
    await expect(fetchAllPrices()).rejects.toThrow('HTTP 500 Server error')
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
