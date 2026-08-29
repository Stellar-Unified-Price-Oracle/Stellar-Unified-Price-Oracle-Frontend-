import { useEffect, useMemo, useRef } from 'react'
import type { PriceData } from '../types'

/** localStorage key holding the per-pair rolling price-sample history (#476). */
const HISTORY_KEY = 'stellar-oracle:market-overview-history:v1'
/** How far back we keep samples for the 24h change/high/low computation. */
const WINDOW_MS = 24 * 60 * 60 * 1000
/** Minimum spacing between persisted samples for a given pair, to bound storage growth. */
const SAMPLE_INTERVAL_MS = 60_000
/** Tolerance used to decide whether the current price counts as "at" the tracked high/low. */
const NEAR_EXTREME_EPSILON = 0.001
/** Fraction of pairs surfaced by each click-to-filter tile (e.g. bottom quartile). */
const FILTER_FRACTION = 0.25

interface HistorySample {
  t: number
  price: number
}

type HistoryStore = Record<string, HistorySample[]>

/** Keys identifying which market-overview tile a filter was activated from. */
export type OverviewFilterKey = 'movers' | 'atHigh' | 'atLow' | 'lowConfidence' | 'stale'

export const OVERVIEW_FILTER_KEYS: readonly OverviewFilterKey[] = [
  'movers',
  'atHigh',
  'atLow',
  'lowConfidence',
  'stale',
]

export function isOverviewFilterKey(value: string | null): value is OverviewFilterKey {
  return value != null && (OVERVIEW_FILTER_KEYS as readonly string[]).includes(value)
}

/** Aggregated market-level statistics derived from the live price list. */
export interface MarketOverviewStats {
  /** Average percentage change across pairs vs. their oldest tracked sample, or null with no history yet. */
  changePct: number | null
  /** True while less than a full 24h of history has been collected (change reflects "since tracking started"). */
  changeSinceSessionOnly: boolean
  /** Highest current price among tracked pairs, or null if empty. */
  highPrice: number | null
  /** Lowest current price among tracked pairs, or null if empty. */
  lowPrice: number | null
  /** Number of pairs currently at (or within epsilon of) their tracked-window high. */
  highCount: number
  /** Number of pairs currently at (or within epsilon of) their tracked-window low. */
  lowCount: number
  /** Mean confidence (0..1) across all tracked pairs, or null if empty. */
  avgConfidence: number | null
  /** Mean time-since-last-update in milliseconds across all tracked pairs, or null if empty. */
  avgFreshnessMs: number | null
  /** Asset pairs represented by each clickable tile, used to drive the grid filter. */
  pairsByFilter: Record<OverviewFilterKey, string[]>
}

function loadHistory(): HistoryStore {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as HistoryStore) : {}
  } catch {
    return {}
  }
}

function saveHistory(store: HistoryStore): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(store))
  } catch {
    // Storage unavailable/full — in-memory tracking for this session still works.
  }
}

function pruneAndAppend(existing: HistorySample[], sample: HistorySample): HistorySample[] {
  const cutoff = sample.t - WINDOW_MS
  const pruned = existing.filter((s) => s.t >= cutoff)
  const last = pruned[pruned.length - 1]
  if (last && sample.t - last.t < SAMPLE_INTERVAL_MS) {
    // Too soon since the last sample — only return a new array if pruning actually dropped something.
    return pruned.length === existing.length ? existing : pruned
  }
  return [...pruned, sample]
}

/** Selects the bottom/top fraction of `items` ranked by `metric`, at least `min` when any qualify. */
function selectExtremeFraction<T>(
  items: T[],
  metric: (item: T) => number,
  direction: 'lowest' | 'highest',
  min = 1,
): T[] {
  if (items.length === 0) return []
  const sorted = [...items].sort((a, b) =>
    direction === 'lowest' ? metric(a) - metric(b) : metric(b) - metric(a),
  )
  const count = Math.max(Math.min(min, sorted.length), Math.ceil(sorted.length * FILTER_FRACTION))
  return sorted.slice(0, count)
}

