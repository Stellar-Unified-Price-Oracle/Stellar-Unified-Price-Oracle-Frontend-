# ADR-005: Error Handling Strategy

- **Status:** accepted
- **Date:** 2024-01-01

## Context

The application fetches data from a REST API and a WebSocket server, both of which can fail transiently (network outages, server restarts, rate limiting). Errors need to be handled at multiple layers:

1. **Network/HTTP** — retryable vs non-retryable failures, rate-limit back-off.
2. **Data validation** — API responses may not match expected schemas.
3. **Component render errors** — an uncaught exception in a component tree must not crash the entire page.
4. **User feedback** — errors must be surfaced in a useful, non-intrusive way.

## Decision

Use a layered error handling approach:

- **`fetchWithRetry`** — wraps `fetch` with exponential back-off (configurable via `RetryOptions`). Retries on 5xx and 429 responses; honours `Retry-After`; aborts cleanly on `AbortSignal`. Throws a structured `HttpRetryError` after all attempts are exhausted.
- **Zod schema validation** — every REST response is validated against a Zod schema immediately after parsing. Invalid responses throw before the data reaches any component.
- **`useSwr` error state** — catches thrown errors and exposes them as `error: string | null` so components can render inline error messages without crashing.
- **`ErrorBoundary` component** — wraps the component tree at the router level. Catches synchronous render errors and displays a fallback UI instead of a blank page.
- **WebSocket errors** — the `WebSocketClient` silently drops malformed messages and schedules automatic reconnection on disconnect, avoiding error propagation to the UI for transient issues.

## Consequences

**Easier:**
- Transient API failures resolve themselves without user intervention.
- Schema validation fails fast at the API boundary, preventing corrupt data from reaching the UI.
- `ErrorBoundary` prevents a single component error from taking down the whole dashboard.

**Harder:**
- Retry logic adds latency on first-load if the backend is temporarily unavailable — users may wait several seconds before seeing the final error state.
- Zod validation schemas must be kept in sync with the backend API contract; drift causes silent failures in production.
