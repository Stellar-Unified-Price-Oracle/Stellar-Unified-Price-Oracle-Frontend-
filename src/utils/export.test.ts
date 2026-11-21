import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  alertHistoryToAuditJson,
  alertHistoryToCsvRows,
  toCsv,
  priceDataToCsvRows,
  priceDataToJsonRows,
  priceDataToXlsx,
  historyToCsvRows,
  downloadFile,
  exportFilename,
} from './export'

describe('toCsv', () => {
  it('produces header row + data rows', () => {
    const rows = [{ a: '1', b: '2' }]
    expect(toCsv(rows, ['a', 'b'])).toBe('a,b\n1,2')
  })

  it('escapes values containing commas', () => {
    const rows = [{ a: 'hello,world', b: 'ok' }]
    expect(toCsv(rows, ['a', 'b'])).toBe('a,b\n"hello,world",ok')
  })
})

describe('priceDataToCsvRows', () => {
  it('maps price data to rows with ISO timestamp and semicolon-joined sources', () => {
    const prices = [
      { assetPair: 'BTC/USD', price: 50000, timestamp: 0, confidence: 0.99, sources: ['chainlink', 'band'] },
    ]
    const { rows, headers } = priceDataToCsvRows(prices)
    expect(headers).toContain('assetPair')
    expect(rows[0].assetPair).toBe('BTC/USD')
    expect(rows[0].timestamp).toBe(new Date(0).toISOString())
    expect(rows[0].sources).toBe('chainlink;band')
    expect(headers).toContain('sourceTickProvenanceUrl')
    expect(rows[0].sourceTickProvenanceUrl).toBe('')
  })

  it('preserves an API-provided provenance link in CSV and JSON exports', () => {
    const sourceTickProvenanceUrl = 'https://oracle.example/ticks/abc123'
    const prices = [
      {
        assetPair: 'BTC/USD',
        price: 50000,
        timestamp: 0,
        confidence: 0.99,
        sources: ['chainlink'],
        sourceTickProvenanceUrl,
      },
    ]

    expect(priceDataToCsvRows(prices).rows[0].sourceTickProvenanceUrl).toBe(sourceTickProvenanceUrl)
    expect(priceDataToJsonRows(prices)[0].sourceTickProvenanceUrl).toBe(sourceTickProvenanceUrl)
    expect(priceDataToJsonRows(prices, ['sourceTickProvenanceUrl'])).toEqual([{ sourceTickProvenanceUrl }])
    expect(priceDataToCsvRows(prices, ['sourceTickProvenanceUrl']).headers).toEqual(['sourceTickProvenanceUrl'])
    const csvRows = priceDataToCsvRows(prices)
    expect(toCsv(csvRows.rows, csvRows.headers)).toContain(sourceTickProvenanceUrl)
    expect(new TextDecoder().decode(priceDataToXlsx(prices))).toContain(sourceTickProvenanceUrl)
  })
})

describe('historyToCsvRows', () => {
  it('injects pair into each row', () => {
    const history = [{ price: 100, timestamp: 0, confidence: 0.9, sources: ['redstone'] }]
    const { rows } = historyToCsvRows('ETH/USD', history)
    expect(rows[0].assetPair).toBe('ETH/USD')
  })
})

describe('alert history audit exports', () => {
  const entry = {
    id: 'event-1',
    alertId: 'alert-1',
    assetPair: 'BTC/USD',
    triggeredAt: 0,
    price: 50000,
    triggerOnce: true,
    percentageMode: false,
    upperThreshold: 49000,
    lowerThreshold: null,
    percentageThreshold: null,
    percentageWindow: null,
    percentageDirection: null,
    escalation: { stepId: 'step-1', channel: 'webhook' as const, delayMinutes: 15 },
    retest: { kind: 'retest' as const, cycle: 2 },
  }

  it('exports stable event IDs, alert details, and UTC timestamps to CSV', () => {
    const { rows, headers } = alertHistoryToCsvRows([entry])
    expect(headers).toContain('eventId')
    expect(headers).toContain('alertId')
    expect(rows[0]).toMatchObject({
      eventId: 'event-1',
      alertId: 'alert-1',
      triggeredAt: '1970-01-01T00:00:00.000Z',
      eventType: 'escalation',
      escalationStepId: 'step-1',
      escalationChannel: 'webhook',
      retestKind: 'retest',
      retestCycle: 2,
    })
  })

  it('wraps JSON entries in a versioned, browser-local export envelope', () => {
    const exported = JSON.parse(alertHistoryToAuditJson([entry], new Date(1)))
    expect(exported).toMatchObject({
      schemaVersion: 1,
      source: 'browser-local',
      exportedAtUtc: '1970-01-01T00:00:00.001Z',
      entries: [{ eventId: 'event-1', triggeredAt: '1970-01-01T00:00:00.000Z' }],
    })
  })
})

describe('exportFilename', () => {
  it('replaces / with - in pair', () => {
    const name = exportFilename('BTC/USD', 'csv')
    expect(name).toContain('BTC-USD')
    expect(name).toMatch(/\.csv$/)
  })
})

describe('downloadFile', () => {
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

  it('creates and clicks a download link', () => {
    downloadFile('hello', 'test.csv', 'text/csv')
    expect(createObjectURLSpy).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test')
  })
})
