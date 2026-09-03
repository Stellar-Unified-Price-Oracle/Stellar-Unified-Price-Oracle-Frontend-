import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { computeSourceMetrics, exportLeaderboardCsv } from './export'
import type { SourceHealth, PriceHistoryEntry } from '../types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = 1_700_000_000_000
const WINDOW_MS = 24 * 60 * 60 * 1000 // 24 h

function makeHealth(overrides: Partial<SourceHealth> = {}): SourceHealth {
  return {
    source: 'chainlink',
    status: 'healthy',
    lastUpdate: NOW - 5_000,
    latency: 120,
    ...overrides,
  }
}

function makeEntry(
  sources: string[],
  timestamp: number,
  overrides: Partial<PriceHistoryEntry> = {},
): PriceHistoryEntry {
  return {
    price: 100,
    timestamp,
    confidence: 0.95,
    sources,
    ...overrides,
  }
}

// ── computeSourceMetrics ──────────────────────────────────────────────────────

describe('computeSourceMetrics', () => {
  const WINDOW_MS = 24 * 60 * 60 * 1000 // 24 h

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a metric entry for each source health', () => {
    const sourceHealths = [makeHealth({ source: 'chainlink' }), makeHealth({ source: 'redstone' })]
    const result = computeSourceMetrics(sourceHealths, {}, WINDOW_MS)
    expect(result).toHaveLength(2)
    const sources = result.map((r) => r.source)
    expect(sources).toContain('chainlink')
    expect(sources).toContain('redstone')
  })

  it('computes 100% uptime when source appears in all window entries', () => {
    const history: Record<string, PriceHistoryEntry[]> = {
      'BTC/USD': [
        makeEntry(['chainlink'], NOW - 1_000),
        makeEntry(['chainlink'], NOW - 2_000),
        makeEntry(['chainlink'], NOW - 3_000),
      ],
    }
    const sourceHealths = [makeHealth({ source: 'chainlink' })]
    const [metric] = computeSourceMetrics(sourceHealths, history, WINDOW_MS)
    expect(metric.uptimePercent).toBe(100)
  })

  it('computes 0% uptime when source never appears in window entries', () => {
    const history: Record<string, PriceHistoryEntry[]> = {
      'BTC/USD': [
        makeEntry(['redstone'], NOW - 1_000),
        makeEntry(['redstone'], NOW - 2_000),
      ],
    }
    const sourceHealths = [makeHealth({ source: 'chainlink' })]
    const [metric] = computeSourceMetrics(sourceHealths, history, WINDOW_MS)
    expect(metric.uptimePercent).toBe(0)
  })

  it('computes partial uptime correctly (50%)', () => {
    const history: Record<string, PriceHistoryEntry[]> = {
      'BTC/USD': [
        makeEntry(['chainlink'], NOW - 1_000),
        makeEntry(['redstone'], NOW - 2_000),
      ],
    }
    const sourceHealths = [makeHealth({ source: 'chainlink' })]
    const [metric] = computeSourceMetrics(sourceHealths, history, WINDOW_MS)
    expect(metric.uptimePercent).toBe(50)
  })

  it('excludes entries outside the time window', () => {
    const insideWindow = NOW - 1_000
    const outsideWindow = NOW - WINDOW_MS - 1_000 // older than window
    const history: Record<string, PriceHistoryEntry[]> = {
      'BTC/USD': [
        makeEntry(['chainlink'], insideWindow),
        makeEntry(['chainlink'], outsideWindow),
      ],
    }
    const sourceHealths = [makeHealth({ source: 'chainlink' })]
    const [metric] = computeSourceMetrics(sourceHealths, history, WINDOW_MS)
    // Only the inside-window entry counts; 1/1 = 100%
    expect(metric.uptimePercent).toBe(100)
  })

  it('sets meanLatencyMs from SourceHealth.latency', () => {
    const sourceHealths = [makeHealth({ source: 'chainlink', latency: 250 })]
    const [metric] = computeSourceMetrics(sourceHealths, {}, WINDOW_MS)
    expect(metric.meanLatencyMs).toBe(250)
  })

  it('sets meanLatencyMs to null when latency is null', () => {
    const sourceHealths = [makeHealth({ source: 'chainlink', latency: null })]
    const [metric] = computeSourceMetrics(sourceHealths, {}, WINDOW_MS)
    expect(metric.meanLatencyMs).toBeNull()
  })

  it('computes stalenessMs as difference between now and lastUpdate', () => {
    const lastUpdate = NOW - 30_000
    const sourceHealths = [makeHealth({ source: 'chainlink', lastUpdate })]
    const [metric] = computeSourceMetrics(sourceHealths, {}, WINDOW_MS)
    expect(metric.stalenessMs).toBe(30_000)
  })

  it('sets stalenessMs to 0 when lastUpdate is null', () => {
    const sourceHealths = [makeHealth({ source: 'chainlink', lastUpdate: null })]
    const [metric] = computeSourceMetrics(sourceHealths, {}, WINDOW_MS)
    expect(metric.stalenessMs).toBe(0)
  })

  it('sets trend to stable when no prior-window data exists', () => {
    const history: Record<string, PriceHistoryEntry[]> = {
      'BTC/USD': [makeEntry(['chainlink'], NOW - 1_000)],
    }
    const sourceHealths = [makeHealth({ source: 'chainlink' })]
    const [metric] = computeSourceMetrics(sourceHealths, history, WINDOW_MS)
    expect(metric.trend).toBe('stable')
  })

  it('handles empty history gracefully (returns 0% uptime, stable trend)', () => {
    const sourceHealths = [makeHealth({ source: 'chainlink' })]
    const [metric] = computeSourceMetrics(sourceHealths, {}, WINDOW_MS)
    expect(metric.uptimePercent).toBe(0)
    expect(metric.trend).toBe('stable')
  })

  it('returns empty array for empty sourceHealths', () => {
    const result = computeSourceMetrics([], {}, WINDOW_MS)
    expect(result).toEqual([])
  })
})

