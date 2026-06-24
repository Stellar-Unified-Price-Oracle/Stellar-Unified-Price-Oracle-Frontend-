import type { PriceData, PriceHistoryEntry, PriceHistoryResponse } from '../types'

export const PAIRS = ['BTC/USD', 'ETH/USD', 'XLM/USD', 'SOL/USD', 'USDC/USD']

export const SOURCES = ['chainlink', 'redstone', 'band', 'reflector']

export const BASE_PRICES: Record<string, number> = {
  'BTC/USD': 67000,
  'ETH/USD': 3500,
  'XLM/USD': 0.12,
  'SOL/USD': 175,
  'USDC/USD': 1.0,
}

const rand = (min: number, max: number) => Math.random() * (max - min) + min

const randomSources = () => {
  const shuffled = [...SOURCES].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.floor(rand(2, 5)))
}

export const makePriceData = (pair: string): PriceData => {
  const base = BASE_PRICES[pair] ?? 1
  return {
    assetPair: pair,
    price: base * (1 + rand(-0.02, 0.02)),
    timestamp: Date.now(),
    confidence: rand(0.85, 0.99),
    sources: randomSources(),
  }
}

export const makeHistoryEntry = (basePrice: number): PriceHistoryEntry => ({
  price: basePrice * (1 + rand(-0.05, 0.05)),
  timestamp: 0, // set by caller
  confidence: rand(0.85, 0.99),
  sources: randomSources(),
})

export const makeHistory = (pair: string, limit = 100): PriceHistoryResponse => {
  const base = BASE_PRICES[pair] ?? 1
  const now = Date.now()
  const history: PriceHistoryEntry[] = Array.from({ length: limit }, (_, i) => ({
    ...makeHistoryEntry(base),
    timestamp: now - (limit - 1 - i) * 60_000,
  })).reverse()
  return { pair, history }
}
