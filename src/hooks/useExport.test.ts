import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useExport } from './useExport'
import * as exportUtils from '../utils/export'

vi.mock('../utils/export', async (importOriginal) => {
  const actual = await importOriginal<typeof exportUtils>()
  return { ...actual, downloadFile: vi.fn() }
})

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.restoreAllMocks())

const prices = [
  { assetPair: 'BTC/USD', price: 50000, timestamp: Date.now(), confidence: 0.99, sources: ['chainlink'] },
]
const history = [{ price: 100, timestamp: Date.now(), confidence: 0.9, sources: ['band'] }]

describe('useExport', () => {
  it('starts with exporting=false', () => {
    const { result } = renderHook(() => useExport())
    expect(result.current.exporting).toBe(false)
  })

  it('exportPrices csv calls downloadFile with csv mime type', async () => {
    const { result } = renderHook(() => useExport())
    await act(() => result.current.exportPrices(prices, 'csv'))
    expect(exportUtils.downloadFile).toHaveBeenCalledWith(
      expect.stringContaining('assetPair'),
      expect.stringMatching(/\.csv$/),
      'text/csv',
    )
  })

  it('exportPrices json calls downloadFile with json mime type', async () => {
    const { result } = renderHook(() => useExport())
    await act(() => result.current.exportPrices(prices, 'json'))
    expect(exportUtils.downloadFile).toHaveBeenCalledWith(
      expect.stringContaining('BTC/USD'),
      expect.stringMatching(/\.json$/),
      'application/json',
    )
  })

  it('exportHistory csv calls downloadFile', async () => {
    const { result } = renderHook(() => useExport())
    await act(() => result.current.exportHistory('ETH/USD', history, 'csv'))
    expect(exportUtils.downloadFile).toHaveBeenCalledWith(
      expect.stringContaining('ETH'),
      expect.stringMatching(/ETH-USD.*\.csv$/),
      'text/csv',
    )
  })

  it('exportHistory json calls downloadFile with pair injected', async () => {
    const { result } = renderHook(() => useExport())
    await act(() => result.current.exportHistory('ETH/USD', history, 'json'))
    const call = vi.mocked(exportUtils.downloadFile).mock.calls[0]
    const parsed = JSON.parse(call[0] as string)
    expect(parsed[0].assetPair).toBe('ETH/USD')
  })
})
