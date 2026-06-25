# ADR-003: WebSocket vs Polling Architecture

- **Status:** accepted
- **Date:** 2024-01-01

## Context

Price data for oracle-aggregated asset pairs can update multiple times per minute. Clients need to reflect these changes promptly. Two approaches were considered:

1. **HTTP polling** — clients request `/api/prices` on a fixed interval.
2. **WebSocket** — server pushes updates to subscribed clients as they occur.

We also need to account for the possibility that WebSocket pushes could be slightly ahead of the REST API (race condition between the push pipeline and the write pipeline).

## Decision

Use a **native WebSocket client** (`WebSocketClient` class) as the primary channel for live updates, with REST polling as both a fallback and a consistency-check layer.

Flow:
1. `PriceProvider` opens a WebSocket connection and subscribes to all tracked pairs.
2. Each `price_update` message is applied **optimistically** to the live price map immediately.
3. After applying an optimistic update, `PriceProvider` fires a REST request to `/api/prices/:pair` to confirm the value; on mismatch the live value is rolled back to the REST result.
4. The `useSwr` hook polls `/api/prices` every 10 seconds as a fallback if the WebSocket drops.
5. On disconnect, `WebSocketClient` schedules an automatic reconnect after a configurable delay (default 3 s).

Optional gzip compression is negotiated at connect time if `DecompressionStream` is available in the browser.

## Consequences

**Easier:**
- Sub-second price update latency for connected clients.
- Automatic recovery from transient WebSocket failures without user intervention.
- REST-based confirmation prevents stale or out-of-order WebSocket messages from permanently corrupting displayed prices.

**Harder:**
- The optimistic → confirmed → synced state machine in `PriceContext` adds complexity; bugs in rollback logic can cause flickering.
- WebSocket connections consume server resources; the server must manage per-client subscription sets.
- Testing requires a fake WebSocket implementation to avoid real network calls.