function computeStats(prices: PriceData[], history: HistoryStore): MarketOverviewStats {
  const empty: MarketOverviewStats = {
    changePct: null,
    changeSinceSessionOnly: true,
    highPrice: null,
    lowPrice: null,
    highCount: 0,
    lowCount: 0,
    avgConfidence: null,
    avgFreshnessMs: null,
    pairsByFilter: { movers: [], atHigh: [], atLow: [], lowConfidence: [], stale: [] },
  }
  if (prices.length === 0) return empty

  const now = Date.now()
  let confSum = 0
  let freshSum = 0
  let pctSum = 0
  let pctCount = 0
  let sessionOnly = false
  let highPrice = -Infinity
  let lowPrice = Infinity
  const atHigh: string[] = []
  const atLow: string[] = []
  const changeEntries: Array<{ pair: string; pct: number }> = []

  for (const p of prices) {
    confSum += p.confidence
    freshSum += Math.max(0, now - p.timestamp)
    if (p.price > highPrice) highPrice = p.price
    if (p.price < lowPrice) lowPrice = p.price

    const samples = history[p.assetPair]
    if (samples && samples.length > 0) {
      const baseline = samples[0]
      if (now - baseline.t < WINDOW_MS - SAMPLE_INTERVAL_MS) sessionOnly = true
      if (baseline.price > 0) {
        const pct = ((p.price - baseline.price) / baseline.price) * 100
        pctSum += pct
        pctCount += 1
        changeEntries.push({ pair: p.assetPair, pct })
      }

      let sampleMax = p.price
      let sampleMin = p.price
      for (const s of samples) {
        if (s.price > sampleMax) sampleMax = s.price
        if (s.price < sampleMin) sampleMin = s.price
      }
      if (sampleMax > 0 && p.price >= sampleMax * (1 - NEAR_EXTREME_EPSILON)) atHigh.push(p.assetPair)
      if (sampleMin > 0 && p.price <= sampleMin * (1 + NEAR_EXTREME_EPSILON)) atLow.push(p.assetPair)
    }
  }

  const movers = selectExtremeFraction(changeEntries, (e) => Math.abs(e.pct), 'highest', Math.min(3, changeEntries.length)).map(
    (e) => e.pair,
  )
  const lowConfidence = selectExtremeFraction(prices, (p) => p.confidence, 'lowest', Math.min(3, prices.length)).map(
    (p) => p.assetPair,
  )
  const stale = selectExtremeFraction(prices, (p) => now - p.timestamp, 'highest', Math.min(3, prices.length)).map(
    (p) => p.assetPair,
  )

  return {
    changePct: pctCount > 0 ? pctSum / pctCount : null,
    changeSinceSessionOnly: sessionOnly || pctCount === 0,
    highPrice,
    lowPrice,
    highCount: atHigh.length,
    lowCount: atLow.length,
    avgConfidence: confSum / prices.length,
    avgFreshnessMs: freshSum / prices.length,
    pairsByFilter: {
      movers,
      atHigh,
      atLow,
      lowConfidence,
      stale,
    },
  }
}

/**
 * Derives market-level overview statistics (24h change, high/low, avg confidence,
 * avg freshness) directly from the live price list, recomputing on every update
 * so the stats row reflects WebSocket ticks in real time (#476).
 *
 * A small rolling per-pair price history is kept (in memory, throttled to
 * localStorage) to support the 24h change/high/low figures; this is bounded and
 * pruned on every update so it never grows unbounded.
 */
export function useMarketOverviewStats(prices: PriceData[]): MarketOverviewStats {
  const historyRef = useRef<HistoryStore | null>(null)
  if (historyRef.current === null) {
    historyRef.current = loadHistory()
  }
  const lastPersistRef = useRef(0)

  useEffect(() => {
    if (prices.length === 0) return
    const store = historyRef.current!
    const now = Date.now()
    let changed = false
    for (const p of prices) {
      const existing = store[p.assetPair] ?? []
      const next = pruneAndAppend(existing, { t: p.timestamp, price: p.price })
      if (next !== existing) {
        store[p.assetPair] = next
        changed = true
      }
    }
    if (changed && now - lastPersistRef.current > SAMPLE_INTERVAL_MS) {
      lastPersistRef.current = now
      saveHistory(store)
    }
  }, [prices])

   
  return useMemo(() => computeStats(prices, historyRef.current!), [prices])
}
