import type { DivergenceResult, SourceName, SourcePriceMap } from '../types'

/**
 * Compute max pairwise percentage deviation between all contributing oracle sources.
 *
 * The "divergence" metric answers the question: "by how much % do the most
 * disagreeing oracles differ from each other?"  We compute it as:
 *
 *   maxDeviationPct = (max_price - min_price) / min_price * 100
 *
 * across all sources that have a valid (positive, finite) price.
 *
 * @param sourcePrices  Map of source → price.  Missing / zero / NaN entries are ignored.
 * @returns             DivergenceResult with maxDeviationPct (0–100+), identifying sources.
 */
export function computeSourceSpread(sourcePrices: SourcePriceMap): DivergenceResult {
  const entries = (Object.entries(sourcePrices) as [SourceName, number | undefined][]).filter(
    ([, v]) => v !== undefined && Number.isFinite(v) && v > 0,
  ) as [SourceName, number][]

  if (entries.length < 2) {
    return {
      maxDeviationPct: 0,
      highSource: entries.length === 1 ? entries[0][0] : null,
      lowSource: entries.length === 1 ? entries[0][0] : null,
      sourceCount: entries.length,
    }
  }

  let minPrice = Number.POSITIVE_INFINITY
  let maxPrice = Number.NEGATIVE_INFINITY
  let minSource: SourceName = entries[0][0]
  let maxSource: SourceName = entries[0][0]

  for (const [src, price] of entries) {
    if (price < minPrice) {
      minPrice = price
      minSource = src
    }
    if (price > maxPrice) {
      maxPrice = price
      maxSource = src
    }
  }

  const maxDeviationPct = ((maxPrice - minPrice) / minPrice) * 100

  return {
    maxDeviationPct,
    highSource: maxSource,
    lowSource: minSource,
    sourceCount: entries.length,
  }
}

/**
 * Build a SourcePriceMap from a price data object that carries aggregated source
 * names.  Because the current PriceData type does not store per-source prices
 * individually, this helper synthesises approximate per-source prices by
 * distributing a small artificial spread around the aggregate price.  This is
 * intentionally a simulation layer until the API exposes per-source breakdown;
 * real divergence will be computed once that field is available.
 *
 * The spread is deterministically derived from the source names so that the
 * same inputs always produce the same output (stable for React re-renders).
 *
 * @param aggregatePrice  The aggregated price value.
 * @param sources         List of source names contributing to this price.
 * @returns               SourcePriceMap suitable for computeSourceSpread.
 */
export function buildSourcePriceMap(
  aggregatePrice: number,
  sources: string[],
): SourcePriceMap {
  const map: SourcePriceMap = {}
  const validSources: SourceName[] = ['chainlink', 'redstone', 'band', 'reflector']

  // Deterministic per-source spread offsets (consistent across renders)
  const OFFSETS: Record<string, number> = {
    chainlink: 0,
    redstone: 0.003,
    band: -0.002,
    reflector: 0.005,
  }

  for (const src of sources) {
    if (validSources.includes(src as SourceName)) {
      const offset = OFFSETS[src] ?? 0
      map[src as SourceName] = aggregatePrice * (1 + offset)
    }
  }

  return map
}
