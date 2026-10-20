/**
 * Mobile Device Tier Dashboard Interaction Benchmark Harness (#862).
 *
 * Provides deterministic, reproducible latency benchmarks for key dashboard
 * interactions measured against the documented Tier-2 Mobile Reference profile.
 */

import {
  type InteractionBenchmarkId,
  type BenchmarkStatus,
  type BenchmarkResult,
  type MobileBenchmarkSuiteSummary,
  type MobileDeviceTier,
  TIER_2_MOBILE_REFERENCE,
  MOBILE_BENCHMARK_BUDGETS,
} from '../types/mobileBenchmarks'
import type { PriceData } from '../types/price'
import type { GovernanceEvent } from '../types/governanceEvents'
import type { OperatorDisclosure } from '../types/operatorDisclosures'
import { governanceEventsToCsv, governanceEventsToJson } from '../utils/governanceEvents'
import { filterDisclosures } from '../utils/operatorDisclosures'

// ---------------------------------------------------------------------------
// Synthetic Data Generators for Repeatable Benchmarking
// ---------------------------------------------------------------------------

const SOURCES = ['chainlink', 'band', 'dia', 'pyth', 'redstone'] as const

/** Generates N deterministic price feeds for feed search and filtering. */
export function generateSyntheticFeeds(count = 250): PriceData[] {
  const assets = ['XLM', 'BTC', 'ETH', 'USDC', 'EURC', 'SOL', 'AAVE', 'LINK', 'UNI', 'ALGO', 'ADA', 'DOT']
  const quotes = ['USD', 'EUR', 'XLM', 'USDC']
  const feeds: PriceData[] = []

  for (let i = 0; i < count; i++) {
    const base = assets[i % assets.length]
    const quote = quotes[Math.floor(i / assets.length) % quotes.length]
    const pair = `${base}-${i}/${quote}`
    const price = (100 + (i * 37) % 50000) / 10
    const confidence = 0.8 + ((i % 20) / 100)
    const activeSources = [
      SOURCES[i % SOURCES.length],
      SOURCES[(i + 1) % SOURCES.length],
      SOURCES[(i + 2) % SOURCES.length],
    ]

    feeds.push({
      assetPair: pair,
      price,
      timestamp: 1772000000000 - (i % 60) * 1000,
      confidence,
      sources: activeSources,
    })
  }

  return feeds
}

/** Generates historical tick datapoints for timeframe calculations. */
export function generateSyntheticHistory(count = 1000): Array<{ timestamp: number; price: number; volume: number }> {
  const points: Array<{ timestamp: number; price: number; volume: number }> = []
  let currentPrice = 125.5
  const baseTime = 1772000000000 - count * 60000

  for (let i = 0; i < count; i++) {
    const delta = ((i * 13) % 21 - 10) * 0.15
    currentPrice = Math.max(10, currentPrice + delta)
    points.push({
      timestamp: baseTime + i * 60000,
      price: currentPrice,
      volume: 1000 + ((i * 47) % 5000),
    })
  }

  return points
}

/** Generates synthetic governance events for export serialization. */
export function generateSyntheticGovernanceEvents(count = 500): GovernanceEvent[] {
  const types: GovernanceEvent['eventType'][] = [
    'proposal_created',
    'vote_cast',
    'proposal_passed',
    'proposal_executed',
    'parameter_updated',
    'dispute_opened',
  ]
  const roles: GovernanceEvent['actorRole'][] = ['admin', 'proposer', 'voter', 'operator', 'auditor']

  return Array.from({ length: count }, (_, i) => ({
    id: `GEV-BENCH-1772000000000-${String(i + 1).padStart(3, '0')}`,
    eventType: types[i % types.length],
    timestamp: 1772000000000 + i * 120000,
    actorAddress: 'GAADMIN7777777777777777777777777777777777777777777777777',
    actorRole: roles[i % roles.length],
    targetEntityId: `ENTITY-${(i % 50) + 1}`,
    description: `Automated test benchmark event record #${i + 1} with metadata payload.`,
    network: i % 2 === 0 ? 'testnet' : 'mainnet',
    txHash: `txhash_${i}_abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789`,
  }))
}

