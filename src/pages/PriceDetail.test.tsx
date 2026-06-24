import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { PriceDetail } from './PriceDetail'
import { checkAccessibility } from '../test/accessibility'

const mockFetchPrice = vi.fn()
const mockUsePriceHistory = vi.fn(() => ({
  history: [],
  loading: false,
  error: null,
  refetch: vi.fn(),
}))

vi.mock('../api/rest', () => ({
  fetchPrice: (...args: unknown[]) => mockFetchPrice(...args),
}))

vi.mock('../hooks/usePriceHistory', () => ({
  usePriceHistory: (...args: unknown[]) => mockUsePriceHistory(...args),
}))

afterEach(cleanup)

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/price/:pair" element={<PriceDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

const mockPriceData = {
  assetPair: 'BTC/USD',
  price: 50000.1234,
  timestamp: Date.now(),
  confidence: 0.9876,
  sources: ['chainlink', 'redstone'],
}

describe('PriceDetail', () => {
  it('should have no accessibility violations', async () => {
    mockFetchPrice.mockResolvedValue(mockPriceData)
    mockUsePriceHistory.mockReturnValue({
      history: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    await checkAccessibility(
      <MemoryRouter initialEntries={['/price/BTC%2FUSD']}>
        <Routes>
          <Route path="/price/:pair" element={<PriceDetail />} />
        </Routes>
      </MemoryRouter>,
    )
  })

  it('shows loading state initially', () => {
    mockFetchPrice.mockImplementation(() => new Promise(() => {}))
    renderAt('/price/BTC%2FUSD')
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows error state when fetch fails', async () => {
    mockFetchPrice.mockRejectedValue(new Error('Failed to load price data'))
    renderAt('/price/BTC%2FUSD')
    const error = await screen.findByText((content) => content.includes('Failed to load price data'))
    expect(error).toBeInTheDocument()
  })

  it('renders price data after loading', async () => {
    mockFetchPrice.mockResolvedValue(mockPriceData)
    renderAt('/price/BTC%2FUSD')

    expect(await screen.findByText('BTC/USD')).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes('50,000.12'))).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes('98.8') && content.includes('%'))).toBeInTheDocument()
    expect(screen.getByText('Back to Dashboard')).toBeInTheDocument()
  })

  it('renders source badges', async () => {
    mockFetchPrice.mockResolvedValue(mockPriceData)
    renderAt('/price/BTC%2FUSD')

    expect(await screen.findByText('chainlink')).toBeInTheDocument()
    expect(screen.getByText('redstone')).toBeInTheDocument()
  })

  it('shows no pair message when pair param is empty', () => {
    mockFetchPrice.mockResolvedValue(mockPriceData)
    render(
      <MemoryRouter initialEntries={['/price/']}>
        <Routes>
          <Route path="/price/:pair" element={<PriceDetail />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('No pair specified')).toBeInTheDocument()
  })

  it('renders PriceChart with history data', async () => {
    mockFetchPrice.mockResolvedValue(mockPriceData)
    mockUsePriceHistory.mockReturnValue({
      history: [
        { price: 50000, timestamp: Date.now() - 3600000, confidence: 0.98, sources: ['chainlink'] },
        { price: 50100, timestamp: Date.now(), confidence: 0.99, sources: ['chainlink'] },
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    })

    renderAt('/price/BTC%2FUSD')
    expect(await screen.findByText('BTC/USD Price History')).toBeInTheDocument()
  })
})