// ── exportLeaderboardCsv ──────────────────────────────────────────────────────

describe('exportLeaderboardCsv', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>
  let clickSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    clickSpy = vi.fn()
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: clickSpy,
    } as unknown as HTMLAnchorElement)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('computes 0-100 reliabilityScore correctly', () => {
    const history: Record<string, PriceHistoryEntry[]> = {
      'BTC/USD': [
        makeEntry(['chainlink'], NOW - 1_000),
      ],
    }
    const sourceHealths = [makeHealth({ source: 'chainlink', latency: 100, lastUpdate: NOW - 1000 })]
    const [metric] = computeSourceMetrics(sourceHealths, history, WINDOW_MS)
    expect(metric.reliabilityScore).toBeGreaterThanOrEqual(0)
    expect(metric.reliabilityScore).toBeLessThanOrEqual(100)
  })

  it('triggers a download', () => {
    exportLeaderboardCsv([
      { source: 'chainlink', uptimePercent: 99, meanLatencyMs: 120, stalenessMs: 5000, reliabilityScore: 95, trend: 'up' },
    ])
    expect(createObjectURLSpy).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test')
  })

  it('downloads a .csv file', () => {
    const anchors: Array<{ download: string }> = []
    vi.spyOn(document, 'createElement').mockImplementation(() => {
      const el = { href: '', download: '', click: vi.fn() }
      anchors.push(el)
      return el as unknown as HTMLAnchorElement
    })
    exportLeaderboardCsv([
      { source: 'redstone', uptimePercent: 80, meanLatencyMs: null, stalenessMs: 60000, reliabilityScore: 75, trend: 'down' },
    ])
    expect(anchors[0].download).toMatch(/reliability-leaderboard.*\.csv$/)
  })
})
