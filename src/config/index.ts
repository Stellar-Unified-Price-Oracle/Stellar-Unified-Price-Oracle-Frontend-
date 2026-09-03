import { validateEnv } from './validateEnv'

// Validate all environment variables once at module initialisation.
// The validator throws in development when required vars are missing,
// and logs a warning + uses defaults in production.
const env = validateEnv(import.meta.env as Record<string, string | undefined>)

export const config = {
  apiUrl: env.VITE_API_URL,
  wsUrl: env.VITE_WS_URL,
  openApiSpecUrl: env.VITE_OPENAPI_SPEC_URL,
  oracleNetwork: env.VITE_ORACLE_NETWORK,
  analyticsEndpoint: env.VITE_ANALYTICS_URL,
  useMock: env.VITE_USE_MOCK === 'true',
  logLevel: env.VITE_LOG_LEVEL,
  stellarNetwork: env.VITE_STELLAR_NETWORK,
  auth: {
    githubClientId: env.VITE_OAUTH_GITHUB_CLIENT_ID,
    googleClientId: env.VITE_OAUTH_GOOGLE_CLIENT_ID,
    // How often to silently re-check the session cookie is still valid (#501).
    sessionCheckIntervalMs: 5 * 60_000,
  },
  refreshInterval: 10_000,
  wsReconnectDelay: 3_000,
  wsBroadcastInterval: 5_000,
  retry: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    backoffMultiplier: 2,
    maxDelayMs: 30_000,
    jitter: true,
  },
  circuitBreaker: {
    failureThreshold: 5,
    windowMs: 30_000,
    cooldownMs: 30_000,
  },
  priceBatch: {
    /** Window in ms during which individual per-pair price requests are coalesced into one batch call. */
    debounceMs: 50,
    /** Maximum number of pairs sent in a single batched price request. */
    maxBatchSize: 20,
  },
} as const
