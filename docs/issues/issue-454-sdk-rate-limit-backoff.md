# Issue #454 — Make the SDK Rate-Limit Aware with Automatic Backoff

## Summary

The frontend application already has a complete, layered rate-limit stack:

- `src/api/rateLimit.ts` — `RateLimitManager` tracks 429 status and notifies
  subscribers (used by WebSocket reconnect logic)
- `src/api/outboundRateLimiter.ts` — `OutboundRateLimiter` token-bucket per
  endpoint group, server-backoff bridge, FIFO queue, `useSyncExternalStore`
  compatible subscriber pattern
- `src/api/retry.ts` — `fetchWithRetry` with full-jitter exponential backoff,
  `Retry-After` header parsing, `applyServerBackoff()` propagation

SDK consumers hitting the same API through `OracleClient` get **partial** protection
today. The SDK already implements backoff and `Retry-After` parsing in its private
`request()` method. What is missing is:

1. Exposing `X-RateLimit-*` headers and retry state to callers in a clean,
   observable interface
2. An optional built-in client-side token-bucket that mirrors the
   `OutboundRateLimiter` config so SDK consumers can prevent self-inflicted 429s
3. Actionable warning logs when consumers approach their limit
4. Integration with the shared `outboundRateLimiter` singleton so SDK traffic is
   shaped alongside the rest of the app's fetch traffic

---

## Current State in `src/sdk/client.ts`

### What already works

**Automatic backoff on 429 and 503** — the `request()` method in `OracleClient`
retries up to `maxRetries` times (default 3) with exponential backoff and jitter:

```ts
const serverDelay = retryAfterMs(response.headers.get('retry-after'))
const exponential = 250 * 2 ** attempt
await this.sleep(Math.max(serverDelay, exponential + exponential * this.jitterRatio * this.random()))
```

**`Retry-After` parsing** — `retryAfterMs()` in `client.ts` handles both
numeric-seconds and HTTP-date forms.

**Rate-limit state capture** — `captureRateLimit()` reads all `X-RateLimit-*`
and `Retry-After` headers after every response and emits them to listeners:

```ts
private captureRateLimit(response: Response): void {
  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    if (key.toLowerCase().startsWith('x-ratelimit-') || key.toLowerCase() === 'retry-after')
      headers[key] = value
  })
  const next: RateLimitState = {
    limit:         Number(response.headers.get('x-ratelimit-limit'))     || null,
    remaining:     Number(response.headers.get('x-ratelimit-remaining')) || null,
    reset:         Number(response.headers.get('x-ratelimit-reset'))     || null,
    retryAfterMs:  retryAfterMs(response.headers.get('retry-after'))     || null,
    headers,
  }
  this.rateLimit = next
  this.rateLimitListeners.forEach((listener) => listener(next))
}
```

**Observable `rateLimitState`** — `get rateLimitState()` and
`onRateLimitChange(listener)` are already public API:

```ts
get rateLimitState(): RateLimitState { return this.rateLimit }
onRateLimitChange(listener: (state: RateLimitState) => void): () => void {
  this.rateLimitListeners.add(listener)
  return () => this.rateLimitListeners.delete(listener)
}
```

**Optional token bucket** — `OracleClientOptions.limiter` accepts
`{ capacity, refillPerSecond }` and wires up a `TokenBucket` that is awaited
before every fetch:

```ts
await this.limiter?.acquire()
```

### What is missing

| Gap                                                                        | Consequence                                                                                                        |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| No actionable warnings when `remaining` is low                             | Consumers hit 429 with no advance notice                                                                           |
| `limiter` option is undocumented                                           | Consumers don't know client-side throttling is available                                                           |
| SDK `request()` does not call `outboundRateLimiter.blockFor()` after a 429 | SDK-originated 429s do not back off the app's shared queue — a burst from the SDK can crowd out the rest of the UI |
| No `onApproachingLimit` callback / threshold                               | Consumers cannot build adaptive UI (e.g. pause polling when `remaining <= 2`)                                      |
| `RateLimitState` shape is not exported in the package's public types index | External consumers importing `RateLimitState` get a type error                                                     |

---

## Rate-Limit Header Reference

The Oracle API emits these headers on every response (documented in `docs/API.md`):

| Header                  | Type                 | Description                          |
| ----------------------- | -------------------- | ------------------------------------ |
| `X-RateLimit-Limit`     | integer              | Total requests allowed per window    |
| `X-RateLimit-Remaining` | integer              | Requests remaining in current window |
| `X-RateLimit-Reset`     | Unix timestamp (s)   | When the window resets               |
| `Retry-After`           | seconds or HTTP-date | Only present on 429/503 responses    |

---

## Acceptance Criteria

### AC1 — Automatic backoff on 429 and `Retry-After`

The SDK already does this. The requirement is to document it and ensure
`retryAfterMs` in `RateLimitState` is correctly populated after a 429 so
callers can inspect the backoff duration.

### AC2 — Optional client-side token-bucket limiter

The `limiter` option already exists. The requirement is to:

1. Document the option in `docs/sdk-quickstart.md` and `docs/API.md`
2. Recommend sensible defaults that mirror `OUTBOUND_RATE_LIMITS`:

