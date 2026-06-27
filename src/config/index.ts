export const config = {
  apiUrl: import.meta.env.VITE_API_URL || '/api',
  wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:3000',
  openApiSpecUrl: import.meta.env.VITE_OPENAPI_SPEC_URL || '',
  analyticsEndpoint: import.meta.env.VITE_ANALYTICS_ENDPOINT || '',
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
} as const
