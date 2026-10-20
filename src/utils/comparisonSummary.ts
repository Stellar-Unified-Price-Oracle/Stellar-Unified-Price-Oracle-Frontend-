/**
 * Per-pair summary over a time window, shown before the overlay chart (#814).
 *
 * A reader can compare the summary rows to see which pairs moved most, and over
 * what range, before reading the lines on the chart. The window is inclusive at both
 * ends. Input order does not matter, since history is not guaranteed to be sorted.
 */
import type { PriceHistoryEntry } from '../types'

export interface PairRangeSummary {
  pair: string
  /** Number of finite price points inside the window. */
  points: number
  /** Timestamp of the earliest point in the window, or `null` when there are none. */
  from: number | null
  /** Timestamp of the latest point in the window, or `null` when there are none. */
  to: number | null
  firstPrice: number | null
  lastPrice: number | null
  /** Percentage change from the first to the last point. `null` when undefined (no points, or a zero start). */
  changePercent: number | null
  low: number | null
  high: number | null
}

/**
 * Summarises one pair's history inside `[start, end]`. Missing bounds are open.
 * Non-finite prices are ignored.
 */
export function summarizePairRange(
  pair: string,
  entries: readonly PriceHistoryEntry[],
  start: number = -Infinity,
  end: number = Infinity,
): PairRangeSummary {
  const inWindow = entries
    .filter((e) => Number.isFinite(e.price) && e.timestamp >= start && e.timestamp <= end)
    // Price breaks timestamp ties so the result does not depend on input order.
    .sort((a, b) => a.timestamp - b.timestamp || a.price - b.price)

  if (inWindow.length === 0) {
    return {
      pair,
      points: 0,
      from: null,
      to: null,
      firstPrice: null,
      lastPrice: null,
      changePercent: null,
      low: null,
      high: null,
    }
  }

  const first = inWindow[0]
  const last = inWindow[inWindow.length - 1]
  let low = first.price
  let high = first.price
  for (const e of inWindow) {
    if (e.price < low) low = e.price
    if (e.price > high) high = e.price
  }

  return {
    pair,
    points: inWindow.length,
    from: first.timestamp,
    to: last.timestamp,
    firstPrice: first.price,
    lastPrice: last.price,
    changePercent: first.price === 0 ? null : (last.price / first.price - 1) * 100,
    low,
    high,
  }
}

/** Summarises every pair in `pairs` over the same window, preserving pair order. */
export function summarizeSelection(
  pairs: readonly string[],
  history: Record<string, PriceHistoryEntry[]>,
  start?: number,
  end?: number,
): PairRangeSummary[] {
  return pairs.map((pair) => summarizePairRange(pair, history[pair] ?? [], start, end))
}
