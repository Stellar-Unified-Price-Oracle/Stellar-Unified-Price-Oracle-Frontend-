import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type ChartRange = '1h' | '24h' | '7d' | '30d' | '90d' | '1y' | 'all';

export interface ChartState {
  pair: string;
  range: ChartRange;
  overlays: string[];
  indicators: string[];
}

const DEFAULT_STATE: ChartState = {
  pair: 'XLM/USDC',
  range: '7d',
  overlays: [],
  indicators: [],
};

const VALID_RANGES: ChartRange[] = ['1h', '24h', '7d', '30d', '90d', '1y', 'all'];

const PARAM_PAIR = 'pair';
const PARAM_RANGE = 'range';
const PARAM_OVERLAYS = 'overlays';
const PARAM_INDICATORS = 'indicators';

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function isChartRange(value: string | null): value is ChartRange {
  return value !== null && (VALID_RANGES as string[]).includes(value);
}

function readStateFromUrl(): ChartState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  const params = new URLSearchParams(window.location.search);
  const pair = params.get(PARAM_PAIR);
  const range = params.get(PARAM_RANGE);
  return {
    pair: pair && pair.length > 0 ? pair : DEFAULT_STATE.pair,
    range: isChartRange(range) ? range : DEFAULT_STATE.range,
    overlays: parseList(params.get(PARAM_OVERLAYS)),
    indicators: parseList(params.get(PARAM_INDICATORS)),
  };
}

function writeStateToUrl(state: ChartState): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);

  if (state.pair && state.pair !== DEFAULT_STATE.pair) {
    params.set(PARAM_PAIR, state.pair);
  } else {
    params.delete(PARAM_PAIR);
  }

  if (state.range !== DEFAULT_STATE.range) {
    params.set(PARAM_RANGE, state.range);
  } else {
    params.delete(PARAM_RANGE);
  }

  if (state.overlays.length > 0) {
    params.set(PARAM_OVERLAYS, state.overlays.join(','));
  } else {
    params.delete(PARAM_OVERLAYS);
  }

  if (state.indicators.length > 0) {
    params.set(PARAM_INDICATORS, state.indicators.join(','));
  } else {
    params.delete(PARAM_INDICATORS);
  }

  const search = params.toString();
  const nextUrl = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

function toggleItem(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];
}

export interface UseChartStateResult {
  state: ChartState;
  setPair: (pair: string) => void;
  setRange: (range: ChartRange) => void;
  toggleOverlay: (overlay: string) => void;
  toggleIndicator: (indicator: string) => void;
  setOverlays: (overlays: string[]) => void;
  setIndicators: (indicators: string[]) => void;
}

export function useChartState(): UseChartStateResult {
  const [state, setState] = useState<ChartState>(() => readStateFromUrl());
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      writeStateToUrl(state);
      return;
    }
    writeStateToUrl(state);
  }, [state]);

  useEffect(() => {
    const handlePopState = () => {
      setState(readStateFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setPair = useCallback((pair: string) => {
    setState((prev) => ({ ...prev, pair }));
  }, []);

  const setRange = useCallback((range: ChartRange) => {
    setState((prev) => ({ ...prev, range }));
  }, []);

  const toggleOverlay = useCallback((overlay: string) => {
    setState((prev) => ({ ...prev, overlays: toggleItem(prev.overlays, overlay) }));
  }, []);

  const toggleIndicator = useCallback((indicator: string) => {
    setState((prev) => ({ ...prev, indicators: toggleItem(prev.indicators, indicator) }));
  }, []);

  const setOverlays = useCallback((overlays: string[]) => {
    setState((prev) => ({ ...prev, overlays }));
  }, []);

  const setIndicators = useCallback((indicators: string[]) => {
    setState((prev) => ({ ...prev, indicators }));
  }, []);

  return useMemo(
    () => ({ state, setPair, setRange, toggleOverlay, toggleIndicator, setOverlays, setIndicators }),
    [state, setPair, setRange, toggleOverlay, toggleIndicator, setOverlays, setIndicators],
  );
}
