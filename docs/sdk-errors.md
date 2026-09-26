# SDK error handling

All SDK failures are `OracleError` subclasses exported from the SDK. Each has `status`, `code`, `retryable`, `retryAfterMs`, and `body`.

| Code | Class | HTTP | Retryable | Recommended handling |
| --- | --- | --- | --- | --- |
| `bad_request` | `OracleBadRequestError` | 400 | no | Fix the request |
| `unauthorized` / `forbidden` | `OracleAuthError` | 401/403 | no | Refresh or replace the API key |
| `not_found` | `OracleNotFoundError` | 404 | no | Check the pair or resource id |
| `conflict` | `OracleConflictError` | 409 | no | Re-read state, then retry manually |
| `validation_failed` | `OracleValidationError` | 422 | no | Fix payload fields |
| `rate_limited` | `OracleRateLimitError` | 429 | yes | Honors `Retry-After` |
| `server_error` | `OracleServerError` | 5xx | yes | Backoff with jitter |
| `unavailable` | `OracleUnavailableError` | 503 | yes | Backoff with jitter |
| `network_error` | `OracleNetworkError` | none | yes | Check connectivity |

## Retry policy

Retryable errors are retried up to `maxRetries` (default 3) with delay `max(Retry-After, base * 2^attempt + jitter)`, capped at 30s. See `computeDelay` in `src/sdk/retry.ts`.

## Idempotency

Mutating calls (`createAlert`) send an `Idempotency-Key` header. The same key is reused on every retry so the server can dedupe. Pass your own via `{ idempotencyKey }` to make retries safe across process restarts. Server-side dedupe support is required for the guarantee.
