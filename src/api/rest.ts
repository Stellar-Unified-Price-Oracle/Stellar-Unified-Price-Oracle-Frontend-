import { config } from '../config'
import { showApiErrorToast } from '../context/ToastContext'
import type { PriceData, PriceHistoryResponse, RateLimitInfo } from '../types'
import type { OnChainPriceRecord, OracleNetwork } from '../types/onchain'
import { fetchWithRetry } from './retry'
import {
  PriceDataSchema,
  PriceHistoryResponseSchema,
  BatchHistoryResponseSchema,
  HealthSchema,
  OnChainPriceRecordSchema,
} from './schemas'
import { validate } from './validate'
import { getApiVersionInfo, getAcceptVersionHeader } from './version'
import { circuitBreaker, circuitKeyForPath, CircuitOpenError } from './circuitBreaker'

/** Categorical classification of an {@link ApiError}, derived from the HTTP status. */
export type ApiErrorCode =
  'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'RATE_LIMITED' | 'SERVER_ERROR' | 'UNKNOWN_ERROR'

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

/** Extra behaviour flags for {@link request}. */
interface RequestOptions {
  /**
   * HTTP statuses that should still throw {@link ApiError} but must not
   * trigger the automatic error toast — for endpoints where a given status
   * is an expected, gracefully-handled outcome rather than a failure (e.g.
   * 404 from `/proof` meaning "no on-chain proof for this asset").
   */
  silentStatuses?: readonly number[]
}

