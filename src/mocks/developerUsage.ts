// Mock data for the developer usage dashboard (issue #1021).
// Replace with the real usage endpoint once the backend ships.

export interface DailyRequestPoint {
  /** ISO date (YYYY-MM-DD) */
  date: string;
  requests: number;
  errors4xx: number;
  errors5xx: number;
}

export interface ApiKeyRateLimitHits {
  keyId: string;
  /** Masked key label, e.g. "sk_live_…a1b2" */
  label: string;
  rateLimitHits: number;
}

export interface DeveloperUsage {
  requestsPerDay: DailyRequestPoint[];
  rateLimitHitsPerKey: ApiKeyRateLimitHits[];
}

/**
 * Shape returned by the (pending) usage endpoint.
 * The dashboard should render from this so swapping mocks for the real
 * endpoint is a one-line change.
 */
export const mockDeveloperUsage: DeveloperUsage = {
  requestsPerDay: [
    { date: "2024-05-01", requests: 1240, errors4xx: 38, errors5xx: 4 },
    { date: "2024-05-02", requests: 1580, errors4xx: 52, errors5xx: 7 },
    { date: "2024-05-03", requests: 1420, errors4xx: 41, errors5xx: 2 },
    { date: "2024-05-04", requests: 980, errors4xx: 22, errors5xx: 1 },
    { date: "2024-05-05", requests: 760, errors4xx: 15, errors5xx: 0 },
    { date: "2024-05-06", requests: 1890, errors4xx: 63, errors5xx: 9 },
    { date: "2024-05-07", requests: 2110, errors4xx: 71, errors5xx: 5 },
  ],
  rateLimitHitsPerKey: [
    { keyId: "key_1", label: "sk_live_…a1b2", rateLimitHits: 12 },
    { keyId: "key_2", label: "sk_live_…c3d4", rateLimitHits: 3 },
    { keyId: "key_3", label: "sk_test_…e5f6", rateLimitHits: 0 },
  ],
};

/** Total 4xx/5xx split across the window, for the error-rate summary. */
export function summarizeErrorSplit(usage: DeveloperUsage): {
  errors4xx: number;
  errors5xx: number;
} {
  return usage.requestsPerDay.reduce(
    (acc, point) => ({
      errors4xx: acc.errors4xx + point.errors4xx,
      errors5xx: acc.errors5xx + point.errors5xx,
    }),
    { errors4xx: 0, errors5xx: 0 },
  );
}
