/**
 * Mobile Device Tier and Dashboard Interaction Benchmark Types (#862).
 */

export type InteractionBenchmarkId =
  | 'timeframe_switch'
  | 'pair_selection'
  | 'feed_filter_search'
  | 'governance_export_serialization'
  | 'conflict_disclosures_filter'

export type BenchmarkStatus = 'pass' | 'warn' | 'fail'

export interface MobileDeviceTier {
  readonly tierId: 'tier-2-mobile' | 'tier-1-mobile' | 'desktop-baseline'
  readonly name: string
  readonly deviceModel: string
  readonly cpuSlowdownFactor: number
  readonly memoryBudgetMb: number
  readonly networkProfile: string
  readonly viewport: {
    readonly width: number
    readonly height: number
  }
  readonly notes: string
}

export interface BenchmarkInteractionBudget {
  readonly id: InteractionBenchmarkId
  readonly name: string
  readonly description: string
  readonly targetBudgetMs: number
  readonly warnBudgetMs: number
}

export interface BenchmarkResult {
  readonly id: InteractionBenchmarkId
  readonly name: string
  readonly description: string
  readonly iterations: number
  readonly minMs: number
  readonly maxMs: number
  readonly meanMs: number
  readonly medianMs: number
  readonly p95Ms: number
  readonly budgetMs: number
  readonly warnBudgetMs: number
  readonly status: BenchmarkStatus
  readonly timestamp: number
  readonly memoryUsageMb?: number
}

export interface MobileBenchmarkSuiteSummary {
  readonly tier: MobileDeviceTier
  readonly executedAt: string
  readonly totalBenchmarks: number
  readonly passed: number
  readonly warned: number
  readonly failed: number
  readonly overallStatus: BenchmarkStatus
  readonly results: readonly BenchmarkResult[]
}

/** Standard Tier-2 Mobile Reference Profile (Lighthouse & W3C mobile baseline). */
export const TIER_2_MOBILE_REFERENCE: MobileDeviceTier = {
  tierId: 'tier-2-mobile',
  name: 'Tier-2 Mobile Reference',
  deviceModel: 'Moto G4 / Snapdragon 617-class SoC',
  cpuSlowdownFactor: 4,
  memoryBudgetMb: 64,
  networkProfile: 'Fast 3G (1.6 Mbps down, 750 kbps up, 150 ms RTT)',
  viewport: {
    width: 360,
    height: 640,
  },
  notes: 'Represents 50th-75th percentile global mobile user hardware constraints.',
}

/** Documented SLA latency budgets for key dashboard interactions. */
export const MOBILE_BENCHMARK_BUDGETS: Record<InteractionBenchmarkId, BenchmarkInteractionBudget> = {
  timeframe_switch: {
    id: 'timeframe_switch',
    name: 'Timeframe & Interval Switch',
    description: 'Calculates price aggregation, candles, and moving statistics across 1,000 historical datapoints.',
    targetBudgetMs: 100,
    warnBudgetMs: 150,
  },
  pair_selection: {
    id: 'pair_selection',
    name: 'Feed / Pair Selection',
    description: 'Switches the active pair, extracts history slice, and computes deviation across multiple feeds.',
    targetBudgetMs: 120,
    warnBudgetMs: 180,
  },
  feed_filter_search: {
    id: 'feed_filter_search',
    name: 'Feed Search & Multi-Facet Filter',
    description: 'Filters 250+ live oracle price feeds by query, provider sources, and confidence thresholds.',
    targetBudgetMs: 50,
    warnBudgetMs: 75,
  },
  governance_export_serialization: {
    id: 'governance_export_serialization',
    name: 'Governance Audit Export Serialization',
    description: 'Serializes 500+ immutable governance event records to RFC 4180 CSV and audit JSON formats.',
    targetBudgetMs: 150,
    warnBudgetMs: 220,
  },
  conflict_disclosures_filter: {
    id: 'conflict_disclosures_filter',
    name: 'Operator Disclosures Filter Evaluation',
    description: 'Evaluates multi-category materiality and provenance status across 100+ operator attestations.',
    targetBudgetMs: 60,
    warnBudgetMs: 90,
  },
}