async function request<T>(
  path: string,
  init?: RequestInit,
  signal?: AbortSignal,
  options?: RequestOptions,
): Promise<T> {
  const url = `${config.apiUrl}${path}`
  const circuitKey = circuitKeyForPath(path)

  // When an endpoint group is failing repeatedly, stop sending requests to it
  // until the cooldown elapses (see circuitBreaker.ts).
  if (!circuitBreaker.canRequest(circuitKey)) {
    throw new CircuitOpenError(circuitKey)
  }

  // Include the Accept-Version header on every request so the server can
  // route to the appropriate handler version or return a version error.
  const versionInfo = getApiVersionInfo()
  const acceptVersion = getAcceptVersionHeader(versionInfo?.serverVersion)

  try {
    const res = await fetchWithRetry(url, {
      ...init,
      signal,
      headers: {
        'Content-Type': 'application/json',
        'Accept-Version': acceptVersion,
        ...init?.headers,
      },
    })

    setRateLimitInfo(res)

    if (!res.ok) {
      const text = await res.text().catch(() => '')

      // 406 Not Acceptable / 409 Conflict — server cannot satisfy the requested version
      if (res.status === 406 || res.status === 409) {
        const serverVersion = res.headers.get('X-API-Version') ?? 'unknown'
        throw new ApiError(
          `API version mismatch: server is at v${serverVersion}, client requested v${acceptVersion}. ` +
            `Please update the frontend or backend to a compatible version.`,
          res.status,
          'UNKNOWN_ERROR',
        )
      }

      throw new ApiError(`${res.status} ${res.statusText}: ${text}`, res.status, statusToErrorCode(res.status))
    }

    circuitBreaker.recordSuccess(circuitKey)
    return (await res.json()) as T
  } catch (err) {
    // Cancelled requests (unmount, pair change, etc.) are not failures — don't toast them.
    if (err instanceof DOMException && err.name === 'AbortError') throw err

    circuitBreaker.recordFailure(circuitKey)
    const silent = err instanceof ApiError && options?.silentStatuses?.includes(err.status)
    if (!silent) notifyApiError(apiErrorMessage(err))
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
 * Fetches the on-chain verification proof for an asset pair's aggregated
 * price — the per-source signed contributions and aggregate signature/commitment
 * published to the Soroban oracle contract (see
 * docs/adr/0001-onchain-soroban-price-oracle.md).
 *
 * Pass `timestamp` to verify a specific historical record instead of the latest
 * one; the backend resolves it to the on-chain record whose version was current
 * at that time.
 *
 * Resolves to `null` — rather than throwing — when no proof exists for this
 * pair/timestamp (e.g. the asset has no canonical on-chain representation, or
 * the on-chain oracle hasn't been rolled out to it yet), so callers can render
 * a graceful empty state instead of an error banner. Any other failure (network,
 * 5xx, etc.) still throws.
 */
export async function fetchPriceProof(pair: string, timestamp?: number): Promise<PriceProof | null> {
  const query = timestamp !== undefined ? `?timestamp=${timestamp}` : ''
  try {
    const raw = await request<PriceProof>(
      `/api/prices/${encodeURIComponent(pair)}/proof${query}`,
      undefined,
      undefined,
      { silentStatuses: [404] },
    )
    return validate(PriceProofSchema, raw)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

// ---------------------------------------------------------------------------
// Request batching for fetchPricesBatched
// ---------------------------------------------------------------------------
// Per-pair callers (e.g. WebSocket price-update confirmation, which fires once
// per pair per message) are debounced into a single fetchAllPrices call so a
// burst of updates across many pairs costs one request instead of one per pair.
interface PriceWaiter {
  resolve: (value: PriceData) => void
  reject: (reason: unknown) => void
  signal?: AbortSignal
}

const pendingPrices = new Map<string, PriceWaiter[]>()
let priceCoalesceTimer: ReturnType<typeof setTimeout> | null = null

function resolveAll(waiters: PriceWaiter[], value: PriceData): void {
  for (const w of waiters) w.resolve(value)
}

function rejectAll(waiters: PriceWaiter[], reason: unknown): void {
  for (const w of waiters) w.reject(reason)
}

/** Falls back to an individual request for one pair — used when a pair is missing from a batch response or the whole batch failed, so one bad pair doesn't affect the rest. */
function settleViaDirectFetch(pair: string, waiters: PriceWaiter[]): void {
  fetchPrice(pair).then(
    (r) => resolveAll(waiters, r),
    (e) => rejectAll(waiters, e),
  )
}

function flushCoalescedPrices(): void {
  priceCoalesceTimer = null
  if (pendingPrices.size === 0) return

  const snapshot = new Map(pendingPrices)
  pendingPrices.clear()

  for (const [pair, waiters] of snapshot) {
    const active = waiters.filter((w) => !w.signal?.aborted)
    if (active.length === 0) {
      for (const w of waiters) w.reject(new DOMException('Aborted', 'AbortError'))
      snapshot.delete(pair)
    } else {
      snapshot.set(pair, active)
    }
  }

  if (snapshot.size === 0) return

  const pairs = [...snapshot.keys()]
  const { maxBatchSize } = config.priceBatch
  const batches: string[][] = []
  for (let i = 0; i < pairs.length; i += maxBatchSize) {
    batches.push(pairs.slice(i, i + maxBatchSize))
  }

  for (const batchPairs of batches) {
    fetchAllPrices(batchPairs)
      .then((results) => {
        const byPair = new Map(results.map((r) => [r.assetPair, r]))
        for (const pair of batchPairs) {
          const waiters = snapshot.get(pair) ?? []
          const result = byPair.get(pair)
          if (result) {
            resolveAll(waiters, result)
          } else {
            settleViaDirectFetch(pair, waiters)
          }
        }
      })
      .catch(() => {
        for (const pair of batchPairs) {
          settleViaDirectFetch(pair, snapshot.get(pair) ?? [])
        }
      })
  }
}

/**
 * Fetches the latest price for a single pair, debouncing concurrent per-pair calls
 * within a configurable window (`config.priceBatch.debounceMs`) into one batched
 * `fetchAllPrices` request (capped at `config.priceBatch.maxBatchSize` pairs per
 * request). A pair missing from the batch response — or a batch that fails
 * entirely — falls back to an individual fetch so one pair's failure doesn't
 * affect the others.
 */
export function fetchPricesBatched(pair: string, signal?: AbortSignal): Promise<PriceData> {
  return new Promise<PriceData>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    const existing = pendingPrices.get(pair)
    if (existing) {
      existing.push({ resolve, reject, signal })
    } else {
      pendingPrices.set(pair, [{ resolve, reject, signal }])
    }
    if (!priceCoalesceTimer) {
      priceCoalesceTimer = setTimeout(flushCoalescedPrices, config.priceBatch.debounceMs)
    }

    signal?.addEventListener(
      'abort',
      () => {
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
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

    signal?.addEventListener(
      'abort',
      () => {
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

/** Fetches price history for multiple asset pairs in a single POST request. */
export async function fetchBatchHistory(pairs: string[], signal?: AbortSignal): Promise<PriceHistoryResponse[]> {
  const raw = await request<PriceHistoryResponse[]>(
    '/api/prices/history/batch',
    {
      method: 'POST',
      body: JSON.stringify({ pairs }),
    },
    signal,
  )
  return validate(BatchHistoryResponseSchema, raw)
}

/** Checks the API server health endpoint. Returns the server status and uptime in seconds. */
export async function fetchHealth(): Promise<{ status: string; uptime: number }> {
  const raw = await request('/health')
  return validate(HealthSchema, raw)
}

/** Fetches the latest price a Soroban oracle contract has published on-chain for one asset. */
export async function fetchOnChainPrice(
  network: OracleNetwork,
  asset: string,
  signal?: AbortSignal,
): Promise<OnChainPriceRecord> {
  const raw = await request<OnChainPriceRecord>(
    `/api/onchain/${network}/${encodeURIComponent(asset)}`,
    undefined,
    signal,
  )
  return validate(OnChainPriceRecordSchema, raw)
}
