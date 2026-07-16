import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePriceHistory } from './usePriceHistory'
import * as rest from '../api/rest'

vi.mock('../api/rest', () => ({
  fetchPriceHistory: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('usePriceHistory', () => {
  it('does not fetch when pair is null', () => {
    const { result } = renderHook(() => usePriceHistory(null))
    expect(result.current.loading).toBe(false)
    expect(rest.fetchPriceHistory).not.toHaveBeenCalled()
  })

  it('fetches initial history for a pair', async () => {
    const history = [
      { price: 50000, timestamp: 1000, confidence: 0.99, sources: ['chainlink'] },
      { price: 50100, timestamp: 2000, confidence: 0.99, sources: ['chainlink'] },
    ]
    vi.mocked(rest.fetchPriceHistory).mockResolvedValue({ pair: 'BTC/USD', history })
    const { result } = renderHook(() => usePriceHistory('BTC/USD', { pageSize: 2, refreshInterval: 60000 }))
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })
    expect(result.current.history).toEqual(history)
    expect(result.current.hasMore).toBe(true)
  })

  it('sets error on initial fetch failure', async () => {
    const error = new Error('API error')
    vi.mocked(rest.fetchPriceHistory).mockRejectedValue(error)
    const { result } = renderHook(() => usePriceHistory('BTC/USD', { refreshInterval: 60000 }))
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })
    expect(result.current.error?.message).toBe('API error')
  })

  it('appends data when loading more pages', async () => {
    const page1 = [
      { price: 50000, timestamp: 1000, confidence: 0.99, sources: ['chainlink'] },
      { price: 50100, timestamp: 2000, confidence: 0.99, sources: ['chainlink'] },
    ]
    const page2 = [
      { price: 50200, timestamp: 3000, confidence: 0.99, sources: ['chainlink'] },
    ]

    vi.mocked(rest.fetchPriceHistory).mockResolvedValueOnce({ pair: 'BTC/USD', history: page1 })
    vi.mocked(rest.fetchPriceHistory).mockResolvedValueOnce({ pair: 'BTC/USD', history: page2 })

    const { result } = renderHook(() => usePriceHistory('BTC/USD', { pageSize: 2, refreshInterval: 60000 }))

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })
    expect(result.current.history).toHaveLength(2)
    expect(result.current.hasMore).toBe(true)

    // Call loadMore
    await result.current.loadMore()
    
    // Wait for the history to be updated with appended data
    await waitFor(
      () => {
        expect(result.current.history).toHaveLength(3)
      },
      { timeout: 5000 },
    )
    
    expect(result.current.hasMore).toBe(false)
  })

  it('does not load more when already loading', async () => {
    const history = [
      { price: 50000, timestamp: 1000, confidence: 0.99, sources: ['chainlink'] },
      { price: 50100, timestamp: 2000, confidence: 0.99, sources: ['chainlink'] },
    ]
    vi.mocked(rest.fetchPriceHistory).mockResolvedValue({ pair: 'BTC/USD', history })
    const { result } = renderHook(() => usePriceHistory('BTC/USD', { pageSize: 2, refreshInterval: 60000 }))

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })

    // Call loadMore twice quickly - second should be ignored
    const promise1 = result.current.loadMore()
    const promise2 = result.current.loadMore() // Should not make another request

    await Promise.all([promise1, promise2])
    expect(vi.mocked(rest.fetchPriceHistory).mock.calls).toHaveLength(2) // Initial + one loadMore
  })

  it('calls onError callback on fetch error', async () => {
    const error = new Error('API error')
    const onError = vi.fn()
    vi.mocked(rest.fetchPriceHistory).mockRejectedValue(error)

    const { result } = renderHook(() => usePriceHistory('BTC/USD', { onError, refreshInterval: 60000 }))

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'API error' }))
  })

  it('sets hasMore to false when no more data available', async () => {
    const history = [
      { price: 50000, timestamp: 1000, confidence: 0.99, sources: ['chainlink'] },
      { price: 50100, timestamp: 2000, confidence: 0.99, sources: ['chainlink'] },
    ]
    vi.mocked(rest.fetchPriceHistory).mockResolvedValueOnce({ pair: 'BTC/USD', history })
    vi.mocked(rest.fetchPriceHistory).mockResolvedValueOnce({ pair: 'BTC/USD', history: [] })

    const { result } = renderHook(() => usePriceHistory('BTC/USD', { pageSize: 2, refreshInterval: 60000 }))

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })
    expect(result.current.hasMore).toBe(true)

    await result.current.loadMore()

    await waitFor(
      () => {
        expect(result.current.hasMore).toBe(false)
      },
      { timeout: 5000 },
    )
  })
})
