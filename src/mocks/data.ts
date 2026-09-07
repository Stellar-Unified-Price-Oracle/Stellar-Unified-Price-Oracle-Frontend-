import type { PriceData, PriceHistoryResponse, PriceProof } from '../types'
import { VALID_PAIRS } from '../types'
import type { AggregationBreakdown, AggregationMode } from '../types/price'
import type { OnChainPriceRecord, OracleNetwork } from '../types/onchain'
import { getContractRegistryEntry } from '../lib/contractRegistry'

const SOURCES = ['chainlink', 'redstone', 'band', 'reflector'] as const

// Deterministic per-pair fixtures: prices/confidence/sources are fixed so the
// mock build is stable across runs. Random values made E2E assertions and
// visual-regression screenshots non-reproducible.
const BASE_PRICES: Record<string, number> = {
  'XLM/USD': 0.12,
  'BTC/USD': 65000,
  'ETH/USD': 3200,
  'USDC/USD': 1.0,
}

const CONFIDENCE: Record<string, number> = {
  'XLM/USD': 0.97,
  'BTC/USD': 0.988,
  'ETH/USD': 0.95,
  'USDC/USD': 0.96,
}

const PAIR_SOURCES: Record<string, readonly string[]> = {
  'XLM/USD': ['chainlink', 'redstone', 'band'],
  'BTC/USD': ['chainlink', 'redstone'],
  'ETH/USD': ['band', 'reflector'],
  'USDC/USD': ['chainlink'],
}

/** Small deterministic per-pair price offset so sources/history vary slightly. */
function stablePrice(base: number, seed: number): number {
  return +(base * (1 + (((seed * 37) % 40) - 20) / 1000)).toFixed(6)
}

/** Mock pair for the default XLM/USD case to satisfy tree-shaking imports. */
export function mockPriceData(pair = 'XLM/USD'): PriceData {
  const seed = pair.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return {
    assetPair: pair,
    price: stablePrice(BASE_PRICES[pair] ?? 1, seed),
    timestamp: Date.now(),
    confidence: CONFIDENCE[pair] ?? 0.95,
    sources: [...(PAIR_SOURCES[pair] ?? SOURCES.slice(0, 2))],
  }
}

export function mockAllPrices(): PriceData[] {
  return VALID_PAIRS.map(mockPriceData)
}

/** Off-chain base price for a feed's base asset code, e.g. `XLM` → 0.12. Mirrors {@link BASE_PRICES}. */
const BASE_PRICES_BY_ASSET: Record<string, number> = {
  XLM: 0.12,
  BTC: 65000,
  ETH: 3200,
  USDC: 1.0,
}

let mockLedger = 52_000_000

/**
 * Simulates the latest price a Soroban oracle contract has published on-chain.
 *
 * Deliberately drifts from the off-chain price by a few basis points and lags
 * behind it by a random publish delay, so the divergence panel has something
 * real to compare against. Throws whatever {@link getContractRegistryEntry}
 * throws for an asset/network with no registered contract.
 */
export function mockOnChainPrice(network: OracleNetwork, asset: string): OnChainPriceRecord {
  const entry = getContractRegistryEntry(network, asset)
  const base = BASE_PRICES_BY_ASSET[entry.asset] ?? 1
  const publishDelayMs = 15_000 + 90_000 // deterministic
  const seed = asset.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 7)
  mockLedger += 2

  return {
    asset: entry.asset,
    network: entry.network,
    contractId: entry.contractId,
    price: stablePrice(base, seed),
    publishedAt: Date.now() - publishDelayMs,
    ledger: mockLedger,
  }
}

/**
 * Simulates the on-chain price-proof payload returned by
 * `GET /api/prices/:pair/proof` (see {@link PriceProof}). Returns `null` for
 * unknown pairs so MSW handlers can respond 404 like the real backend does.
 */
