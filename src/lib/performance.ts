/**
 * Performance instrumentation for the price panel.
 *
 * Initial page paint is not a useful signal for this app: the panel is only
 * useful once it has rendered a price (fresh or explicitly stale). These
 * helpers measure "time to useful price panel" so we can track the metric
 * that actually reflects user value.
 */

export type PricePanelStatus =
  | "idle"
  | "loading"
  | "ready"
  | "stale"
  | "unavailable"
  | "error";

/** Statuses that mean the panel is showing something a user can act on. */
const USEFUL_STATUSES: ReadonlySet<PricePanelStatus> = new Set([
  "ready",
  "stale",
]);

export function isUsefulPricePanelStatus(status: PricePanelStatus): boolean {
  return USEFUL_STATUSES.has(status);
}

/**
 * Marks the moment the app started working toward a useful price panel.
 * Falls back to `performance.timeOrigin` when available so the measurement
 * is anchored to navigation start rather than module evaluation order.
 */
export function markPricePanelStart(): void {
  if (typeof performance === "undefined" || !performance.mark) return;
  try {
    performance.mark("price-panel:start");
  } catch {
    // Marking is best-effort; never break rendering over instrumentation.
  }
}

/**
 * Records the time from `price-panel:start` to the first useful price panel
 * render. Safe to call multiple times: only the first useful render is kept.
 * Returns the measured duration in milliseconds, or `null` when it could not
 * be measured (unsupported environment or missing start mark).
 */
export function markPricePanelUseful(): number | null {
  if (typeof performance === "undefined" || !performance.mark) return null;
  try {
    if (performance.getEntriesByName("price-panel:useful", "mark").length > 0) {
      return null;
    }
    performance.mark("price-panel:useful");
    const measure = performance.measure(
      "price-panel:time-to-useful",
      "price-panel:start",
      "price-panel:useful",
    );
    return measure.duration;
  } catch {
    return null;
  }
}

/**
 * Convenience wrapper: call on every status change and it will record the
 * time-to-useful metric exactly once, when the panel first becomes useful.
 */
export function reportPricePanelStatus(status: PricePanelStatus): number | null {
  if (!isUsefulPricePanelStatus(status)) return null;
  return markPricePanelUseful();
}
