import { useCallback, useEffect, useRef, useState } from 'react';
import type { PriceData, PriceDataState } from '../types/price';
import { fetchPriceData } from '../lib/api';
import { normalizeError } from '../lib/errors';

const DEFAULT_REFRESH_INTERVAL_MS = 30_000;

/**
 * Marks the moment the price panel first renders *useful* data
 * (a successful, non-empty price payload) rather than merely first paint.
 *
 * The measurement is emitted once per mount via `performance.mark` so it can be
 * consumed by the PerformanceObserver / web-vitals tooling without coupling the
 * hook to a specific analytics backend. If the Performance API is unavailable
 * the call is a no-op.
 */
const USEFUL_PRICE_PANEL_MARK = 'price-panel:useful';

function markUsefulPricePanel(): void {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') {
    return;
  }
  try {
    performance.mark(USEFUL_PRICE_PANEL_MARK);
  } catch {
    // Marking is best-effort telemetry; never break rendering over it.
  }
}

function hasUsefulData(data: PriceData | null): data is PriceData {
  if (!data) {
    return false;
  }
  const prices = data.prices;
  return Array.isArray(prices) && prices.length > 0;
}

export interface UsePriceDataOptions {
  refreshIntervalMs?: number;
  enabled?: boolean;
}

export interface UsePriceDataResult extends PriceDataState {
  refresh: () => void;
}

export function usePriceData(options: UsePriceDataOptions = {}): UsePriceDataResult {
  const { refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS, enabled = true } = options;

  const [state, setState] = useState<PriceDataState>({
    data: null,
    isLoading: enabled,
    error: null,
    lastUpdated: null,
  });

  const mountedRef = useRef(true);
  const usefulMarkedRef = useRef(false);
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    setState((prev) => ({ ...prev, isLoading: prev.data === null, error: null }));

    try {
      const data = await fetchPriceData();
      if (!mountedRef.current) {
        return;
      }
      setState({
        data,
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
      });

      // Only mark once the panel actually has something useful to show.
      if (!usefulMarkedRef.current && hasUsefulData(data)) {
        usefulMarkedRef.current = true;
        markUsefulPricePanel();
      }
    } catch (err) {
      if (!mountedRef.current) {
        return;
      }
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: normalizeError(err),
      }));
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    void load();
    const interval = window.setInterval(() => {
      void load();
    }, refreshIntervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [enabled, load, refreshIntervalMs]);

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  return { ...state, refresh };
}

export { USEFUL_PRICE_PANEL_MARK };
