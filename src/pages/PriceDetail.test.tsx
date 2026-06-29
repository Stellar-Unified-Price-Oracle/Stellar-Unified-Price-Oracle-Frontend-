import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PriceDetail } from './PriceDetail'

afterEach(cleanup)

const mockPrice = {
  assetPair: 'BTC/USD',
  price: 50000,
  timestamp: Date.now() - 60000,
  confidence: 0.97,
  sources: ['chainlink', 'redstone', 'band', 'reflector'],
}

const mockHistory = [
  { price: 49000, timestamp: Date.now() - 3600000, confidence: 0.98, sources: ['chainlink'] },
  { price: 50000, timestamp: Date.now() - 1800000, confidence: 0.97, sources: ['chainlink'] },
]

vi.mock('../hooks/useSwr', () => ({
  useSwr: vi.fn(() => ({ data: mockPrice, loading: false, error: null })),
}))

vi.mock('../hooks/usePriceHistory', () => ({
  usePriceHistory: vi.fn(() => ({
    history: mockHistory,
    loading: false,
    loadingMore: false,
    hasMore: false,
    error: null,
    loadMore: vi.fn(),
    refetch: vi.fn(),
  })),
}))

function renderDetail(pair = 'BTC%2FUSD') {
  return render(
    <MemoryRouter initialEntries={[`/prices/${pair}`]}>
      <Routes>
        <Route path="/prices/:pair" element={<PriceDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PriceDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Issue #238 — PriceDetail page component renders
  it('renders the current price for the asset pair', async () => {
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('BTC/USD')).toBeInTheDocument()
      expect(screen.getByText(/50[,.]?000/)).toBeInTheDocument()
    })
  })

  it('renders back navigation button', () => {
    renderDetail()
    expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument()
  })

  it('shows loading skeleton while data is loading', async () => {
    const { useSwr } = await import('../hooks/useSwr')
    vi.mocked(useSwr).mockReturnValueOnce({ data: null, loading: true, error: null, isValidating: false, refetch: vi.fn() })
    const { usePriceHistory } = await import('../hooks/usePriceHistory')
    vi.mocked(usePriceHistory).mockReturnValueOnce({
      history: [],
      loading: true,
      loadingMore: false,
      hasMore: false,
      error: null,
      loadMore: vi.fn(),
      refetch: vi.fn(),
    })
    renderDetail()
    // Skeleton renders instead of content
    expect(screen.queryByText('BTC/USD')).not.toBeInTheDocument()
  })

  it('shows error state when price fetch fails', async () => {
    const { useSwr } = await import('../hooks/useSwr')
    vi.mocked(useSwr).mockReturnValueOnce({ data: null, loading: false, error: 'API Error', isValidating: false, refetch: vi.fn() })
    renderDetail()
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  // Issue #239 — Route /prices/:pair renders PriceDetail
  it('renders for the /prices/:pair route', async () => {
    renderDetail('ETH%2FUSD')
    await waitFor(() => {
      expect(screen.getByText('BTC/USD')).toBeInTheDocument()
    })
  })

  // Issue #240 — PriceChart renders with fetched price history data
  it('renders PriceChart with price history data', async () => {
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('BTC/USD Price History')).toBeInTheDocument()
    })
  })

  it('shows history error when history fetch fails', async () => {
    const { usePriceHistory } = await import('../hooks/usePriceHistory')
    vi.mocked(usePriceHistory).mockReturnValueOnce({
      history: [],
      loading: false,
      loadingMore: false,
      hasMore: false,
      error: new Error('History failed'),
      loadMore: vi.fn(),
      refetch: vi.fn(),
    })
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText(/Failed to load price history/)).toBeInTheDocument()
    })
  })

  it('renders confidence percentage', async () => {
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText(/97\.0% confidence/)).toBeInTheDocument()
    })
  })

  // Issue #241 — Source badges display for all oracle sources
  it('renders source badges for all oracle providers', async () => {
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('chainlink')).toBeInTheDocument()
      expect(screen.getByText('redstone')).toBeInTheDocument()
      expect(screen.getByText('band')).toBeInTheDocument()
      expect(screen.getByText('reflector')).toBeInTheDocument()
    })
  })

  it('renders LIVE badge', async () => {
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('LIVE')).toBeInTheDocument()
    })
  })
})
