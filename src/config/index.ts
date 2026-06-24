export const config = {
  apiUrl: import.meta.env.VITE_API_URL || '/api',
  wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:3000',
  refreshInterval: 10_000,
  wsReconnectDelay: 3_000,
  wsBroadcastInterval: 5_000,
  analyticsEndpoint: import.meta.env.VITE_ANALYTICS_URL ?? '',
  // Retry configuration for REST API calls (issue #53)
  retry: {
    /** Maximum number of attempts (initial + retries). Default: 3 */
    maxAttempts: 3,
    /** Base delay in milliseconds for exponential backoff. Default: 1000 (1s). */
    baseDelayMs: 1000,
    /** Multiplier applied for each subsequent attempt. Default: 2 → 1s, 2s, 4s, 8s. */
    backoffMultiplier: 2,
    /** Cap on a single backoff delay. Default: 30000 (30s). */
    maxDelayMs: 30_000,
    /** Apply full jitter (AWS recommendation) to prevent thundering herd. */
    jitter: true,
  },
} as const
