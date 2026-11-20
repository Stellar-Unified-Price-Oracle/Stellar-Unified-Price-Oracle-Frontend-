import { useEffect, useMemo, useState } from 'react';

interface DailyUsage {
  date: string;
  requests: number;
  clientErrors: number;
  serverErrors: number;
}

interface KeyUsage {
  keyId: string;
  label: string;
  requests: number;
  rateLimitHits: number;
}

interface UsageResponse {
  daily: DailyUsage[];
  keys: KeyUsage[];
}

// Mock data until the backend usage endpoint is available.
const MOCK_USAGE: UsageResponse = {
  daily: [
    { date: '2024-06-01', requests: 1240, clientErrors: 42, serverErrors: 6 },
    { date: '2024-06-02', requests: 1580, clientErrors: 55, serverErrors: 3 },
    { date: '2024-06-03', requests: 980, clientErrors: 31, serverErrors: 9 },
    { date: '2024-06-04', requests: 1720, clientErrors: 60, serverErrors: 4 },
    { date: '2024-06-05', requests: 2010, clientErrors: 74, serverErrors: 11 },
    { date: '2024-06-06', requests: 1450, clientErrors: 48, serverErrors: 2 },
    { date: '2024-06-07', requests: 1890, clientErrors: 66, serverErrors: 7 },
  ],
  keys: [
    { keyId: 'key_1', label: 'Production', requests: 6420, rateLimitHits: 18 },
    { keyId: 'key_2', label: 'Staging', requests: 2310, rateLimitHits: 4 },
    { keyId: 'key_3', label: 'Local dev', requests: 1140, rateLimitHits: 0 },
  ],
};

async function fetchUsage(): Promise<UsageResponse> {
  // TODO: replace with real usage endpoint once available.
  return MOCK_USAGE;
}

function RequestsPerDayChart({ daily }: { daily: DailyUsage[] }) {
  const max = Math.max(1, ...daily.map((d) => d.requests));
  return (
    <div className="usage-chart">
      <h3>Requests per day</h3>
      <div className="usage-bars">
        {daily.map((d) => (
          <div key={d.date} className="usage-bar-col" title={`${d.date}: ${d.requests}`}>
            <div
              className="usage-bar"
              style={{ height: `${(d.requests / max) * 100}%` }}
            />
            <span className="usage-bar-label">{d.date.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorSplitChart({ daily }: { daily: DailyUsage[] }) {
  const totals = daily.reduce(
    (acc, d) => {
      acc.client += d.clientErrors;
      acc.server += d.serverErrors;
      return acc;
    },
    { client: 0, server: 0 },
  );
  const total = totals.client + totals.server;
  const clientPct = total ? Math.round((totals.client / total) * 100) : 0;
  const serverPct = total ? 100 - clientPct : 0;

  return (
    <div className="usage-chart">
      <h3>Error split (4xx / 5xx)</h3>
      <div className="error-split">
        <div className="error-split-bar">
          <div className="error-split-4xx" style={{ width: `${clientPct}%` }} />
          <div className="error-split-5xx" style={{ width: `${serverPct}%` }} />
        </div>
        <ul className="error-split-legend">
          <li>
            <span className="legend-swatch legend-4xx" /> 4xx: {totals.client} ({clientPct}%)
          </li>
          <li>
            <span className="legend-swatch legend-5xx" /> 5xx: {totals.server} ({serverPct}%)
          </li>
        </ul>
      </div>
    </div>
  );
}

function RateLimitChart({ keys }: { keys: KeyUsage[] }) {
  const max = Math.max(1, ...keys.map((k) => k.rateLimitHits));
  return (
    <div className="usage-chart">
      <h3>Rate-limit hits per key</h3>
      <ul className="rate-limit-list">
        {keys.map((k) => (
          <li key={k.keyId} className="rate-limit-row">
            <span className="rate-limit-label">{k.label}</span>
            <div className="rate-limit-track">
              <div
                className="rate-limit-fill"
                style={{ width: `${(k.rateLimitHits / max) * 100}%` }}
              />
            </div>
            <span className="rate-limit-value">{k.rateLimitHits}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DeveloperDashboard() {
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchUsage()
      .then((data) => {
        if (!cancelled) setUsage(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load usage');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalRequests = useMemo(
    () => usage?.daily.reduce((sum, d) => sum + d.requests, 0) ?? 0,
    [usage],
  );

  if (loading) return <div className="developer-dashboard">Loading usage…</div>;
  if (error) return <div className="developer-dashboard">Error: {error}</div>;
  if (!usage) return <div className="developer-dashboard">No usage data.</div>;

  return (
    <div className="developer-dashboard">
      <header className="developer-dashboard-header">
        <h2>Developer usage</h2>
        <p className="developer-dashboard-total">Total requests: {totalRequests}</p>
      </header>
      <RequestsPerDayChart daily={usage.daily} />
      <ErrorSplitChart daily={usage.daily} />
      <RateLimitChart keys={usage.keys} />
    </div>
  );
}
