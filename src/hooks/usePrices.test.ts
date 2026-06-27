import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePrices } from './usePrices'
import * as rest from '../api/rest'

vi.mock('../api/rest', () => ({
  fetchAllPrices: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('usePrices', () => {
  it('returns loading initially', () => {
    vi.mocked(rest.fetchAllPrices).mockResolvedValue([])
    const { result } = renderHook(() => usePrices())
    expect(result.current.loading).toBe(true)
    expect(result.current.prices).toEqual([])
  })

  it('returns prices after fetch', async () => {
    const prices = [{ assetPair: 'BTC/USD', price: 50000, timestamp: Date.now(), confidence: 0.99, sources: ['chainlink'] }]
    vi.mocked(rest.fetchAllPrices).mockResolvedValue(prices)
    const { result } = renderHook(() => usePrices())
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })
    expect(result.current.prices).toEqual(prices)
    expect(result.current.error).toBeNull()
  })

  it('sets error on fetch failure', async () => {
    vi.mocked(rest.fetchAllPrices).mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => usePrices())
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })
    expect(result.current.error).toBe('Network error')
  })

  it('refetch function reloads data', async () => {
    vi.mocked(rest.fetchAllPrices).mockResolvedValue([])
    const { result } = renderHook(() => usePrices())
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })
    vi.mocked(rest.fetchAllPrices).mockResolvedValue([{ assetPair: 'ETH/USD', price: 3000, timestamp: Date.now(), confidence: 0.95, sources: ['chainlink'] }])
    result.current.refetch()
    await waitFor(() => expect(result.current.prices[0].assetPair).toBe('ETH/USD'), { timeout: 5000 })
  })
})
