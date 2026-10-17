# SDK quickstarts

These examples use the published `@stellar-unified-price-oracle/sdk` package (`1.0.0`).
The client talks to the same REST and WebSocket endpoints documented at `/api-docs`.

## Runtime compatibility

The SDK publishes ESM and CommonJS builds with TypeScript declarations. It does
not bundle Fetch or WebSocket polyfills; compatibility depends on the runtime
features available to the application.

| Runtime                                                     | REST requests                                 | Live subscriptions                                                                         | Notes                                                                                                                                      |
| ----------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Chrome, Edge, Firefox, and Safari (current stable releases) | Supported with native `fetch`                 | Supported with native `WebSocket`                                                          | Use a bundler that supports ESM for browser applications. Exact oldest supported browser versions are not pinned or tested by the project. |
| Node.js 18+                                                 | Supported; Node.js 18 provides native `fetch` | Requires a runtime with a global `WebSocket` or an application-provided WebSocket polyfill | The SDK's `subscribe()` method reads `globalThis.WebSocket`.                                                                               |
| React 18+                                                   | Supported through the `./react` entry point   | Supported when the host runtime provides `WebSocket`                                       | React is a peer dependency; the hooks entry point is optional.                                                                             |
| Deno, Bun, and other JavaScript runtimes                    | Not officially verified                       | Not officially verified                                                                    | They may work when their Fetch, WebSocket, ESM, and package-resolution behavior matches the requirements above.                            |

The Node.js minimum applies to REST calls (`fetch`). The SDK package does not
declare an `engines` minimum, and the repository does not run an automated
cross-browser or cross-runtime CI matrix; consumers should test the exact
runtime version they deploy. CommonJS and ESM entry points are both published,
but browser users should prefer ESM through their bundler.

## React

```bash
npm install @stellar-unified-price-oracle/sdk@1.0.0
```

```tsx
import { usePrice, usePriceSubscription } from '@stellar-unified-price-oracle/sdk/react'

export function PriceCard() {
  const { price, loading, error } = usePrice('XLM-USD')
  usePriceSubscription(['XLM-USD'])

  if (loading) return <span>Loading…</span>
  if (error) return <span role="alert">{error.message}</span>
  return <strong>{price ? `${price.price} ${price.assetPair}` : 'No price'}</strong>
}
```

## Vanilla browser

```html
<output id="price">Connecting…</output>
<script type="module">
  import { OracleClient } from '@stellar-unified-price-oracle/sdk'
  const client = new OracleClient({ baseUrl: 'https://api.example.com' })
  const output = document.querySelector('#price')
  const render = (price) => {
    output.textContent = `${price.assetPair}: ${price.price}`
  }
  render(await client.getPrice('XLM-USD'))
  const stop = client.subscribe(['XLM-USD'], render)
  window.addEventListener('pagehide', stop, { once: true })
</script>
```

## Node service

```bash
npm install @stellar-unified-price-oracle/sdk@1.0.0
```

```ts
import { OracleClient } from '@stellar-unified-price-oracle/sdk'

const client = new OracleClient({ baseUrl: process.env.ORACLE_API_URL })
const price = await client.getPrice('XLM-USD')
console.log(`${price.assetPair} = ${price.price}`)
```

## Subscribe to live prices

The subscription callback runs for every update, so a live counter is just ordinary UI state:

```ts
const updates = document.querySelector('#updates')
let count = 0
const stop = client.subscribe(['XLM-USD', 'BTC-USD'], (price) => {
  count += 1
  updates.textContent = `${count} updates — ${price.assetPair}: ${price.price}`
})
```

Call `stop()` when the view or process no longer needs updates.

## Offline local fixtures

When working from a repository checkout, start the local deterministic REST
fixture server in one terminal:

```bash
npm run sdk:fixture-server
```

Then point the SDK at it from another terminal or local frontend:

```ts
const client = new OracleClient({ baseUrl: 'http://127.0.0.1:4178' })
const price = await client.getPrice('XLM-USD')
```

The server provides fixture responses for `getPrice`, `getPrices`, `getHistory`,
and `createAlert`; it binds to loopback and makes no upstream requests. It does
not implement WebSocket subscriptions. These values are examples for offline
development only, not live or production oracle data.

## Alert conditions

Alerts can combine an absolute threshold with a percentage move. The SDK sends the same shape used by the dashboard:

```ts
await client.createAlert({
  assetPair: 'XLM-USD',
  upperThreshold: 1.25,
  percentageThreshold: 5,
  percentageDirection: 'up',
  percentageWindow: '15min',
})
```

Use `percentageDirection: 'down'` for a fall, or `'either'` to alert in both directions. Keep the package version in this guide aligned with the published SDK release before publishing a new release.

## Safe retries for mutations

`createAlert` retries retryable network, rate-limit, and server failures
automatically. The SDK reuses one `Idempotency-Key` across those attempts. For
an application-level retry after the SDK has exhausted its attempts, reuse the
same key for the same logical alert creation:

```ts
import { OracleError } from '@stellar-unified-price-oracle/sdk'

const input = { assetPair: 'XLM-USD', upperThreshold: 1.25 }
const idempotencyKey = crypto.randomUUID()

try {
  await client.createAlert(input, { idempotencyKey })
} catch (error) {
  if (!(error instanceof OracleError) || !error.retryable) throw error
  // The server may have completed the first request even if its response was lost.
  await client.createAlert(input, { idempotencyKey })
}
```

Generate the key once per user action, not once per attempt. If the action can
be resumed after a process restart, persist its key alongside that pending
operation and reuse it; do not persist credentials. Never retry a failed
validation or version mismatch as though it were transient. Server-side
idempotency support is required to deduplicate the requests.

## Installing and versioning

The SDK is published to npm as `@stellar-unified-price-oracle/sdk` and follows semantic versioning: breaking changes bump the major, features the minor, fixes the patch. Releases are cut by pushing an `sdk-vX.Y.Z` tag; the `Publish SDK` workflow builds ESM + CJS bundles with type declarations, runs a consumer-style smoke test on the packed tarball (`npm run sdk:smoke`), and publishes with npm provenance. Pin the version you tested against, for example `npm install @stellar-unified-price-oracle/sdk@1.0.0`, and check the package page for the latest release. Entry points: `.` (client, errors, streaming, observer) and `./react` (hooks, requires `react` >= 18).

## Integration checklist

The API docs page (`/api-docs`) ends its SDK section with an executable integration checklist (#808). Each step sends the same requests the examples above make and reports what it observed:

1. **Configure an absolute base URL** — `baseUrl` must be an `http` or `https` origin.
2. **Confirm the health endpoint** — `GET /health` must return `200`.
3. **Parse the price list** — `GET /api/prices` must return a non-empty array whose entries carry `assetPair`, `price` and `timestamp`.
4. **Look up one pair** — `GET /api/prices/XLM-USD` must return that pair.

Run one check or all of them. A failed step shows its reason, and a failed request does not stop the remaining checks. The checks live in `src/utils/sdkChecklist.ts`, so they can be reused in CI or a smoke test.

## Migrating between SDK majors

Migration examples live on the API docs page under **SDK migration guide** (#809). Each supported major has a disclosure that lists its breaking changes and shows the code being replaced beside its replacement. The source is `src/data/sdkMigrations.ts`. Its tests fail if a major in `SUPPORTED_SDK_MAJORS` has no migration, so a new major must be documented before it is listed as supported. The repo has shipped only v1 so far, so its entry covers the move from hand-written REST calls to the typed client.
