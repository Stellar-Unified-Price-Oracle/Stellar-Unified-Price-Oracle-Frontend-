# ADR-002: Data Fetching Strategy

## Status

Accepted

## Context

The application requires real-time price data with specific constraints:

1. **Multiple data sources** — Chainlink, Redstone, Band, Reflector (aggregated server-side)
2. **Real-time expectations** — Users expect millisecond-level latency, not second-level
3. **Unreliable network** — WebSocket connections drop; need fallback to REST polling
4. **High frequency** — Price updates can arrive 10+ times per second per pair
5. **Large dataset** — Thousands of asset pairs; cannot fetch all history synchronously
6. **Mobile constraints** — Cellular networks have lower bandwidth and higher latency

## Decision

**Optimistic updates with WebSocket fast path + REST fallback.**

### Three-Tier Fetch Strategy

#### Tier 1: WebSocket (Fast Path, Optimistic)

- **Subscribes** to specific asset pairs via WebSocket connection
- **Receives** price updates in real-time (targeted message, not full price list)
- **Updates** `priceStore` **optimistically** (immediate visual feedback)
- **Revalidates** against REST API within 200ms (confirm or rollback)

```tsx
// Typical sequence for a single price update:
// t=0ms    : WebSocket message arrives with new price
// t=5ms    : UI updates optimistically (priceStore)
// t=200ms  : REST revalidation resolves
// t=205ms  : If REST matches, syncState='confirmed'; if not, rollback to REST value
```

