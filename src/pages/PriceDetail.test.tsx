import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PriceDetail } from './PriceDetail'

afterEach(cleanup)

const defaultHistory = {
  history: [],
  loading: false,
  loadingMore: false,
  error: null,
  hasMore: false,
  loadMore: vi.fn(),
  refetch: vi.fn(),
}

vi.mock('../hooks/useSwr', () => ({ useSwr: vi.fn() }))
vi.mock('../hooks/usePriceHistory', () => ({ usePriceHistory: vi.fn() }))
vi.mock('../components/PriceChart', () => ({
  PriceChart: () => <div data-testid="price-chart" />,
}))
vi.mock('../components/CsvImportZone', () => ({
  CsvImportZone: () => null,
}))

function renderWithPair(pair = 'BTC%2FUSD') {
  return render(
    <MemoryRouter initialEntries={[`/prices/${pair}`]}>
      <Routes>
        <Route path="/prices/:pair" element={<PriceDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PriceDetail', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { usePriceHistory } = await import('../hooks/usePriceHistory')
    vi.mocked(usePriceHistory).mockReturnValue(defaultHistory)
  })

  it('shows loading skeleton while price is loading', async () => {
    const { useSwr } = await import('../hooks/useSwr')
    vi.mocked(useSwr).mockReturnValue({ data: undefined, loading: true, error: null, isValidating: false, refetch: vi.fn() })

    renderWithPair()
    expect(screen.getByRole('status', { name: 'Loading price detail' })).toBeInTheDocument()
  })

  it('shows error state when price fetch fails', async () => {
    const { useSwr } = await import('../hooks/useSwr')
    vi.mocked(useSwr).mockReturnValue({ data: undefined, loading: false, error: 'Failed to fetch', isValidating: false, refetch: vi.fn() })

    renderWithPair()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument()
  })

  it('renders pair name when data is loaded', async () => {
    const { useSwr } = await import('../hooks/useSwr')
    vi.mocked(useSwr).mockReturnValue({
      data: { assetPair: 'BTC/USD', price: 50000, timestamp: Date.now(), confidence: 0.99, sources: ['chainlink'] },
      loading: false,
      error: null,
      isValidating: false,
      refetch: vi.fn(),
    })

    renderWithPair()
    expect(screen.getByRole('heading', { name: 'BTC/USD' })).toBeInTheDocument()
  })

  it('shows chart when data is loaded', async () => {
    const { useSwr } = await import('../hooks/useSwr')
    vi.mocked(useSwr).mockReturnValue({
      data: { assetPair: 'BTC/USD', price: 50000, timestamp: Date.now(), confidence: 0.99, sources: ['chainlink'] },
      loading: false,
      error: null,
      isValidating: false,
      refetch: vi.fn(),
    })

    renderWithPair()
    expect(screen.getByTestId('price-chart')).toBeInTheDocument()
  })
})