export function mockPriceProof(pair: string, timestamp: number | undefined = Date.now()): PriceProof | null {
  const base = BASE_PRICES[pair]
  if (!base) return null
  const ts = timestamp ?? Date.now()
  const seed = pair.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 11)
  const price = stablePrice(base, seed)
  const record = mockOnChainPrice('testnet', pair.split('/')[0] ?? pair)
  return {
    record: {
      assetPair: pair,
      price,
      priceScaled: String(Math.round(price * 1e7)),
      priceDecimals: 7,
      timestamp: ts,
      confidence: 0.94,
      sources: [...SOURCES.slice(0, 3)],
      version: record.ledger,
    },
    contributions: SOURCES.slice(0, 3).map((source, i) => ({
      source,
      price: price * (1 + (i - 1) * 0.001),
      timestamp: ts,
      signature: `deadbeef${i}`.padEnd(64, '0'),
      publicKey: 'G'.padEnd(56, 'A'),
    })),
    aggregateSignature: '0'.repeat(128),
    contractId: record.contractId,
    ledgerSequence: record.ledger,
    transactionHash: '0'.repeat(64),
    network: 'testnet',
  }
}

export function mockHistory(pair: string, count = 100): PriceHistoryResponse {
  const base = BASE_PRICES[pair] ?? 1
  const now = Date.now()
  const seed = pair.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return {
    pair,
    history: Array.from({ length: count }, (_, i) => ({
      // Deterministic gentle drift around the base price so charts and
      // assertions are reproducible across runs.
      price: +(base * (1 + (((seed + i) % 40) - 20) / 1000)).toFixed(6),
      timestamp: now - (count - i) * 60_000,
      confidence: 0.94,
      sources: [...(PAIR_SOURCES[pair] ?? SOURCES.slice(0, 2))],
    })),
  }
}

/**
 * Derives a deterministic {@link AggregationBreakdown} from a {@link PriceData}
 * snapshot (#459).
 *
 * Since the REST API does not expose per-source prices or weights, this
 * function synthesises realistic values:
 * - Each source receives a price that varies from the aggregate by ±2 %.
 * - Weights are equal across all active sources (1 / n each), mirroring the
 *   oracle's default weighted-mean algorithm.
 * - When `mode === 'outlier_excluded'` the source whose synthesised price
 *   deviates most from the mean is flagged as excluded and given zero weight.
 *
 * @param data   The aggregated price snapshot to expand.
 * @param mode   Aggregation mode to simulate. Defaults to `'weighted_mean'`.
 */
export function computeAggregationBreakdown(
  data: PriceData,
  mode: AggregationMode = 'weighted_mean',
): AggregationBreakdown {
  const { assetPair, price: aggregatePrice, sources } = data
  const n = sources.length

  // Synthesise per-source prices with a small seeded variance so the values
  // are stable across re-renders for the same snapshot.
  const sourcePrices = sources.map((src, i) => {
    // Use a simple deterministic hash of the source name + index for variance.
    const hash = src.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), i * 31)
    const variance = ((hash % 400) - 200) / 10_000 // –2 % to +2 %
    return aggregatePrice * (1 + variance)
  })

  const params: Record<string, unknown> = {}
  let excluded: boolean[] = sources.map(() => false)

  if (mode === 'outlier_excluded') {
    // z-score threshold: exclude the source furthest from the mean when its
    // deviation exceeds the threshold.
    const zScoreThreshold = 1.5
    params['zScoreThreshold'] = zScoreThreshold
    const mean = sourcePrices.reduce((s, p) => s + p, 0) / n
    const stdDev = Math.sqrt(sourcePrices.reduce((s, p) => s + (p - mean) ** 2, 0) / n)
    if (stdDev > 0) {
      const zScores = sourcePrices.map((p) => Math.abs((p - mean) / stdDev))
      const maxZ = Math.max(...zScores)
      if (maxZ > zScoreThreshold) {
        const maxIdx = zScores.indexOf(maxZ)
        excluded = sources.map((_, i) => i === maxIdx)
      }
    }
  }

  const activeCount = excluded.filter((e) => !e).length || 1
  const equalWeight = 1 / activeCount

  const items = sources.map((src, i) => ({
    source: src,
    price: sourcePrices[i],
    weight: excluded[i] ? 0 : equalWeight,
    contribution: excluded[i] ? 0 : sourcePrices[i] * equalWeight,
    excluded: excluded[i],
  }))

  // Sort descending by weight (excluded items last).
  items.sort((a, b) => b.weight - a.weight)

  return {
    assetPair,
    mode,
    params,
    sources: items,
    aggregatePrice,
  }
}
