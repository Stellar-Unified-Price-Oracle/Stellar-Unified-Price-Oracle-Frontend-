# Issue #455 — Write SDK Quickstart Guides for React, Vanilla JS, and Node

## Summary

The published `@stellar-unified-price-oracle/sdk` package exposes `OracleClient`
(and the React hooks layer built on top of it) but has no approachable entry
point that shows the full install-to-first-price path in a single page. The
`docs/sdk-quickstart.md` file already exists but needs to be expanded into a
complete, CI-tested reference with all three runtime targets, a live subscription
counter example, and a worked alert-condition walkthrough — as specified in the
roadmap.

---

## Current State

`docs/sdk-quickstart.md` already contains:

- React hook (`usePrice` / `usePriceSubscription`) example
- Vanilla browser ES module snippet
- Node service snippet
- Subscribe live counter snippet
- `createAlert` with threshold + percentage example

**Gaps identified against the acceptance criteria:**

| Gap                              | Detail                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------- |
| No CI check                      | Snippets are untested; they can silently diverge from the published package     |
| No version-pin note              | The `@1.0.0` pin in the install command is not enforced anywhere                |
| No "under 15 minutes" validation | No setup-time measurement or minimal-project scaffold for each target           |
| No link from `/api-docs` page    | `ApiDocs.tsx` links to the doc but the link is a GitHub URL, not a routed page  |
| No error-handling path           | Snippets show the happy path only; no `catch` / error state guidance            |
| No TypeScript strictness note    | Node snippet uses `import` syntax without noting `"type": "module"` requirement |
| No rate-limit awareness section  | Issue #454 adds rate-limit observability; the quickstart should reference it    |

---

## Source: `src/sdk/client.ts`

The SDK source lives in `src/sdk/client.ts`. Key exports available to consumers:

```ts
// Core client
class OracleClient {
  constructor(options?: OracleClientOptions)

  // Data methods
  getPrice(pair: string): Promise<PriceData>
  getPrices(): Promise<PriceData[]>
  getHistory(pair: string, limit?: number, offset?: number): Promise<PriceHistoryResponse>
  createAlert(input: AlertInput): Promise<unknown>

  // Real-time
  subscribe(pairs: string[], onPrice: (price: PriceData) => void): () => void

  // Rate-limit observability
  get rateLimitState(): RateLimitState
  onRateLimitChange(listener: (state: RateLimitState) => void): () => void
}
```

`OracleClientOptions` includes:

