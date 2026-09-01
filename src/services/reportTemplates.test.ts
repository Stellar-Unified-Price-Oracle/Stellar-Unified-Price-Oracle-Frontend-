import { describe, it, expect } from 'vitest'
import { generateReportCsv, REPORT_TEMPLATES } from './reportTemplates'
import type { ReportData } from './reportTemplates'
import type { PriceData, SourceHealth, AlertHistoryEntry } from '../types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePrice(overrides: Partial<PriceData> = {}): PriceData {
  return {
    assetPair: 'BTC/USD',
    price: 50_000,
    timestamp: 1_700_000_000_000,
    confidence: 0.98,
    sources: ['chainlink', 'band'],
    ...overrides,
  }
}

function makeHealth(overrides: Partial<SourceHealth> = {}): SourceHealth {
  return {
    source: 'chainlink',
    status: 'healthy',
    lastUpdate: 1_700_000_000_000,
    latency: 100,
    ...overrides,
  }
}

function makeAlertHistory(overrides: Partial<AlertHistoryEntry> = {}): AlertHistoryEntry {
  return {
    id: 'h1',
    alertId: 'a1',
    assetPair: 'BTC/USD',
    triggeredAt: 1_700_000_000_000,
    price: 50_000,
    triggerOnce: false,
    percentageMode: false,
    upperThreshold: 60_000,
    lowerThreshold: null,
    percentageThreshold: null,
    percentageWindow: null,
    percentageDirection: null,
    ...overrides,
  }
}

const baseData: ReportData = {
  prices: [makePrice(), makePrice({ assetPair: 'ETH/USD', price: 3_000 })],
  sourceHealths: [makeHealth(), makeHealth({ source: 'redstone', latency: 200 })],
  alertHistory: [makeAlertHistory()],
}

// ── REPORT_TEMPLATES ──────────────────────────────────────────────────────────

describe('REPORT_TEMPLATES', () => {
  it('contains exactly three templates', () => {
    expect(REPORT_TEMPLATES).toHaveLength(3)
  })

  it('includes feed-health, top-movers, and alert-digest ids', () => {
    const ids = REPORT_TEMPLATES.map((t) => t.id)
    expect(ids).toContain('feed-health')
    expect(ids).toContain('top-movers')
    expect(ids).toContain('alert-digest')
  })

  it('each template has a non-empty label and description', () => {
    for (const t of REPORT_TEMPLATES) {
      expect(t.label.length).toBeGreaterThan(0)
      expect(t.description.length).toBeGreaterThan(0)
    }
  })
})

// ── generateReportCsv ─────────────────────────────────────────────────────────

describe('generateReportCsv — feed-health', () => {
  it('returns a non-empty CSV string', () => {
    const csv = generateReportCsv('feed-health', baseData)
    expect(typeof csv).toBe('string')
    expect(csv.length).toBeGreaterThan(0)
  })

  it('includes source names in the output', () => {
    const csv = generateReportCsv('feed-health', baseData)
    expect(csv).toContain('chainlink')
  })

  it('includes a header row', () => {
    const csv = generateReportCsv('feed-health', baseData)
    const firstLine = csv.split('\n')[0]
    // The header should contain at least 'source'
    expect(firstLine.toLowerCase()).toContain('source')
  })
})

describe('generateReportCsv — top-movers', () => {
  it('returns a non-empty CSV string', () => {
    const csv = generateReportCsv('top-movers', baseData)
    expect(typeof csv).toBe('string')
    expect(csv.length).toBeGreaterThan(0)
  })

  it('includes asset pairs in output', () => {
    const csv = generateReportCsv('top-movers', baseData)
    expect(csv).toContain('BTC/USD')
  })
})

describe('generateReportCsv — alert-digest', () => {
  it('returns a non-empty CSV string', () => {
    const csv = generateReportCsv('alert-digest', baseData)
    expect(typeof csv).toBe('string')
    expect(csv.length).toBeGreaterThan(0)
  })

  it('returns a header-only CSV when alertHistory is empty', () => {
    const csv = generateReportCsv('alert-digest', { ...baseData, alertHistory: [] })
    const lines = csv.split('\n').filter(Boolean)
    // Only the header line — no data rows
    expect(lines).toHaveLength(1)
  })

  it('handles missing alertHistory gracefully', () => {
    const data: ReportData = { prices: baseData.prices, sourceHealths: baseData.sourceHealths }
    expect(() => generateReportCsv('alert-digest', data)).not.toThrow()
  })

  it('includes asset pair from alert history', () => {
    const csv = generateReportCsv('alert-digest', baseData)
    expect(csv).toContain('BTC/USD')
  })
})
