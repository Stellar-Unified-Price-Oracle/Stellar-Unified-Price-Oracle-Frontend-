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

  it('fetches history for a pair', async () => {
    const history = [{ price: 50000, timestamp: Date.now(), confidence: 0.99, sources: ['chainlink'] }]
    vi.mocked(rest.fetchPriceHistory).mockResolvedValue({ pair: 'BTC/USD', history })
    const { result } = renderHook(() => usePriceHistory('BTC/USD'))
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })
    expect(result.current.history).toEqual(history)
  })

  it('sets error on failure', async () => {
    vi.mocked(rest.fetchPriceHistory).mockRejectedValue(new Error('API error'))
    const { result } = renderHook(() => usePriceHistory('BTC/USD'))
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 })
    expect(result.current.error).toBe('API error')
  })
})