**Benefits:**
- Lowest perceived latency (update rendered in ~5ms)
- Bandwidth-efficient (sends only changed prices, not full list)
- Natural rate limiting (can't subscribe to more pairs than available)

**Limitations:**
- Requires open WebSocket connection (battery drain on mobile)
- Can have ordering issues if REST arrives out-of-sync with WebSocket

#### Tier 2: REST with Request Deduplication (Fallback)

- **Polls** all prices periodically (configurable interval, default 30s)
- **Deduplicates** concurrent requests for the same pair
- **Implements** exponential backoff on failure (3 retries default)
- **Handles** rate limiting via client-side queue (see `OutboundRateLimiter`)

```tsx
const { data: prices } = useQuery({
  queryKey: ['prices'],
  queryFn: () => fetchAllPrices(),
  refetchInterval: 30_000,  // Default 30 seconds
  staleTime: 5_000,          // Consider stale after 5 seconds
  retry: 3,
})
```

**Benefits:**
- Works without WebSocket (graceful degradation)
- Simple to understand and debug
- Automatic retry on transient failures

**Limitations:**
- Higher latency than WebSocket (30s default)
- Higher bandwidth (fetches all prices, not just changed ones)
- Thundering herd problem if many clients poll simultaneously (mitigated by stale-time)

#### Tier 3: Historical Data Batching (On-Demand)

- **Requested explicitly** when user opens price detail view
- **Batched** to reduce network round-trips (up to 50 pairs per request)
- **Parsed in Web Worker** to avoid blocking main thread
- **Cached in IndexedDB** for offline access and faster reloads

```tsx
// User opens price detail → requests last 24h history
// Coalesced with other in-flight requests
// Parsed in background worker
// Cached to IndexedDB for instant replay on next session
```

### Optimistic Update Flow

```
WebSocket message
    ↓
[OPTIMISTIC] priceStore.setLivePrices(msg)
    ↓ (renders immediately with new price)
    ├──→ [REVALIDATE] fetchPricesBatched(pair)
    │      ↓
    │      REST response
    │      ↓
    ├──→ [COMPARE] does REST match WebSocket?
    │      ├── YES → syncState='confirmed'
    │      ├── NO  → syncState='rollback', use REST value
    │      └── ERROR → keep optimistic, retry on next polling cycle
    │
    ↓ (200ms later)
[SETTLE] syncState='synced' (animation complete)
```

### Key Invariants

1. **REST is canonical** — If WebSocket and REST disagree, REST wins. WebSocket is a fast path, not a source of truth.

2. **No concurrent requests for same pair** — The `fetchPricesBatched` function deduplicates: if pair X is already in-flight, concurrent callers wait for that request to resolve.

   ```tsx
   // All these calls share one network request:
   await fetchPricesBatched('BTC/USD')
   await fetchPricesBatched('BTC/USD')
   await fetchPricesBatched('BTC/USD')
   // → single GET /api/prices/BTC/USD
   ```

3. **Revalidation doesn't block interaction** — Revalidation runs in background; UI remains interactive even if revalidation is slow or fails.

4. **Stale data is visible** — If polling frequency is low (e.g., user on slow network), stale prices are shown with a `staleTime` visual indicator (reduced opacity, "stale" badge).

### Client-Side Rate Limiting

The application implements a token-bucket rate limiter to respect server rate limits and avoid overwhelming mobile networks:

```tsx
// src/api/outboundRateLimiter.ts
const limiter = new OutboundRateLimiter({
  requestsPerSecond: 10,
  burstSize: 20,
})

// Automatic queuing if rate limit exceeded
// Automatic retry-after handling from server
```

If rate limit is exceeded:
- Requests are queued in memory (not dropped)
- Queue drains as fast as server allows
- UI renders "waiting to send" state so user knows what's happening
- Server `Retry-After` header is automatically respected

### History Data Fetching

For price history (charting, export):

1. **Coalesced requests** — Multiple components requesting overlapping date ranges share one network request
2. **Parsed in Worker** — Response (potentially huge) is parsed off-main-thread
3. **Cached to IndexedDB** — Stored for offline access and instant replay

```tsx
// PriceDetail.tsx
const { history, loading } = usePriceHistory('BTC/USD', startDate, endDate)
// Internally:
// 1. Coalesce with other in-flight requests for overlapping ranges
// 2. POST /api/prices/history/batch with [BTC/USD, ETH/USD, ...]
// 3. Parse response in dataParser.worker.ts
// 4. Cache to IndexedDB
// 5. Return data to component
```

## Implementation Details

### useSwr Hook (Minimal SWR Implementation)

`src/hooks/useSwr.ts` implements a lightweight stale-while-revalidate hook:

```tsx
const { data, error, isValidating, refetch } = useSwr(
  'prices-all',
  () => fetchAllPrices(),
  {
    refreshInterval: 30_000,
    staleTime: 5_000,
    retryCount: 3,
  }
)
```

**Key features:**
- Request deduplication (concurrent calls share one in-flight fetch)
- Race condition protection (responses for superseded keys are discarded)
- Infinite re-render loop protection (identity-stable data via JSON comparison)

### Retry Strategy

Retries use exponential backoff with jitter:

```tsx
// src/api/retry.ts
const backoffDelay = computeBackoffDelay(attempt, baseDelay, jitter)
// attempt 1: 100ms + jitter
// attempt 2: 200ms + jitter
// attempt 3: 400ms + jitter
```

Retryable status codes: 408, 429, 500, 502, 503, 504
Non-retryable: 400, 401, 403, 404, etc.

Server `Retry-After` header overrides exponential backoff:
```
Retry-After: 60  // Retry after 60 seconds
```

## Error Handling

### WebSocket Errors

WebSocket reconnects automatically with exponential backoff:

```tsx
// src/api/websocket.ts
scheduleReconnect()
// backoff: 1s, 2s, 4s, 8s, 16s, ... (max 30s)
```

### REST Errors

REST errors are:
1. Logged via error reporter
2. Displayed in UI (toast or banner)
3. Retried automatically (if retryable)

### Recovery

Once either WebSocket or REST recovers, the other layer catches up:
- If WebSocket recovers, it receives latest prices
- If REST recovers, it provides canonical state to confirm WebSocket

## Performance Characteristics

| Operation | Latency | Bandwidth | Conditions |
|-----------|---------|-----------|-----------|
| WebSocket update | ~5ms | ~50 bytes/update | Connected |
| WebSocket reconnect | ~2-5s | - | After disconnect |
| REST poll | 30s-5m | ~100 KB per fetch | Fallback or initial load |
| History fetch | 500ms-2s | Varies (10KB-10MB) | On-demand |
| History cache hit | ~10ms | 0 | Cached in IndexedDB |

## Trade-Offs

### Pro

1. **Optimistic updates** provide snappy UI even with network latency
2. **Fallback polling** ensures graceful degradation if WebSocket fails
3. **Deduplication** prevents duplicate network requests
4. **Rate limiting** prevents overwhelming mobile networks or violating server limits
5. **Worker parsing** keeps UI responsive during large data operations

### Con

1. **Complexity** — three-tier strategy requires careful testing
2. **Coordination** — keeping WebSocket and REST in sync adds logic
3. **Revalidation cost** — every WebSocket update triggers a REST call (could be optimized)
4. **Memory overhead** — IndexedDB cache uses device storage

## Rationale

- **Optimistic + revalidate** beats pessimistic confirmation for perceived latency
- **WebSocket + polling** beats WebSocket-only because mobile connections are unreliable
- **Deduplication** is essential to prevent duplicate requests on high-frequency subscribes
- **Rate limiting** prevents cascading failures and mobile network exhaustion
- **Worker parsing** is critical because historical datasets (30k+ data points) block the main thread for seconds

## Related Decisions

- **ADR-001**: State management (where fetched data lives)
- **ADR-003**: Component architecture (which components request data)

## Further Reading

- [SWR (Stale-While-Revalidate)](https://swr.vercel.app/)
- [TanStack Query (React Query)](https://tanstack.com/query/latest)
- [Optimistic UI patterns](https://www.smashingmagazine.com/2016/11/true-offline-first-progressive-web-app-nextjs/)
- [WebSocket reconnection strategies](https://www.ably.io/topic/websockets#connection-resilience)

## Questions for Contributors

1. **When should I use WebSocket subscription vs. REST fetch?**
   - **WebSocket**: When you need real-time updates (prices, live alerts)
   - **REST**: When data is infrequent or static (history, configuration)

2. **What happens if my fetch is slow or fails?**
   - Automatic retry with exponential backoff (configurable)
   - Fallback to older data if available
   - Error logged and user notified

3. **How do I cache large datasets?**
   - Use `useIndexedDB` hook for automatic persistence
   - Specify TTL (time-to-live) for cache expiration
   - Manual `clear()` to bust cache if needed

4. **How does rate limiting work?**
   - Automatic client-side queuing if limit exceeded
   - Server `Retry-After` header respected
   - UI shows "waiting to send" state
   - No requests are lost

5. **Should I use TanStack Query for everything?**
   - Use for REST/HTTP (has automatic retries, polling, deduplication)
   - Use WebSocketClient directly for WebSocket (Query doesn't support streaming)
   - Use `useSwr` for simple cache-first patterns
