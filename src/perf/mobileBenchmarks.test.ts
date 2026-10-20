import { describe, it, expect } from 'vitest'
import {
  calculatePercentile,
  evaluateBenchmarkStatus,
  generateSyntheticFeeds,
  generateSyntheticHistory,
  generateSyntheticGovernanceEvents,
  generateSyntheticDisclosures,
  measureInteraction,
  benchmarkTimeframeSwitch,
  benchmarkPairSelection,
  benchmarkFeedFilterSearch,
  benchmarkGovernanceExportSerialization,
  benchmarkConflictDisclosuresFilter,
  runAllMobileBenchmarks,
  benchmarkSummaryToJson,
} from './mobileBenchmarks'
import { TIER_2_MOBILE_REFERENCE, MOBILE_BENCHMARK_BUDGETS } from '../types/mobileBenchmarks'

describe('mobileBenchmarks harness (#862)', () => {
  describe('synthetic data generators', () => {
    it('generates deterministic synthetic price feeds', () => {
      const feeds = generateSyntheticFeeds(50)
      expect(feeds).toHaveLength(50)
      expect(feeds[0].assetPair).toBe('XLM-0/USD')
      expect(feeds[0].sources.length).toBeGreaterThanOrEqual(1)
      expect(feeds[0].price).toBeGreaterThan(0)
    })

    it('generates synthetic historical price ticks', () => {
      const history = generateSyntheticHistory(100)
      expect(history).toHaveLength(100)
      expect(history[0].price).toBeGreaterThan(0)
      expect(history[0].volume).toBeGreaterThan(0)
      expect(history[1].timestamp).toBeGreaterThan(history[0].timestamp)
    })

    it('generates synthetic governance events', () => {
      const events = generateSyntheticGovernanceEvents(20)
      expect(events).toHaveLength(20)
      expect(events[0].id).toContain('GEV-BENCH')
      expect(events[0].actorRole).toBeDefined()
    })

    it('generates synthetic operator disclosures', () => {
      const disclosures = generateSyntheticDisclosures(15)
      expect(disclosures).toHaveLength(15)
      expect(disclosures[0].id).toContain('DISC-BENCH')
      expect(disclosures[0].provenance.status).toBeDefined()
    })
  })

  describe('statistical calculation utilities', () => {
    it('computes exact percentiles correctly', () => {
      const empty = calculatePercentile([], 95)
      expect(empty).toBe(0)

      const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
      expect(calculatePercentile(values, 50)).toBe(55)
      expect(calculatePercentile(values, 0)).toBe(10)
      expect(calculatePercentile(values, 100)).toBe(100)
    })

    it('evaluates benchmark status according to budgets', () => {
      expect(evaluateBenchmarkStatus(40, 50, 75)).toBe('pass')
      expect(evaluateBenchmarkStatus(50, 50, 75)).toBe('pass')
      expect(evaluateBenchmarkStatus(60, 50, 75)).toBe('warn')
      expect(evaluateBenchmarkStatus(75, 50, 75)).toBe('warn')
      expect(evaluateBenchmarkStatus(80, 50, 75)).toBe('fail')
    })
  })

  describe('interaction timing runner', () => {
    it('measures interaction with warmup and iterations', () => {
      let callCount = 0
      const result = measureInteraction(
        'feed_filter_search',
        () => {
          callCount++
        },
        { iterations: 5, warmup: 2, cpuSlowdownFactor: 1 },
      )

      expect(callCount).toBe(7) // 2 warmup + 5 iterations
      expect(result.id).toBe('feed_filter_search')
      expect(result.iterations).toBe(5)
      expect(result.minMs).toBeGreaterThan(0)
      expect(result.p95Ms).toBeGreaterThanOrEqual(result.minMs)
      expect(result.status).toBe('pass')
    })
  })

  describe('key dashboard interaction benchmarks', () => {
    it('executes timeframe switch benchmark within SLA budget', () => {
      const result = benchmarkTimeframeSwitch({ iterations: 3, warmup: 1 })
      expect(result.id).toBe('timeframe_switch')
      expect(result.budgetMs).toBe(MOBILE_BENCHMARK_BUDGETS.timeframe_switch.targetBudgetMs)
      expect(result.status).toMatch(/pass|warn/)
      expect(result.p95Ms).toBeLessThanOrEqual(MOBILE_BENCHMARK_BUDGETS.timeframe_switch.warnBudgetMs)
    })

    it('executes pair selection benchmark within SLA budget', () => {
      const result = benchmarkPairSelection({ iterations: 3, warmup: 1 })
      expect(result.id).toBe('pair_selection')
      expect(result.budgetMs).toBe(MOBILE_BENCHMARK_BUDGETS.pair_selection.targetBudgetMs)
      expect(result.status).toMatch(/pass|warn/)
      expect(result.p95Ms).toBeLessThanOrEqual(MOBILE_BENCHMARK_BUDGETS.pair_selection.warnBudgetMs)
    })

    it('executes feed filter & search benchmark within SLA budget', () => {
      const result = benchmarkFeedFilterSearch({ iterations: 3, warmup: 1 })
      expect(result.id).toBe('feed_filter_search')
      expect(result.budgetMs).toBe(MOBILE_BENCHMARK_BUDGETS.feed_filter_search.targetBudgetMs)
      expect(result.status).toMatch(/pass|warn/)
      expect(result.p95Ms).toBeLessThanOrEqual(MOBILE_BENCHMARK_BUDGETS.feed_filter_search.warnBudgetMs)
    })

    it('executes governance export serialization benchmark within SLA budget', () => {
      const result = benchmarkGovernanceExportSerialization({ iterations: 3, warmup: 1 })
      expect(result.id).toBe('governance_export_serialization')
      expect(result.budgetMs).toBe(MOBILE_BENCHMARK_BUDGETS.governance_export_serialization.targetBudgetMs)
      expect(result.status).toMatch(/pass|warn/)
      expect(result.p95Ms).toBeLessThanOrEqual(MOBILE_BENCHMARK_BUDGETS.governance_export_serialization.warnBudgetMs)
    })

    it('executes operator disclosures filter benchmark within SLA budget', () => {
      const result = benchmarkConflictDisclosuresFilter({ iterations: 3, warmup: 1 })
      expect(result.id).toBe('conflict_disclosures_filter')
      expect(result.budgetMs).toBe(MOBILE_BENCHMARK_BUDGETS.conflict_disclosures_filter.targetBudgetMs)
      expect(result.status).toMatch(/pass|warn/)
      expect(result.p95Ms).toBeLessThanOrEqual(MOBILE_BENCHMARK_BUDGETS.conflict_disclosures_filter.warnBudgetMs)
    })
  })

  describe('suite execution and JSON export', () => {
    it('runs all benchmarks and compiles a complete suite summary', () => {
      const summary = runAllMobileBenchmarks({ iterations: 3, warmup: 1 })

      expect(summary.tier.tierId).toBe('tier-2-mobile')
      expect(summary.totalBenchmarks).toBe(5)
      expect(summary.results).toHaveLength(5)
      expect(summary.passed + summary.warned + summary.failed).toBe(5)
      expect(['pass', 'warn', 'fail']).toContain(summary.overallStatus)

      const jsonStr = benchmarkSummaryToJson(summary)
      const parsed = JSON.parse(jsonStr)
      expect(parsed.tier.name).toBe(TIER_2_MOBILE_REFERENCE.name)
      expect(parsed.results).toHaveLength(5)
    })
  })
})
