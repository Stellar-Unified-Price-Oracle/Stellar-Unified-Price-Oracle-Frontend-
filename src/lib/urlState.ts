export interface ChartUrlState {
  pair: string;
  range: string;
  overlays: string[];
  indicators: string[];
}

const PAIR_PARAM = 'pair';
const RANGE_PARAM = 'range';
const OVERLAYS_PARAM = 'overlays';
const INDICATORS_PARAM = 'indicators';

const DEFAULT_PAIR = 'XLM/USDC';
const DEFAULT_RANGE = '7d';

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function serializeList(values: string[]): string {
  return values.map((value) => value.trim()).filter((value) => value.length > 0).join(',');
}

/**
 * Read the chart state encoded in the current URL search params.
 * Falls back to sensible defaults when params are missing.
 */
export function readChartStateFromUrl(search?: string): ChartUrlState {
  const source = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const params = new URLSearchParams(source);

  return {
    pair: params.get(PAIR_PARAM) || DEFAULT_PAIR,
    range: params.get(RANGE_PARAM) || DEFAULT_RANGE,
    overlays: parseList(params.get(OVERLAYS_PARAM)),
    indicators: parseList(params.get(INDICATORS_PARAM)),
  };
}

/**
 * Build a URLSearchParams object that encodes the given chart state.
 * Empty overlays/indicators are omitted so the URL stays clean.
 */
export function buildChartSearchParams(state: ChartUrlState): URLSearchParams {
  const params = new URLSearchParams();
  params.set(PAIR_PARAM, state.pair);
  params.set(RANGE_PARAM, state.range);

  const overlays = serializeList(state.overlays);
  if (overlays) params.set(OVERLAYS_PARAM, overlays);

  const indicators = serializeList(state.indicators);
  if (indicators) params.set(INDICATORS_PARAM, indicators);

  return params;
}

/**
 * Produce a full URL string (path + encoded chart state) for sharing.
 */
export function buildChartUrl(state: ChartUrlState, baseUrl?: string): string {
  const base = baseUrl ?? (typeof window !== 'undefined' ? window.location.href : '');
  const url = new URL(base, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  url.search = buildChartSearchParams(state).toString();
  return url.toString();
}

/**
 * Write the chart state into the current URL without adding a history entry.
 */
export function syncChartStateToUrl(state: ChartUrlState): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.search = buildChartSearchParams(state).toString();
  window.history.replaceState(window.history.state, '', url.toString());
}
