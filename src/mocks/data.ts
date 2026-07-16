import type { PriceData, PriceHistoryResponse } from '../types'

const PAIRS = ['XLM/USD', 'BTC/USD', 'ETH/USD', 'USDC/USD']
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
  return PAIRS.map(mockPriceData)
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

export { PAIRS }