- `baseUrl` — API root (required in practice)
- `maxRetries` — default `3`
- `jitterRatio` — default `0.2`
- `limiter` — optional `TokenBucketOptions` `{ capacity, refillPerSecond }` for
  client-side throttling (see issue #454)
- `onRateLimitChange` — convenience listener wired at construction time
- `fetch`, `sleep`, `random` — injectable for testing

---

## Acceptance Criteria

### AC1 — Three runnable quickstarts (React, Vanilla, Node)

Each quickstart must be runnable from a fresh `npm install` in under 15 minutes.
"Runnable" means:

- **React**: A Create-React-App or Vite scaffold + the SDK package renders a
  price without additional configuration.
- **Vanilla JS**: A single HTML file opened from disk (or `npx serve .`) shows
  a live price.
- **Node**: `node --input-type=module` (or a minimal `package.json`) prints a
  price to stdout.

### AC2 — Live subscription counter

The subscribe example must render a counter that increments on every WebSocket
message, demonstrating real-time state management without a framework.

### AC3 — Alert condition worked example

`createAlert` must be demonstrated with both `upperThreshold` and
`percentageThreshold` set simultaneously, with a note on `percentageDirection`
(`'up'` / `'down'` / `'either'`).

### AC4 — CI type-check and unit test

At minimum, each snippet must be type-checked in CI. Where snippets import the
SDK, a test file that imports the same snippet module and calls the relevant
method with a mocked `fetch` is sufficient.

### AC5 — Version sync

The version string `@1.0.0` in the install command must be read from
`package.json` (or a single source-of-truth constant) so a release PR that
bumps the version updates both in one place.

---

## Proposed Additions to `docs/sdk-quickstart.md`

### Error handling section (missing today)

```tsx
// React — error state
const { price, loading, error } = usePrice('XLM-USD')
if (error) {
  // error.message is the Oracle API error text or a network description
  return <p role="alert">Failed to load price: {error.message}</p>
}
```

```ts
// Node — explicit catch
try {
  const price = await client.getPrice('XLM-USD')
  console.log(price)
} catch (err) {
  // SDK throws Error with message: "Oracle API request failed (429 Too Many Requests)"
  console.error('Price unavailable:', err instanceof Error ? err.message : err)
  process.exit(1)
}
```

### Rate-limit observability section (bridges to issue #454)

```ts
const client = new OracleClient({
  baseUrl: process.env.ORACLE_API_URL,
  onRateLimitChange: (state) => {
    // state.remaining === 0 means the next request will be queued
    if (state.remaining !== null && state.remaining <= 2) {
      console.warn(`Rate limit low: ${state.remaining}/${state.limit} remaining`)
    }
    if (state.retryAfterMs !== null) {
      console.warn(`Backing off for ${state.retryAfterMs}ms`)
    }
  },
})
```

Reading the state synchronously:

```ts
const { limit, remaining, reset, retryAfterMs } = client.rateLimitState
```

### Node — TypeScript / ESM note (missing today)

```jsonc
// package.json — required for top-level await and ESM imports
{
  "type": "module",
}
```

Or use the `.mjs` extension. CommonJS (`require(...)`) is not supported.

### Version-pin helper

```bash
# Always install the version documented here:
SDK_VERSION=$(node -p "require('./package.json').dependencies['@stellar-unified-price-oracle/sdk']")
npm install @stellar-unified-price-oracle/sdk@$SDK_VERSION
```

---

## CI Integration Plan

### Type-check

Add a `typecheck:snippets` script that compiles the example files under
`docs/examples/` with `tsc --noEmit`:

```json
// package.json
"typecheck:snippets": "tsc --project tsconfig.snippets.json --noEmit"
```

### Unit test

```ts
// docs/examples/node-quickstart.test.ts
import { vi, it, expect } from 'vitest'
import { OracleClient } from '@stellar-unified-price-oracle/sdk'

it('getPrice resolves with mocked fetch', async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    headers: new Headers(),
    json: async () => ({ assetPair: 'XLM-USD', price: 0.12, timestamp: Date.now() }),
  })
  const client = new OracleClient({ baseUrl: 'http://test', fetch: mockFetch })
  const price = await client.getPrice('XLM-USD')
  expect(price.assetPair).toBe('XLM-USD')
  expect(mockFetch).toHaveBeenCalledWith(
    'http://test/api/prices/XLM-USD',
    expect.objectContaining({ headers: expect.any(Object) }),
  )
})
```

---

## Affected Files

| File                                    | Change type                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `docs/sdk-quickstart.md`                | Add error handling, rate-limit observability, Node ESM note, version-pin helper |
| `docs/examples/react-quickstart.tsx`    | New: minimal React example (type-checked in CI)                                 |
| `docs/examples/vanilla-quickstart.html` | New: standalone browser example                                                 |
| `docs/examples/node-quickstart.ts`      | New: Node service example                                                       |
| `docs/examples/node-quickstart.test.ts` | New: unit test for Node example                                                 |
| `package.json`                          | Add `typecheck:snippets` script                                                 |
| `src/pages/ApiDocs.tsx`                 | Update SDK quickstart link to point to the routed page or the expanded doc      |

---

## Related

- Issue #454 — Rate-limit awareness (adds `RateLimitState` and `onRateLimitChange`)
- Issue #452 — Live API playground (the `/api-docs` page links to this quickstart)
- `src/sdk/client.ts` — SDK source (`OracleClient`, `AlertInput`, `RateLimitState`)
- `docs/API.md` — Full REST + WebSocket reference
- `docs/QUICKSTART.md` — General quickstart (REST + WS without the SDK)
