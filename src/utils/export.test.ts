import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  toCsv,
  priceDataToCsvRows,
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
  })
})

describe('historyToCsvRows', () => {
  it('injects pair into each row', () => {
    const history = [{ price: 100, timestamp: 0, confidence: 0.9, sources: ['redstone'] }]
    const { rows } = historyToCsvRows('ETH/USD', history)
    expect(rows[0].assetPair).toBe('ETH/USD')
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
  let createObjectURLSpy: ReturnType<typeof vi.fn>
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>
  let clickSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createObjectURLSpy = vi.fn(() => 'blob:test')
    revokeObjectURLSpy = vi.fn()
    clickSpy = vi.fn()
    URL.createObjectURL = createObjectURLSpy
    URL.revokeObjectURL = revokeObjectURLSpy
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
