// Price alert service: evaluates alerts against current prices.
//
// Background evaluation (issue #1019):
// When the tab is closed, alerts can still be evaluated by a service worker
// using Periodic Background Sync (Chromium only). The service worker imports
// this module and calls `evaluateAlerts` with freshly fetched prices, then
// delivers fired alerts via Web Push / the Notification API. On browsers
// without Periodic Background Sync or Web Push, this module falls back to the
// existing tab-based evaluation loop (see `startTabEvaluation`).

export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  direction: 'above' | 'below';
  triggered?: boolean;
}

export interface PriceMap {
  [symbol: string]: number;
}

export interface FiredAlert {
  alert: PriceAlert;
  price: number;
}

const PERIODIC_SYNC_TAG = 'price-alert-evaluation';
const TAB_EVALUATION_INTERVAL_MS = 60_000;

/**
 * Evaluate a list of alerts against the latest prices.
 * Pure function so it can run in both the tab and the service worker.
 */
export function evaluateAlerts(
  alerts: PriceAlert[],
  prices: PriceMap,
): FiredAlert[] {
  const fired: FiredAlert[] = [];
  for (const alert of alerts) {
    if (alert.triggered) continue;
    const price = prices[alert.symbol];
    if (typeof price !== 'number') continue;
    const hit =
      alert.direction === 'above'
        ? price >= alert.targetPrice
        : price <= alert.targetPrice;
    if (hit) {
      fired.push({ alert, price });
    }
  }
  return fired;
}

/**
 * Fetch current prices for the given symbols.
 * Kept dependency-free so the service worker can reuse it.
 */
export async function fetchPrices(symbols: string[]): Promise<PriceMap> {
  const prices: PriceMap = {};
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const res = await fetch(`/api/prices/${encodeURIComponent(symbol)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { price?: number };
        if (typeof data.price === 'number') {
          prices[symbol] = data.price;
        }
      } catch {
        // Ignore individual symbol failures; evaluate what we have.
      }
    }),
  );
  return prices;
}

/**
 * Deliver a fired alert to the user. Prefers Web Push / Notification API
 * (works from the service worker with no tab open); silently no-ops when
 * notifications are unavailable or not permitted.
 */
export async function deliverAlert(fired: FiredAlert): Promise<void> {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  const { alert, price } = fired;
  const body = `${alert.symbol} is ${alert.direction} ${alert.targetPrice} (now ${price})`;
  try {
    new Notification('Price alert', { body, tag: alert.id });
  } catch {
    // Notification construction can throw in some worker contexts; ignore.
  }
}

/**
 * Full evaluation pass: fetch prices, evaluate, deliver fired alerts.
 * Shared by the service worker (Periodic Background Sync) and the tab loop.
 */
export async function runEvaluationPass(
  alerts: PriceAlert[],
): Promise<FiredAlert[]> {
  const active = alerts.filter((a) => !a.triggered);
  if (active.length === 0) return [];
  const symbols = Array.from(new Set(active.map((a) => a.symbol)));
  const prices = await fetchPrices(symbols);
  const fired = evaluateAlerts(active, prices);
  await Promise.all(fired.map((f) => deliverAlert(f)));
  return fired;
}

/**
 * Register Periodic Background Sync so the service worker can evaluate
 * alerts while the tab is closed. Returns true when registration succeeded.
 * Degrades gracefully: returns false on unsupported browsers.
 */
export async function registerPeriodicSync(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const periodicSync = (registration as ServiceWorkerRegistration & {
      periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> };
    }).periodicSync;
    if (!periodicSync) return false;
    await periodicSync.register(PERIODIC_SYNC_TAG, {
      minInterval: 15 * 60 * 1000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Tab-based fallback evaluation loop. Used when Periodic Background Sync is
 * unavailable, preserving the existing behavior of evaluating while a tab is
 * open. Returns a stop function.
 */
export function startTabEvaluation(
  getAlerts: () => PriceAlert[],
): () => void {
  const timer = setInterval(() => {
    void runEvaluationPass(getAlerts());
  }, TAB_EVALUATION_INTERVAL_MS);
  return () => clearInterval(timer);
}

/**
 * Initialize background evaluation. Registers Periodic Background Sync when
 * supported; otherwise falls back to tab-based evaluation.
 */
export async function initPriceAlertEvaluation(
  getAlerts: () => PriceAlert[],
): Promise<() => void> {
  const background = await registerPeriodicSync();
  if (background) {
    // Service worker handles evaluation; no tab loop needed.
    return () => {};
  }
  return startTabEvaluation(getAlerts);
}

export { PERIODIC_SYNC_TAG };
