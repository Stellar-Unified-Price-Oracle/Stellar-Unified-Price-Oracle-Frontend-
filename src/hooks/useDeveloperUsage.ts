import { useCallback, useEffect, useMemo, useState } from 'react';

export interface DailyRequestPoint {
  date: string;
  requests: number;
  errors4xx: number;
  errors5xx: number;
}

export interface ApiKeyUsage {
  keyId: string;
  label: string;
  requests: number;
  rateLimitHits: number;
}

export interface DeveloperUsage {
  daily: DailyRequestPoint[];
  perKey: ApiKeyUsage[];
}

export interface DeveloperUsageState {
  data: DeveloperUsage | null;
  loading: boolean;
  error: string | null;
  isMock: boolean;
  refetch: () => void;
}

const USAGE_ENDPOINT = '/api/developer/usage';

function buildMockUsage(): DeveloperUsage {
  const today = new Date();
  const daily: DailyRequestPoint[] = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (13 - i));
    const requests = 400 + Math.round(Math.sin(i / 2) * 120) + i * 25;
    const errors4xx = Math.round(requests * 0.06);
    const errors5xx = Math.round(requests * 0.015);
    return {
      date: d.toISOString().slice(0, 10),
      requests,
      errors4xx,
      errors5xx,
    };
  });

  const perKey: ApiKeyUsage[] = [
    { keyId: 'key_live_1', label: 'Production', requests: 4820, rateLimitHits: 37 },
    { keyId: 'key_live_2', label: 'Staging', requests: 1290, rateLimitHits: 12 },
    { keyId: 'key_test_1', label: 'Local dev', requests: 640, rateLimitHits: 3 },
  ];

  return { daily, perKey };
}

function isDeveloperUsage(value: unknown): value is DeveloperUsage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DeveloperUsage>;
  return Array.isArray(candidate.daily) && Array.isArray(candidate.perKey);
}

export function useDeveloperUsage(): DeveloperUsageState {
  const [data, setData] = useState<DeveloperUsage | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isMock, setIsMock] = useState<boolean>(false);
  const [reloadToken, setReloadToken] = useState<number>(0);

  const refetch = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(USAGE_ENDPOINT, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          throw new Error(`Usage endpoint responded with ${response.status}`);
        }
        const payload: unknown = await response.json();
        if (!isDeveloperUsage(payload)) {
          throw new Error('Unexpected usage payload shape');
        }
        if (cancelled) return;
        setData(payload);
        setIsMock(false);
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        // Backend endpoint is pending; fall back to mocks so the dashboard renders.
        setData(buildMockUsage());
        setIsMock(true);
        setError(err instanceof Error ? err.message : 'Failed to load usage');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reloadToken]);

  return useMemo(
    () => ({ data, loading, error, isMock, refetch }),
    [data, loading, error, isMock, refetch],
  );
}

export default useDeveloperUsage;
