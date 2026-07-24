import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rateLimitManager } from './rateLimit'

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

vi.mock('../hooks/useIndexedDB', () => ({
  idbCache: { get: vi.fn().mockResolvedValue(null), set: vi.fn() },
}))

vi.mock('../context/ToastContext', () => ({
  showApiErrorToast: vi.fn(),
}))

// Keep a reference to reset coalescing state between tests
const restModule = await import('./rest')
const {
  fetchAllPrices,
  fetchPrice,
  fetchPriceHistory,
  fetchBatchHistory,
  fetchHealth,
  ApiError,
  resetApiErrorToastState,
} = restModule
const { showApiErrorToast } = await import('../context/ToastContext')

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockReset()
  vi.mocked(showApiErrorToast).mockClear()
  vi.stubGlobal('fetch', mockFetch)
  vi.useFakeTimers()
  resetApiErrorToastState()
})

afterEach(() => {
  vi.runAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  rateLimitManager.clearRateLimit()
  resetApiErrorToastState()
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

// ---------------------------------------------------------------------------
// fetchAllPrices
// ---------------------------------------------------------------------------
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
    const promise = fetchAllPrices()
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(5000)
      await Promise.resolve()
    }
    await expect(promise).rejects.toThrow('HTTP 500 Server error')
  }, 10_000)
})

// ---------------------------------------------------------------------------
// ApiError
// ---------------------------------------------------------------------------
describe('ApiError', () => {
  it('throws an ApiError (not a plain Error) for a non-retryable 4xx response', async () => {
    mockFetch.mockResolvedValue(errorResponse(404, 'Not Found'))

    await expect(fetchAllPrices()).rejects.toBeInstanceOf(ApiError)
  })

  it('is still an instanceof Error for backward compatibility with existing catch blocks', async () => {
    mockFetch.mockResolvedValue(errorResponse(404, 'Not Found'))

    await expect(fetchAllPrices()).rejects.toBeInstanceOf(Error)
  })

  it('carries the HTTP status on the error', async () => {
    mockFetch.mockResolvedValue(errorResponse(404, 'Not Found'))

    try {
      await fetchAllPrices()
      expect.unreachable('fetchAllPrices should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as InstanceType<typeof ApiError>).status).toBe(404)
    }
  })

  it.each([
    [400, 'BAD_REQUEST'],
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [418, 'UNKNOWN_ERROR'],
  ] as const)('maps HTTP %i to code %s', async (status, code) => {
    mockFetch.mockResolvedValue(errorResponse(status, 'error'))

    try {
      await fetchAllPrices()
      expect.unreachable('fetchAllPrices should have thrown')
    } catch (err) {
      expect((err as InstanceType<typeof ApiError>).code).toBe(code)
    }
  })

  it('preserves the status/statusText/body message format', async () => {
    mockFetch.mockResolvedValue(errorResponse(404, 'Not Found'))

    try {
      await fetchAllPrices()
      expect.unreachable('fetchAllPrices should have thrown')
    } catch (err) {
      expect((err as InstanceType<typeof ApiError>).message).toBe('404 Not Found: Not Found')
    }
  })
})

// ---------------------------------------------------------------------------
// fetchPrice
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// fetchHealth
// ---------------------------------------------------------------------------
describe('fetchHealth', () => {
  it('fetches health endpoint', async () => {
    mockFetch.mockResolvedValue(okResponse({ status: 'ok', uptime: 1234 }))
    const result = await fetchHealth()
    expect(result).toEqual({ status: 'ok', uptime: 1234 })
  })
})

// ---------------------------------------------------------------------------
// fetchBatchHistory
// ---------------------------------------------------------------------------
describe('fetchBatchHistory', () => {
  it('posts to the batch endpoint', async () => {
    const batchResult = [
      { pair: 'BTC/USD', history: [] },
      { pair: 'ETH/USD', history: [] },
    ]
    mockFetch.mockResolvedValue(okResponse(batchResult))

    const result = await fetchBatchHistory(['BTC/USD', 'ETH/USD'])

    expect(result).toEqual(batchResult)
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/prices/history/batch')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ pairs: ['BTC/USD', 'ETH/USD'] })
  })

  it('throws on batch endpoint error', async () => {
    mockFetch.mockResolvedValue(errorResponse(404, 'Not Found'))
    await expect(fetchBatchHistory(['BTC/USD'])).rejects.toThrow('404')
  })
})

// ---------------------------------------------------------------------------
// fetchPriceHistory — coalescing
// ---------------------------------------------------------------------------
describe('fetchPriceHistory coalescing', () => {
  const btcHistory = { pair: 'BTC/USD', history: [{ price: 1, timestamp: 0, confidence: 0.9, sources: [] }] }
  const ethHistory = { pair: 'ETH/USD', history: [] }

  it('coalesces concurrent calls into a single batch request', async () => {
    mockFetch.mockResolvedValue(okResponse([btcHistory, ethHistory]))

    const p1 = fetchPriceHistory('BTC/USD')
    const p2 = fetchPriceHistory('ETH/USD')

    // Advance past the 50ms coalescing window
    vi.advanceTimersByTime(50)
    await Promise.resolve() // flush microtasks

    const [r1, r2] = await Promise.all([p1, p2])

    // Only one network call should have been made
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0]).toBe('/api/prices/history/batch')
    expect(r1).toEqual(btcHistory)
    expect(r2).toEqual(ethHistory)
  })

  it('deduplicates identical concurrent requests', async () => {
    mockFetch.mockResolvedValue(okResponse([btcHistory]))

    const p1 = fetchPriceHistory('BTC/USD')
    const p2 = fetchPriceHistory('BTC/USD')

    vi.advanceTimersByTime(50)
    await Promise.resolve()

    const [r1, r2] = await Promise.all([p1, p2])

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(r1).toEqual(btcHistory)
    expect(r2).toEqual(btcHistory)
  })

  it('falls back to individual requests when batch endpoint fails', async () => {
    // First call = batch fails, then individual succeeds
    mockFetch
      .mockResolvedValueOnce(errorResponse(404, 'Not Found')) // batch
      .mockResolvedValue(okResponse(btcHistory)) // individual fallback

    const p1 = fetchPriceHistory('BTC/USD')

    vi.advanceTimersByTime(50)
    await Promise.resolve()

    const result = await p1
    expect(result).toEqual(btcHistory)
    // First call was batch, second was individual
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch.mock.calls[1][0]).toBe('/api/prices/BTC%2FUSD/history?limit=100&offset=0')
  })
})