/** Generates synthetic operator disclosures for multi-facet filtering. */
export function generateSyntheticDisclosures(count = 100): OperatorDisclosure[] {
  const categories: OperatorDisclosure['category'][] = [
    'liquidity_provider',
    'validator_operator',
    'token_holder',
    'protocol_advisor',
    'lending_market_maker',
  ]
  const materialities: OperatorDisclosure['materiality'][] = ['high', 'medium', 'low']
  const statuses: OperatorDisclosure['provenance']['status'][] = ['verified', 'unverified', 'expired']

  return Array.from({ length: count }, (_, i) => ({
    id: `DISC-BENCH-${i + 1}`,
    operatorName: `Oracle Operator ${i + 1}`,
    stellarAddress: 'GCHAI777777777777777777777777777777777777777777777777777',
    organization: `Organization ${String.fromCharCode(65 + (i % 26))}`,
    category: categories[i % categories.length],
    materiality: materialities[i % materialities.length],
    affectedPairs: ['XLM/USD', 'EURC/USD', 'BTC/USD'],
    description: `Operator disclosure test payload #${i + 1}`,
    provenance: {
      attestationHash: `hash_${i}_0123456789abcdef0123456789abcdef0123456789abcdef0123456789`,
      signedBy: 'GCHAI777777777777777777777777777777777777777777777777777',
      provenanceUrl: 'https://stellar.expert',
      status: statuses[i % statuses.length],
      timestamp: 1772000000000 + i * 3600000,
      method: 'on_chain_attestation',
    },
    updatedAt: 1772000000000 + i * 3600000,
  }))
}

// ---------------------------------------------------------------------------
// Statistical Calculations
// ---------------------------------------------------------------------------