```ts
// Mirror the frontend's 'prices' group budget
const client = new OracleClient({
  baseUrl: process.env.ORACLE_API_URL,
  limiter: { capacity: 12, refillPerSecond: 8 },
})
```

3. Expose a way to read current token count (or queue depth) so consumers can
   build back-pressure UI — today the `TokenBucket` is private.

### AC3 — Rate-limit state is observable by consumers

`RateLimitState` must be exported from the package index (`src/sdk/index.ts`):

```ts
// src/sdk/index.ts — add to existing exports
export type { RateLimitState, OracleClientOptions, AlertInput, TokenBucketOptions }
```

### AC4 — Actionable warnings when approaching the limit

Add a `warningThreshold` option (default `0.1` = 10% of limit remaining) that
triggers a `console.warn` with a clear, actionable message:

```ts
// Triggered when remaining / limit <= warningThreshold
console.warn(
  `[OracleClient] Rate limit low: ${remaining}/${limit} requests remaining ` +
    `(resets in ${Math.ceil((reset * 1000 - Date.now()) / 1000)}s). ` +
    `Consider increasing the limiter.refillPerSecond or reducing poll frequency.`,
)
```

Warnings are emitted at most once per rate-limit window to avoid log spam.

### AC5 — Bridge SDK 429s to the shared outbound limiter

When the SDK's `request()` receives a 429, it must call
`outboundRateLimiter.blockFor(ms)` so the app's shared queue honours the same
backoff window. This prevents the UI polling layer from immediately re-hitting
the server while the SDK is backing off.

```ts
// In OracleClient.request() after a 429:
import { outboundRateLimiter } from '../api/outboundRateLimiter'

if (response.status === 429) {
  const ms = retryAfterMs(response.headers.get('retry-after')) || 250 * 2 ** attempt
  outboundRateLimiter.blockFor(ms)
}
```

This mirrors what `applyServerBackoff()` in `src/api/retry.ts` already does for
`fetchWithRetry` callers.

---

## Proposed `RateLimitState` Shape (already implemented, needs export)

```ts
export interface RateLimitState {
  /** X-RateLimit-Limit: total requests allowed per window (null before first response) */
  limit: number | null
  /** X-RateLimit-Remaining: requests left in the current window */
  remaining: number | null
  /** X-RateLimit-Reset: Unix timestamp (seconds) when the window resets */
  reset: number | null
  /** Milliseconds to wait if a Retry-After header was received (null otherwise) */
  retryAfterMs: number | null
  /** Raw rate-limit and Retry-After headers from the last response */
  headers: Readonly<Record<string, string>>
}
```

---

## Suggested Consumer Pattern

```ts
const client = new OracleClient({
  baseUrl: process.env.ORACLE_API_URL,
  // Client-side token bucket — prevents self-inflicted 429s
  limiter: { capacity: 12, refillPerSecond: 8 },
  // React to rate-limit changes
  onRateLimitChange: (state) => {
    if (state.retryAfterMs !== null) {
      console.warn(`Rate limited — backing off ${state.retryAfterMs}ms`)
    }
    if (state.remaining !== null && state.limit !== null) {
      const pct = state.remaining / state.limit
      if (pct <= 0.1) {
        console.warn(`Only ${state.remaining}/${state.limit} requests left in window`)
      }
    }
  },
})

// Or poll state synchronously:
const { limit, remaining, reset } = client.rateLimitState
```

---

## `OutboundRateLimiter` Endpoint Group Budgets (reference)

The frontend's shared limiter uses these budgets. SDK consumers should use
values in the same order of magnitude:

| Group     | capacity | refillPerSecond | Typical use                             |
| --------- | -------- | --------------- | --------------------------------------- |
| `prices`  | 12       | 8               | Per-pair price polling — highest volume |
| `history` | 6        | 3               | Paginated history — heavier server load |
| `health`  | 2        | 1               | Background health checks                |
| `default` | 8        | 4               | Anything else                           |

---

## Affected Files

| File                     | Change type                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `src/sdk/client.ts`      | Add `warningThreshold` option; emit warning log; call `outboundRateLimiter.blockFor()` on 429; expose token bucket state |
| `src/sdk/index.ts`       | Export `RateLimitState`, `OracleClientOptions`, `AlertInput`, `TokenBucketOptions`                                       |
| `docs/sdk-quickstart.md` | Add rate-limit observability section (see issue #455)                                                                    |
| `docs/API.md`            | Document `X-RateLimit-*` headers and `OracleClientOptions.limiter`                                                       |

---

## Related

- Issue #455 — SDK quickstart guides (documents the `onRateLimitChange` and `limiter` options)
- `src/api/outboundRateLimiter.ts` — `OutboundRateLimiter` token-bucket, `blockFor()`, `OUTBOUND_RATE_LIMITS`
- `src/api/retry.ts` — `fetchWithRetry`, `applyServerBackoff()`, `parseRetryAfter()`
- `src/api/rateLimit.ts` — `RateLimitManager` — WebSocket reconnect back-pressure
- `docs/API.md` — `X-RateLimit-*` header documentation
