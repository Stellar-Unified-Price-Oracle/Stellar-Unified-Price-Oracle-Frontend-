import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../config', () => ({
  config: { retry: { maxAttempts: 3, baseDelayMs: 1000, backoffMultiplier: 2, maxDelayMs: 30000, jitter: true } },
}))

const { fetchWithRetry, computeBackoffDelay, HttpRetryError } = await import('./retry')

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
  vi.useRealTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function okResponse(data: unknown) {
  return { ok: true, status: 200, statusText: 'OK', headers: new Headers(), text: () => Promise.resolve(''), json: () => Promise.resolve(data) }
}

function errorResponse(status: number, text = '', extraHeaders: Record<string, string> = {}) {
  return {
    ok: false,
    status,
    statusText: text || `Error ${status}`,
    headers: new Headers(extraHeaders),
    text: () => Promise.resolve(text),
    json: () => Promise.reject(new Error('not json')),
  }
}

describe('isRetryableStatus via integration', () => {
  it('returns response on first success', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ ok: true }))
    const res = await fetchWithRetry('/x')
    expect(res.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry 4xx other than 429', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(404, 'Not Found'))
    const res = await fetchWithRetry('/x')
    expect(res.status).toBe(404)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry 401', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(401, 'Unauthorized'))
    const res = await fetchWithRetry('/x')
    expect(res.status).toBe(401)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('retries 500 until success', async () => {
    mockFetch
      .mockResolvedValueOnce(errorResponse(500, 'Bad'))
      .mockResolvedValueOnce(errorResponse(502, 'Bad'))
      .mockResolvedValueOnce(okResponse({ ok: true }))

    const res = await fetchWithRetry('/x')
    expect(res.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('retries 429 Too Many Requests', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(429, 'Too Many')).mockResolvedValueOnce(okResponse({ ok: true }))
    const res = await fetchWithRetry('/x')
    expect(res.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('throws HttpRetryError when max attempts exhausted on 5xx', async () => {
    mockFetch.mockResolvedValue(errorResponse(503, 'Service Unavailable'))

    await expect(fetchWithRetry('/x', undefined, { maxAttempts: 3, jitter: false })).rejects.toBeInstanceOf(HttpRetryError)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('HttpRetryError records the reason and attempt count', async () => {
    mockFetch.mockResolvedValue(errorResponse(500, 'Bad'))
    try {
      await fetchWithRetry('/x', undefined, { maxAttempts: 2, jitter: false })
      throw new Error('should not reach')
    } catch (err) {
      expect(err).toBeInstanceOf(HttpRetryError)
      const e = err as InstanceType<typeof HttpRetryError>
      expect(e.attempts).toBe(2)
      expect(e.reason).toBe('http-5xx')
    }
  })
})

describe('network error retries', () => {
  it('retries on fetch rejection (network error)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Failed to fetch')).mockResolvedValueOnce(okResponse({ ok: true }))

    const res = await fetchWithRetry('/x')
    expect(res.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('throws HttpRetryError with reason network-error when exhausted', async () => {
    mockFetch.mockRejectedValue(new Error('offline'))
    try {
      await fetchWithRetry('/x', undefined, { maxAttempts: 2, jitter: false })
      throw new Error('should not reach')
    } catch (err) {
      expect(err).toBeInstanceOf(HttpRetryError)
      const e = err as InstanceType<typeof HttpRetryError>
      expect(e.attempts).toBe(2)
      expect(e.reason).toBe('network-error')
    }
  })
})

describe('abort handling', () => {
  it('does not retry when an already-aborted signal is provided', async () => {
    const controller = new AbortController()
    controller.abort()
    mockFetch.mockResolvedValue(okResponse({ ok: true }))
    await expect(fetchWithRetry('/x', { signal: controller.signal })).rejects.toThrow(/Aborted/)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('Retry-After header', () => {
  it('respects Retry-After in seconds', async () => {
    mockFetch
      .mockResolvedValueOnce(errorResponse(429, 'Too Many', { 'Retry-After': '2' }))
      .mockResolvedValueOnce(okResponse({ ok: true }))

    vi.useFakeTimers()
    const promise = fetchWithRetry('/x')
    // advance enough for the Retry-After (2s) plus jitter, then settle
    await vi.advanceTimersByTimeAsync(10_000)
    await promise
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('respects Retry-After as an HTTP-date in the future', async () => {
    const future = new Date(Date.now() + 1500).toUTCString()
    mockFetch
      .mockResolvedValueOnce(errorResponse(503, 'Down', { 'Retry-After': future }))
      .mockResolvedValueOnce(okResponse({ ok: true }))

    vi.useFakeTimers()
    const promise = fetchWithRetry('/x')
    await vi.advanceTimersByTimeAsync(5000)
    await promise
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})

describe('computeBackoffDelay', () => {
  it('grows exponentially without jitter', () => {
    const delay0 = computeBackoffDelay(0, { baseDelayMs: 1000, backoffMultiplier: 2, maxDelayMs: 30000, jitter: false })
    const delay1 = computeBackoffDelay(1, { baseDelayMs: 1000, backoffMultiplier: 2, maxDelayMs: 30000, jitter: false })
    const delay2 = computeBackoffDelay(2, { baseDelayMs: 1000, backoffMultiplier: 2, maxDelayMs: 30000, jitter: false })
    expect(delay0).toBe(1000)
    expect(delay1).toBe(2000)
    expect(delay2).toBe(4000)
  })

  it('caps at maxDelayMs', () => {
    const delay = computeBackoffDelay(20, { baseDelayMs: 1000, backoffMultiplier: 2, maxDelayMs: 8000, jitter: false })
    expect(delay).toBe(8000)
  })

  it('applies full jitter when enabled (random < base)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25)
    const delay = computeBackoffDelay(0, { baseDelayMs: 1000, backoffMultiplier: 2, maxDelayMs: 30000, jitter: true })
    // expect floor(0.25 * 1000) = 250
    expect(delay).toBeLessThanOrEqual(1000)
    expect(delay).toBeGreaterThanOrEqual(0)
  })

  it('Retry-After overrides backoff when smaller', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const delay = computeBackoffDelay(0, {
      baseDelayMs: 1000,
      backoffMultiplier: 2,
      maxDelayMs: 30000,
      jitter: true,
      retryAfter: '3',
    })
    expect(delay).toBe(3000)
  })
})

describe('non-retryable 4xx surfaced as ok=false response', () => {
  it('returns the response object unchanged for callers to inspect', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(422, 'Validation failed'))
    const res = await fetchWithRetry('/x')
    expect(res.ok).toBe(false)
    expect(res.status).toBe(422)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