// ---------------------------------------------------------------------------
// Zod schema validation
// ---------------------------------------------------------------------------
describe('schema validation', () => {
  it('warns on schema mismatch in test mode but still returns data', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // confidence > 1 violates the schema
    const badData = [{ assetPair: 'BTC/USD', price: 1, timestamp: 0, confidence: 1.5, sources: [] }]
    mockFetch.mockResolvedValue(okResponse(badData))

    const result = await fetchAllPrices()
    // Still returns data (graceful degradation)
    expect(result).toEqual(badData)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[API validation]'))

    warnSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// API error toast notifications (#184)
// ---------------------------------------------------------------------------
describe('API error toasts', () => {
  it('shows a toast with the error message on a non-retryable 4xx failure', async () => {
    mockFetch.mockResolvedValue(errorResponse(404, 'Not Found'))

    await expect(fetchAllPrices()).rejects.toBeInstanceOf(ApiError)

    expect(showApiErrorToast).toHaveBeenCalledTimes(1)
    expect(showApiErrorToast).toHaveBeenCalledWith('404 Not Found: Not Found')
  })

  it('does not show a toast for a cancelled (aborted) request', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(fetchAllPrices(undefined, controller.signal)).rejects.toThrow()

    expect(showApiErrorToast).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('de-duplicates identical error messages within the dedupe window', async () => {
    mockFetch.mockResolvedValue(errorResponse(404, 'Not Found'))

    await expect(fetchAllPrices()).rejects.toBeInstanceOf(ApiError)
    await expect(fetchPrice('BTC/USD')).rejects.toBeInstanceOf(ApiError)
    await expect(fetchAllPrices()).rejects.toBeInstanceOf(ApiError)

    // Same message, three failures in a row — only the first should toast.
    expect(showApiErrorToast).toHaveBeenCalledTimes(1)
  })

  it('shows a new toast once the dedupe window has elapsed for the same message', async () => {
    mockFetch.mockResolvedValue(errorResponse(404, 'Not Found'))

    await expect(fetchAllPrices()).rejects.toBeInstanceOf(ApiError)
    expect(showApiErrorToast).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(5001)

    await expect(fetchAllPrices()).rejects.toBeInstanceOf(ApiError)
    expect(showApiErrorToast).toHaveBeenCalledTimes(2)
  })

  it('shows a toast immediately for a different error message even within the dedupe window', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(404, 'Not Found'))
    await expect(fetchAllPrices()).rejects.toBeInstanceOf(ApiError)

    mockFetch.mockResolvedValueOnce(errorResponse(403, 'Forbidden'))
    await expect(fetchAllPrices()).rejects.toBeInstanceOf(ApiError)

    expect(showApiErrorToast).toHaveBeenCalledTimes(2)
    expect(showApiErrorToast).toHaveBeenNthCalledWith(1, '404 Not Found: Not Found')
    expect(showApiErrorToast).toHaveBeenNthCalledWith(2, '403 Forbidden: Forbidden')
  })

  it('does not show a toast on success', async () => {
    mockFetch.mockResolvedValue(okResponse([{ assetPair: 'BTC/USD' }]))

    await fetchAllPrices()

    expect(showApiErrorToast).not.toHaveBeenCalled()
  })
})
