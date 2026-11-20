import { useEffect, useMemo, useState } from 'react';

export interface UsageDayPoint {
  date: string;
  requests: number;
  clientErrors: number;
  serverErrors: number;
}

export interface ApiKeyUsage {
  keyId: string;
  label: string;
  rateLimitHits: number;
}

export interface DeveloperUsageResponse {
  days: UsageDayPoint[];
  keys: ApiKeyUsage[];
}

const USAGE_ENDPOINT = '/api/developer/usage';

const MOCK_USAGE: DeveloperUsageResponse = {
  days: [
    { date: '2024-06-01', requests: 1240, clientErrors: 42, serverErrors: 3 },
    { date: '2024-06-02', requests: 1580, clientErrors: 61, serverErrors: 5 },
    { date: '2024-06-03', requests: 980, clientErrors: 28, serverErrors: 1 },
    { date: '2024-06-04', requests: 1720, clientErrors: 74, serverErrors: 8 },
    { date: '2024-06-05', requests: 2010, clientErrors: 55, serverErrors: 4 },
    { date: '2024-06-06', requests: 1490, clientErrors: 39, serverErrors: 2 },
    { date: '2024-06-07', requests: 1130, clientErrors: 33, serverErrors: 6 },
  ],
  keys: [
    { keyId: 'key_live_1', label: 'Production', rateLimitHits: 12 },
    { keyId: 'key_live_2', label: 'Staging', rateLimitHits: 4 },
    { keyId: 'key_test_1', label: 'Local dev', rateLimitHits: 0 },
  ],
};

function formatDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function DeveloperUsageDashboard() {
  const [usage, setUsage] = useState<DeveloperUsageResponse>(MOCK_USAGE);
  const [loading, setLoading] = useState(false);
  const [usingMocks, setUsingMocks] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(USAGE_ENDPOINT)
      .then((res) => {
        if (!res.ok) throw new Error(`Usage endpoint returned ${res.status}`);
        return res.json() as Promise<DeveloperUsageResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        setUsage(data);
        setUsingMocks(false);
      })
      .catch(() => {
        if (cancelled) return;
        setUsage(MOCK_USAGE);
        setUsingMocks(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const maxRequests = useMemo(
    () => Math.max(1, ...usage.days.map((d) => d.requests)),
    [usage.days],
  );

  const totals = useMemo(() => {
    return usage.days.reduce(
      (acc, day) => {
        acc.requests += day.requests;
        acc.clientErrors += day.clientErrors;
        acc.serverErrors += day.serverErrors;
        return acc;
      },
      { requests: 0, clientErrors: 0, serverErrors: 0 },
    );
  }, [usage.days]);

  const totalErrors = totals.clientErrors + totals.serverErrors;
  const clientErrorPct = totalErrors > 0 ? (totals.clientErrors / totalErrors) * 100 : 0;
  const serverErrorPct = totalErrors > 0 ? (totals.serverErrors / totalErrors) * 100 : 0;

  return (
    <section className="developer-usage-dashboard">
      <header className="developer-usage-dashboard__header">
        <h2>API usage</h2>
        {usingMocks && (
          <span className="developer-usage-dashboard__badge" title="Backend usage endpoint not available yet">
            Sample data
          </span>
        )}
      </header>

      {loading && <p className="developer-usage-dashboard__loading">Loading usage…</p>}

      <div className="developer-usage-dashboard__summary">
        <div className="developer-usage-dashboard__stat">
          <span className="developer-usage-dashboard__stat-label">Requests</span>
          <span className="developer-usage-dashboard__stat-value">{totals.requests.toLocaleString()}</span>
        </div>
        <div className="developer-usage-dashboard__stat">
          <span className="developer-usage-dashboard__stat-label">4xx errors</span>
          <span className="developer-usage-dashboard__stat-value">{totals.clientErrors.toLocaleString()}</span>
        </div>
        <div className="developer-usage-dashboard__stat">
          <span className="developer-usage-dashboard__stat-label">5xx errors</span>
          <span className="developer-usage-dashboard__stat-value">{totals.serverErrors.toLocaleString()}</span>
        </div>
      </div>

      <div className="developer-usage-dashboard__chart">
        <h3>Requests per day</h3>
        <ul className="developer-usage-dashboard__bars">
          {usage.days.map((day) => (
            <li key={day.date} className="developer-usage-dashboard__bar-row">
              <span className="developer-usage-dashboard__bar-label">{formatDate(day.date)}</span>
              <span className="developer-usage-dashboard__bar-track">
                <span
                  className="developer-usage-dashboard__bar"
                  style={{ width: `${(day.requests / maxRequests) * 100}%` }}
                  title={`${day.requests.toLocaleString()} requests`}
                />
              </span>
              <span className="developer-usage-dashboard__bar-value">{day.requests.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="developer-usage-dashboard__errors">
        <h3>Error split</h3>
        {totalErrors === 0 ? (
          <p className="developer-usage-dashboard__empty">No errors recorded.</p>
        ) : (
          <>
            <div className="developer-usage-dashboard__split" role="img" aria-label={`4xx ${clientErrorPct.toFixed(0)}%, 5xx ${serverErrorPct.toFixed(0)}%`}>
              <span className="developer-usage-dashboard__split-4xx" style={{ width: `${clientErrorPct}%` }} />
              <span className="developer-usage-dashboard__split-5xx" style={{ width: `${serverErrorPct}%` }} />
            </div>
            <ul className="developer-usage-dashboard__legend">
              <li>
                <span className="developer-usage-dashboard__legend-swatch developer-usage-dashboard__legend-swatch--4xx" />
                4xx: {totals.clientErrors.toLocaleString()} ({clientErrorPct.toFixed(0)}%)
              </li>
              <li>
                <span className="developer-usage-dashboard__legend-swatch developer-usage-dashboard__legend-swatch--5xx" />
                5xx: {totals.serverErrors.toLocaleString()} ({serverErrorPct.toFixed(0)}%)
              </li>
            </ul>
          </>
        )}
      </div>

      <div className="developer-usage-dashboard__rate-limits">
        <h3>Rate-limit hits per key</h3>
        {usage.keys.length === 0 ? (
          <p className="developer-usage-dashboard__empty">No API keys.</p>
        ) : (
          <table className="developer-usage-dashboard__table">
            <thead>
              <tr>
                <th scope="col">Key</th>
                <th scope="col">Rate-limit hits</th>
              </tr>
            </thead>
            <tbody>
              {usage.keys.map((key) => (
                <tr key={key.keyId}>
                  <td>{key.label}</td>
                  <td>{key.rateLimitHits.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
