/// <reference types="vite/client" />

interface ImportMetaEnv {
  // ── API ─────────────────────────────────────────────────────
  /** Base URL for the REST API.  Required. */
  readonly VITE_API_URL: string
  /** WebSocket endpoint for real-time price updates.  Required. */
  readonly VITE_WS_URL: string
  /** URL of the backend OpenAPI spec (used by generate:openapi script).  Optional. */
  readonly VITE_OPENAPI_SPEC_URL: string

  // ── On-chain ────────────────────────────────────────────────
  /** Soroban network the on-chain comparison panel reads from ("mainnet" | "testnet" | "futurenet").  Optional. */
  readonly VITE_ORACLE_NETWORK: string
  /** JSON override of the contract registry for local/test deployments, e.g. {"testnet":{"XLM":"C..."}}.  Optional. */
  readonly VITE_ORACLE_CONTRACT_OVERRIDES: string

  // ── Analytics ───────────────────────────────────────────────
  /** Endpoint for Web Vitals / custom analytics.  Optional — leave blank to disable. */
  readonly VITE_ANALYTICS_URL: string

  // ── Features ────────────────────────────────────────────────
  /** Enable MSW mock service worker ("true" | "false").  Optional. */
  readonly VITE_USE_MOCK: string

  // ── Debug ───────────────────────────────────────────────────
  /** Log verbosity ("debug" | "info" | "warn" | "error").  Optional. */
  readonly VITE_LOG_LEVEL: string

  // ── Stellar network ─────────────────────────────────────────
  /** Stellar network for on-chain oracle reads and explorer links ("testnet" | "mainnet").  Optional. */
  readonly VITE_STELLAR_NETWORK: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
