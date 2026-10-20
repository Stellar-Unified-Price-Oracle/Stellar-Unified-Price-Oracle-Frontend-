import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MobileBenchmarkPanel } from './MobileBenchmarkPanel'
import type { MobileBenchmarkSuiteSummary } from '../types/mobileBenchmarks'
import { TIER_2_MOBILE_REFERENCE } from '../types/mobileBenchmarks'
import * as governanceEventsUtils from '../utils/governanceEvents'

const mockSummary: MobileBenchmarkSuiteSummary = {
  tier: TIER_2_MOBILE_REFERENCE,
  executedAt: '2026-10-19T21:00:00.000Z',
  totalBenchmarks: 5,
  passed: 5,
  warned: 0,
  failed: 0,
  overallStatus: 'pass',
  results: [
    {
      id: 'timeframe_switch',
      name: 'Timeframe & Interval Switch',
      description: 'Calculates price aggregation across 1,000 historical datapoints.',
      iterations: 5,
      minMs: 1.2,
      maxMs: 3.5,
      meanMs: 2.1,
      medianMs: 2.0,
      p95Ms: 3.2,
      budgetMs: 100,
      warnBudgetMs: 150,
      status: 'pass',
      timestamp: 1772000000000,
    },
    {
      id: 'pair_selection',
      name: 'Feed / Pair Selection',
      description: 'Switches the active pair and computes deviation.',
      iterations: 5,
      minMs: 0.8,
      maxMs: 2.1,
      meanMs: 1.3,
      medianMs: 1.2,
      p95Ms: 1.9,
      budgetMs: 120,
      warnBudgetMs: 180,
      status: 'pass',
      timestamp: 1772000000000,
    },
  ],
}

describe('MobileBenchmarkPanel (#862)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders heading, reference tier badge, and empty state when no summary is provided', () => {
    render(<MobileBenchmarkPanel />)
    expect(screen.getByRole('heading', { name: 'Mobile Interaction Benchmarks' })).toBeDefined()
    expect(screen.getByText('Tier-2 Reference')).toBeDefined()
    expect(screen.getByText('No benchmark run recorded.')).toBeDefined()
    expect(screen.getByRole('button', { name: /Execute mobile interaction benchmarks/i })).toBeDefined()
  })

  it('renders preloaded summary results and statistics', () => {
    render(<MobileBenchmarkPanel initialSummary={mockSummary} />)
    expect(screen.getByText('PASS')).toBeDefined()
    expect(screen.getByText('Timeframe & Interval Switch')).toBeDefined()
    expect(screen.getByText('Feed / Pair Selection')).toBeDefined()
    expect(screen.getByText('3.2 ms')).toBeDefined()
    expect(screen.getAllByText('PASSED').length).toBeGreaterThanOrEqual(1)
  })

  it('executes benchmarks when button is clicked and invokes onRunCompleted callback', async () => {
    const handleCompleted = vi.fn()
    render(<MobileBenchmarkPanel onRunCompleted={handleCompleted} />)

    const runBtn = screen.getByRole('button', { name: /Execute mobile interaction benchmarks/i })
    await userEvent.click(runBtn)

    await waitFor(() => {
      expect(screen.getByText('Timeframe & Interval Switch')).toBeDefined()
      expect(screen.getByText('Feed Search & Multi-Facet Filter')).toBeDefined()
    })

    expect(handleCompleted).toHaveBeenCalledTimes(1)
  })

  it('triggers JSON export download when Export JSON button is clicked', async () => {
    const triggerDownloadSpy = vi.spyOn(governanceEventsUtils, 'triggerFileDownload').mockImplementation(() => {})
    render(<MobileBenchmarkPanel initialSummary={mockSummary} />)

    const exportBtn = screen.getByRole('button', { name: /Export mobile benchmark results as JSON/i })
    await userEvent.click(exportBtn)

    expect(triggerDownloadSpy).toHaveBeenCalledTimes(1)
    const [jsonContent, filename, mimeType] = triggerDownloadSpy.mock.calls[0]
    expect(filename).toContain('mobile-benchmarks-tier2')
    expect(mimeType).toBe('application/json')
    const parsed = JSON.parse(jsonContent)
    expect(parsed.totalBenchmarks).toBe(5)
  })

  it('renders tier specification details when expanded', () => {
    render(<MobileBenchmarkPanel />)
    expect(screen.getByText('Tier-2 Mobile Reference Profile Specification')).toBeDefined()
    expect(screen.getByText(TIER_2_MOBILE_REFERENCE.deviceModel)).toBeDefined()
    expect(screen.getByText(`${TIER_2_MOBILE_REFERENCE.cpuSlowdownFactor}× Slowdown`)).toBeDefined()
  })
})
