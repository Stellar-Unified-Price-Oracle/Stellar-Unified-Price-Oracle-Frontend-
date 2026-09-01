import type { PriceData, PriceHistoryResponse, PriceProof } from '../types'
import { VALID_PAIRS } from '../types'
import type { OnChainPriceRecord, OracleNetwork } from '../types/onchain'
import { getContractRegistryEntry } from '../lib/contractRegistry'

const SOURCES = ['chainlink', 'redstone', 'band', 'reflector'] as const

function randomPrice(base: number) {
  return +(base * (0.98 + Math.random() * 0.04)).toFixed(6)
}

const BASE_PRICES: Record<string, number> = {
  'XLM/USD': 0.12,
  'BTC/USD': 65000,
  'ETH/USD': 3200,
  'USDC/USD': 1.0,
}

export function mockPriceData(pair = 'XLM/USD'): PriceData {
  return {
    assetPair: pair,
    price: randomPrice(BASE_PRICES[pair] ?? 1),
    timestamp: Date.now(),
    confidence: 0.92 + Math.random() * 0.08,
    sources: SOURCES.slice(0, 2 + Math.floor(Math.random() * 3)),
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
  const publishDelayMs = 15_000 + Math.random() * 4 * 60_000
  mockLedger += 1 + Math.floor(Math.random() * 3)

  return {
    asset: entry.asset,
    network: entry.network,
    contractId: entry.contractId,
    price: randomPrice(base),
    publishedAt: Date.now() - publishDelayMs,
    ledger: mockLedger,
  }
}

export function mockHistory(pair: string, count = 100): PriceHistoryResponse {
  const base = BASE_PRICES[pair] ?? 1
  const now = Date.now()
  return {
    pair,
    history: Array.from({ length: count }, (_, i) => ({
      price: randomPrice(base),
      timestamp: now - (count - i) * 60_000,
      confidence: 0.9 + Math.random() * 0.1,
      sources: SOURCES.slice(0, 2),
    })),
  }
}
