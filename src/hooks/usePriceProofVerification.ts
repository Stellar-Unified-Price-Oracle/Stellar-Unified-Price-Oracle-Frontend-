import { useCallback, useEffect, useRef, useState } from 'react';
import { useTimeSeriesStore } from '../stores/timeSeriesStore';

export interface VerifiedProof {
  id: string;
  pair: string;
  ledger: number;
  result: 'valid' | 'invalid' | 'error';
  verifiedAt: number;
}

export interface PriceProofVerificationState {
  history: VerifiedProof[];
  isVerifying: boolean;
  error: string | null;
}

const HISTORY_SERIES = 'price-proof-verification-history';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function usePriceProofVerification() {
  const [state, setState] = useState<PriceProofVerificationState>({
    history: [],
    isVerifying: false,
    error: null,
  });
  const loadedRef = useRef(false);

  const store = useTimeSeriesStore();

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const points = await store.getSeries(HISTORY_SERIES);
        if (cancelled) return;
        const history = (points ?? [])
          .map((point) => point.value as VerifiedProof)
          .filter((entry): entry is VerifiedProof => Boolean(entry && entry.id));
        setState((prev) => ({ ...prev, history }));
      } catch (err) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to load verification history',
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [store]);

  const recordVerifiedProof = useCallback(
    async (proof: Omit<VerifiedProof, 'id' | 'verifiedAt'>) => {
      const entry: VerifiedProof = {
        ...proof,
        id: generateId(),
        verifiedAt: Date.now(),
      };

      setState((prev) => ({ ...prev, history: [entry, ...prev.history] }));

      try {
        await store.appendPoint(HISTORY_SERIES, entry.verifiedAt, entry);
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to persist verified proof',
        }));
      }

      return entry;
    },
    [store],
  );

  const exportHistory = useCallback(() => {
    const payload = JSON.stringify(state.history, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `price-proof-verification-history-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [state.history]);

  return {
    ...state,
    recordVerifiedProof,
    exportHistory,
  };
}
