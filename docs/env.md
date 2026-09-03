# Environment Variables Reference

All environment variables consumed by the frontend are prefixed with `VITE_` so
Vite injects them into the browser bundle at build time.

Copy `.env.example` to `.env` for local development:

```bash
cp .env.example .env
```

Never commit `.env` to version control — it is listed in `.gitignore`.

---

## Runtime Validation

Variables are validated at application start-up using Zod
(`src/config/validateEnv.ts`).

- In **development** a missing or malformed required variable throws an error
  immediately so the problem is obvious.
- In **production** a validation failure is logged to the console and defaults
  are used, allowing the app to attempt to start rather than hard-crashing.

---

## Variables by Category

### API

| Variable                | Type                     | Default               | Required | Description                                                                                                                                                                                |
| ----------------------- | ------------------------ | --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VITE_API_URL`          | `string` (URL)           | `/api`                | **yes**  | Base URL of the Aggregator REST API. The Vite dev server proxies `/api/*` to this origin. In production, set this to the deployed API URL (e.g. `https://api.stellar-oracle.example.com`). |
| `VITE_WS_URL`           | `string` (WebSocket URL) | `ws://localhost:3000` | **yes**  | WebSocket endpoint for real-time price updates. The dev server proxies `/ws` to this origin. Use `wss://` in production.                                                                   |
| `VITE_OPENAPI_SPEC_URL` | `string` (URL)           | `""`                  | no       | URL of the backend OpenAPI spec. Only consumed by the `npm run generate:openapi` script to regenerate `src/api/openapi-types.ts`. Leave blank during normal operation.                     |

### On-chain

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `VITE_ORACLE_NETWORK` | `"mainnet" \| "testnet" \| "futurenet"` | `"testnet"` | no | Soroban network the on-chain comparison panel (`PriceDetail`) reads from by default. See [docs/on-chain.md](./on-chain.md). |
| `VITE_ORACLE_CONTRACT_OVERRIDES` | `string` (JSON) | `""` | no | Overrides entries in the built-in contract registry (`src/lib/contractRegistry.ts`) for local/test deployments, e.g. `{"testnet":{"XLM":"C...LOCAL"}}`. Malformed JSON is ignored with a console warning. |

### Analytics

| Variable             | Type           | Default | Required | Description                                                                                                                                                     |
| -------------------- | -------------- | ------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_ANALYTICS_URL` | `string` (URL) | `""`    | no       | Endpoint to which Web Vitals and custom analytics events are sent. Leave blank to disable analytics entirely. Example: `https://analytics.example.com/collect`. |

### Features

| Variable        | Type                | Default   | Required | Description                                                                                                                                                                                                                                        |
| --------------- | ------------------- | --------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_USE_MOCK` | `"true" \| "false"` | `"false"` | no       | Set to `"true"` to enable the MSW (Mock Service Worker) in the browser, routing all API and WebSocket traffic to in-process mock handlers. Automatically enabled during `vitest` runs. Useful for demos and design work without a running backend. |

### Debug

| Variable         | Type                                     | Default  | Required | Description                                                                                                                                               |
| ---------------- | ---------------------------------------- | -------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_LOG_LEVEL` | `"debug" \| "info" \| "warn" \| "error"` | `"warn"` | no       | Controls the minimum log severity emitted by the app. Set to `"debug"` locally to see verbose output. Defaults to `"warn"` in production to reduce noise. |

### Stellar network

| Variable               | Type                     | Default     | Required | Description                                                                                                                                                                                                         |
| ---------------------- | ------------------------ | ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_STELLAR_NETWORK` | `"testnet" \| "mainnet"` | `"testnet"` | no       | Which Stellar network the on-chain oracle contract is read from and the price Proof tab's explorer links point at. See [docs/adr/0001-onchain-soroban-price-oracle.md](./adr/0001-onchain-soroban-price-oracle.md). |

---

## CI / Server-side Variables (not bundled)

These are used in CI workflows only and are never exposed to the browser bundle.
Store them as repository secrets in GitHub.

| Variable            | Where used | Description                                                                 |
| ------------------- | ---------- | --------------------------------------------------------------------------- |
| `SENTRY_AUTH_TOKEN` | `ci.yml`   | Sentry API token with `project:releases` scope, used to upload source maps. |
| `SENTRY_ORG`        | `ci.yml`   | Sentry organisation slug.                                                   |
| `SENTRY_PROJECT`    | `ci.yml`   | Sentry project slug.                                                        |

See [docs/source-maps.md](./source-maps.md) for details on the Sentry integration.

---

## Adding a New Variable

1. Add the variable with a comment to `.env.example` under the appropriate category.
2. Add the variable to the `envSchema` in `src/config/validateEnv.ts` (with a default
   or `.min(1)` if required).
3. Declare the variable in `src/vite-env.d.ts` so TypeScript knows about it.
4. Consume it through `src/config/index.ts` rather than `import.meta.env` directly.
5. Update this document.
