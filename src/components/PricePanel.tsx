import { useEffect, useRef, useState } from 'react';

/**
 * PricePanel
 *
 * Renders the current price for a Stellar asset and reports how long it takes
 * until the panel shows *useful* data (a real price), not merely until the
 * first paint. The measurement is emitted through the optional
 * `onUsefulData` callback so callers can wire it into their analytics without
 * coupling this component to a specific telemetry backend.
 *
 * Data contract (dependency): the upstream price API must return either a
 * numeric `price` or an explicit `stale`/`unavailable` marker. We never
 * fabricate a price when the upstream value is missing.
 */

export type PriceStatus = 'loading' | 'ready' | 'stale' | 'unavailable' | 'error';

export interface PriceData {
  price: number | null;
  /** ISO timestamp of when the upstream price was last updated. */
  updatedAt?: string | null;
  /** Upstream flag indicating the value is stale. */
  stale?: boolean;
}

export interface PricePanelProps {
  /** Asset symbol shown in the panel heading. */
  symbol: string;
  /** Fetches the latest price. Rejecting surfaces the error state. */
  fetchPrice: () => Promise<PriceData>;
  /**
   * Called once, the first time the panel renders useful (non-stale, numeric)
   * price data. Receives the elapsed time in milliseconds since mount.
   */
  onUsefulData?: (elapsedMs: number) => void;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  }).format(price);
}

export function PricePanel({ symbol, fetchPrice, onUsefulData }: PricePanelProps) {
  const [status, setStatus] = useState<PriceStatus>('loading');
  const [data, setData] = useState<PriceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mountedAtRef = useRef<number>(Date.now());
  const reportedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    mountedAtRef.current = Date.now();
    reportedRef.current = false;

    setStatus('loading');
    setError(null);

    fetchPrice()
      .then((result) => {
        if (cancelled) return;
        setData(result);

        if (result.price === null || result.price === undefined) {
          setStatus('unavailable');
          return;
        }

        if (result.stale) {
          setStatus('stale');
          return;
        }

        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to load price');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [fetchPrice]);

  // Report time-to-useful-data exactly once, when a real price is shown.
  useEffect(() => {
    if (status !== 'ready' || reportedRef.current) return;
    reportedRef.current = true;
    onUsefulData?.(Date.now() - mountedAtRef.current);
  }, [status, onUsefulData]);

  const hasPrice = data?.price !== null && data?.price !== undefined;

  return (
    <section
      className="price-panel"
      aria-labelledby="price-panel-heading"
      aria-busy={status === 'loading'}
      data-status={status}
    >
      <h2 id="price-panel-heading" className="price-panel__heading">
        {symbol} price
      </h2>

      {status === 'loading' && (
        <p className="price-panel__loading" role="status" aria-live="polite">
          Loading price…
        </p>
      )}

      {status === 'error' && (
        <p className="price-panel__error" role="alert">
          {error ?? 'Unable to load price'}
        </p>
      )}

      {status === 'unavailable' && (
        <p className="price-panel__unavailable" role="status" aria-live="polite">
          Price unavailable
        </p>
      )}

      {(status === 'ready' || status === 'stale') && hasPrice && (
        <div className="price-panel__value">
          <span className="price-panel__price" aria-live="polite">
            {formatPrice(data!.price as number)}
          </span>
          {status === 'stale' && (
            <span className="price-panel__stale-badge" role="status">
              Stale{data?.updatedAt ? ` · updated ${data.updatedAt}` : ''}
            </span>
          )}
        </div>
      )}
    </section>
  );
}

export default PricePanel;
