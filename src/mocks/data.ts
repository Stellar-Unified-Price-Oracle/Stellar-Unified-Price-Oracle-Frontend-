import type { PriceData, PriceHistoryResponse } from '../types'

const PAIRS = ['XLM/USD', 'BTC/USD', 'ETH/USD', 'XRP/USD']
const SOURCES = ['chainlink', 'redstone', 'band', 'reflector']
const BASE_PRICES: Record<string, number> = {
  'XLM/USD': 0.12,
  'BTC/USD': 65000,
  'ETH/USD': 3200,
  'XRP/USD': 0.55,
}

function jitter(base: number, pct = 0.02) {
  return base * (1 + (Math.random() - 0.5) * pct * 2)
}

export function mockPrices(): PriceData[] {
  return PAIRS.map((assetPair) => ({
    assetPair,
    price: jitter(BASE_PRICES[assetPair] ?? 1),
    timestamp: Date.now() - Math.floor(Math.random() * 10_000),
    confidence: 0.9 + Math.random() * 0.1,
    sources: SOURCES.slice(0, 2 + Math.floor(Math.random() * 3)),
  }))
}

export function mockHistory(pair: string, length = 100): PriceHistoryResponse {
  const base = BASE_PRICES[pair] ?? 1
  const now = Date.now()
  return {
    pair,
    history: Array.from({ length }, (_, i) => ({
      price: jitter(base, 0.05),
      timestamp: now - (length - i) * 60_000,
      confidence: 0.85 + Math.random() * 0.15,
      sources: SOURCES.slice(0, 2 + Math.floor(Math.random() * 3)),
    })),
  }
}