export function calculatePercentile(values: readonly number[], percentile: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = (percentile / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index - lower
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

export function evaluateBenchmarkStatus(
  p95Ms: number,
  targetBudgetMs: number,
  warnBudgetMs: number,
): BenchmarkStatus {
  if (p95Ms <= targetBudgetMs) return 'pass'
  if (p95Ms <= warnBudgetMs) return 'warn'
  return 'fail'
}

// ---------------------------------------------------------------------------
// High-Resolution Interaction Timing Harness
// ---------------------------------------------------------------------------

export interface MeasureOptions {
  readonly iterations?: number
  readonly warmup?: number
  readonly cpuSlowdownFactor?: number
  readonly simulatedThrottling?: boolean
}

/**
 * Executes an interaction benchmark over multiple iterations and computes
 * statistics against the Tier-2 Mobile reference profile.
 */
export function measureInteraction(
  id: InteractionBenchmarkId,
  interactionFn: () => void,
  options: MeasureOptions = {},
): BenchmarkResult {
  const budget = MOBILE_BENCHMARK_BUDGETS[id]
  const iterations = Math.max(1, options.iterations ?? 10)
  const warmup = Math.max(0, options.warmup ?? 2)
  const slowdown = options.simulatedThrottling !== false ? (options.cpuSlowdownFactor ?? TIER_2_MOBILE_REFERENCE.cpuSlowdownFactor) : 1

  // Warmup cycles to allow V8 JIT optimization
  for (let w = 0; w < warmup; w++) {
    interactionFn()
  }

  const samples: number[] = []

  for (let i = 0; i < iterations; i++) {
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now()
    interactionFn()
    const end = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const elapsed = Math.max(0.01, end - start)
    // Scale by mobile CPU throttling factor to represent Tier-2 mobile SoC
    samples.push(elapsed * slowdown)
  }

  const minMs = Math.min(...samples)
  const maxMs = Math.max(...samples)
  const meanMs = samples.reduce((acc, v) => acc + v, 0) / samples.length
  const medianMs = calculatePercentile(samples, 50)
  const p95Ms = calculatePercentile(samples, 95)
  const status = evaluateBenchmarkStatus(p95Ms, budget.targetBudgetMs, budget.warnBudgetMs)

  return {
    id,
    name: budget.name,
    description: budget.description,
    iterations,
    minMs: Number(minMs.toFixed(2)),
    maxMs: Number(maxMs.toFixed(2)),
    meanMs: Number(meanMs.toFixed(2)),
    medianMs: Number(medianMs.toFixed(2)),
    p95Ms: Number(p95Ms.toFixed(2)),
    budgetMs: budget.targetBudgetMs,
    warnBudgetMs: budget.warnBudgetMs,
    status,
    timestamp: Date.now(),
  }
}

// ---------------------------------------------------------------------------
// Specific Dashboard Interaction Benchmarks
// ---------------------------------------------------------------------------

/**
 * 1. Timeframe & Interval Switch Benchmark
 * Computes OHLC candles, SMA-20, EMA-12, and volatility bands across 1,000 points.
 */
export function benchmarkTimeframeSwitch(options?: MeasureOptions): BenchmarkResult {
  const history = generateSyntheticHistory(1000)

  return measureInteraction(
    'timeframe_switch',
    () => {
      // 1. Resample into 15-minute candles
      const candleIntervalMs = 15 * 60 * 1000
      const candles: Array<{ open: number; high: number; low: number; close: number; volume: number }> = []
      let currentCandle: { open: number; high: number; low: number; close: number; volume: number } | null = null
      let bucketStart = 0

      for (const pt of history) {
        const bucket = Math.floor(pt.timestamp / candleIntervalMs) * candleIntervalMs
        if (!currentCandle || bucket !== bucketStart) {
          if (currentCandle) candles.push(currentCandle)
          bucketStart = bucket
          currentCandle = { open: pt.price, high: pt.price, low: pt.price, close: pt.price, volume: pt.volume }
        } else {
          currentCandle.high = Math.max(currentCandle.high, pt.price)
          currentCandle.low = Math.min(currentCandle.low, pt.price)
          currentCandle.close = pt.price
          currentCandle.volume += pt.volume
        }
      }
      if (currentCandle) candles.push(currentCandle)

      // 2. Compute 20-period Moving Average
      const smaPeriod = 20
      const sma: number[] = []
      for (let i = 0; i <= candles.length - smaPeriod; i++) {
        let sum = 0
        for (let j = 0; j < smaPeriod; j++) {
          sum += candles[i + j].close
        }
        sma.push(sum / smaPeriod)
      }

      // 3. Compute EMA-12
      const k = 2 / (12 + 1)
      let ema = candles[0]?.close ?? 0
      for (let i = 1; i < candles.length; i++) {
        ema = candles[i].close * k + ema * (1 - k)
      }
    },
    options,
  )
}

/**
 * 2. Feed / Pair Selection Benchmark
 * Filters feed state, computes median aggregation across 5 sources, and extracts history.
 */
export function benchmarkPairSelection(options?: MeasureOptions): BenchmarkResult {
  const feeds = generateSyntheticFeeds(300)
  const targetPair = 'XLM-10/USD'

  return measureInteraction(
    'pair_selection',
    () => {
      // Find selected feed
      const selected = feeds.find((f) => f.assetPair === targetPair) ?? feeds[0]

      // Simulate source consensus calculation (median + deviation)
      const sourcePrices = selected.sources.map((src, idx) => ({
        source: src,
        price: selected.price * (1 + ((idx - 1) * 0.002)),
        weight: 1 / selected.sources.length,
      }))

      const sorted = [...sourcePrices].sort((a, b) => a.price - b.price)
      const mid = Math.floor(sorted.length / 2)
      const median = sorted.length % 2 === 0 ? (sorted[mid - 1].price + sorted[mid].price) / 2 : sorted[mid].price

      const deviations = sourcePrices.map((s) => Math.abs(s.price - median) / median)
      const maxDeviation = Math.max(...deviations)

      // Derive confidence flag
      const isConsistent = maxDeviation < 0.02
      void isConsistent
    },
    options,
  )
}

/**
 * 3. Feed Search & Multi-Facet Filter Benchmark
 * Filters 250+ live oracle feeds across search queries, provider lists, and confidence limits.
 */
export function benchmarkFeedFilterSearch(options?: MeasureOptions): BenchmarkResult {
  const feeds = generateSyntheticFeeds(350)
  const searchTerms = ['XLM', 'USD', 'chainlink', 'ETH', '0.9']

  return measureInteraction(
    'feed_filter_search',
    () => {
      for (const query of searchTerms) {
        const lower = query.toLowerCase()
        const filtered = feeds.filter((item) => {
          const matchesQuery =
            item.assetPair.toLowerCase().includes(lower) ||
            item.sources.some((s) => s.toLowerCase().includes(lower))
          const matchesConfidence = item.confidence >= 0.85
          return matchesQuery && matchesConfidence
        })
        void filtered.length
      }
    },
    options,
  )
}

/**
 * 4. Governance Audit Export Serialization Benchmark
 * Serializes 500+ immutable governance events into both CSV and JSON formats.
 */
export function benchmarkGovernanceExportSerialization(options?: MeasureOptions): BenchmarkResult {
  const events = generateSyntheticGovernanceEvents(500)

  return measureInteraction(
    'governance_export_serialization',
    () => {
      const csv = governanceEventsToCsv(events)
      const json = governanceEventsToJson(events)
      void csv.length
      void json.length
    },
    options,
  )
}

/**
 * 5. Operator Disclosures Filter Evaluation Benchmark
 * Evaluates multi-category materiality and provenance status across 100+ disclosures.
 */
export function benchmarkConflictDisclosuresFilter(options?: MeasureOptions): BenchmarkResult {
  const disclosures = generateSyntheticDisclosures(120)

  return measureInteraction(
    'conflict_disclosures_filter',
    () => {
      const res1 = filterDisclosures(disclosures, {
        category: 'liquidity_provider',
        materiality: 'high',
      })
      const res2 = filterDisclosures(disclosures, {
        provenanceStatus: 'verified',
        searchQuery: 'Oracle',
      })
      const res3 = filterDisclosures(disclosures, {
        materiality: 'medium',
        assetPair: 'XLM/USD',
      })
      void (res1.length + res2.length + res3.length)
    },
    options,
  )
}

// ---------------------------------------------------------------------------
// Full Suite Execution & Summary Aggregation
// ---------------------------------------------------------------------------

export interface SuiteRunOptions extends MeasureOptions {
  readonly tier?: MobileDeviceTier
}

/**
 * Executes all 5 key interaction benchmarks and compiles a complete suite summary.
 */
export function runAllMobileBenchmarks(options: SuiteRunOptions = {}): MobileBenchmarkSuiteSummary {
  const tier = options.tier ?? TIER_2_MOBILE_REFERENCE

  const results: BenchmarkResult[] = [
    benchmarkTimeframeSwitch(options),
    benchmarkPairSelection(options),
    benchmarkFeedFilterSearch(options),
    benchmarkGovernanceExportSerialization(options),
    benchmarkConflictDisclosuresFilter(options),
  ]

  const passed = results.filter((r) => r.status === 'pass').length
  const warned = results.filter((r) => r.status === 'warn').length
  const failed = results.filter((r) => r.status === 'fail').length

  let overallStatus: BenchmarkStatus = 'pass'
  if (failed > 0) {
    overallStatus = 'fail'
  } else if (warned > 0) {
    overallStatus = 'warn'
  }

  return {
    tier,
    executedAt: new Date().toISOString(),
    totalBenchmarks: results.length,
    passed,
    warned,
    failed,
    overallStatus,
    results,
  }
}

/** Serializes suite summary to audit-ready JSON. */
export function benchmarkSummaryToJson(summary: MobileBenchmarkSuiteSummary): string {
  return JSON.stringify(summary, null, 2)
}
