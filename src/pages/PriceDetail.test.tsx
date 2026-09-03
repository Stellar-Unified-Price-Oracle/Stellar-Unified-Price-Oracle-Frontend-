import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, within, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PreferencesProvider } from '../preferences/PreferencesContext'
import { PriceDetail } from './PriceDetail'

afterEach(cleanup)

vi.mock('../components/PriceProofPanel', () => ({
  PriceProofPanel: () => <div data-testid="price-proof-panel" />,
}))

vi.mock('../hooks/useIndexedDB', () => ({
  idbCache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue(() => {}),
    fetchWithCache: vi.fn().mockResolvedValue(null),
  },
}))

const defaultHistory = {
  history: [],
  loading: false,
  loadingMore: false,
  error: null,
  hasMore: false,
  loadMore: vi.fn(),
  refetch: vi.fn(),
}

// PriceChart mock — configurable via a module-level flag for error boundary tests
let shouldThrowChartError = false

vi.mock('../components/PriceChart', () => ({
  PriceChart: () => {
    if (shouldThrowChartError) {
      throw new Error('Chart render failed')
    }
    return <div data-testid="price-chart" />
  },
}))

vi.mock('../hooks/useSwr', () => ({ useSwr: vi.fn() }))
vi.mock('../hooks/usePriceHistory', () => ({ usePriceHistory: vi.fn() }))
vi.mock('../components/CsvImportZone', () => ({
  CsvImportZone: () => <div data-testid="csv-import-zone" />,
}))
vi.mock('../components/OnChainComparisonPanel', () => ({
  OnChainComparisonPanel: () => <div data-testid="onchain-comparison-panel" />,
}))

function renderWithPair(pair = 'BTC%2FUSD') {
  return render(
    <MemoryRouter initialEntries={[`/prices/${pair}`]}>
      <PreferencesProvider>
        <Routes>
          <Route path="/prices/:pair" element={<PriceDetail />} />
        </Routes>
      </PreferencesProvider>
    </MemoryRouter>,
  )
}

const mockPriceData = {
  assetPair: 'BTC/USD',
  price: 50000,
  timestamp: 1700000000000,
  confidence: 0.99,
  sources: ['chainlink', 'redstone'],
}

describe('PriceDetail', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    shouldThrowChartError = false
    const { usePriceHistory } = await import('../hooks/usePriceHistory')
    vi.mocked(usePriceHistory).mockReturnValue(defaultHistory)
  })

  // ─── Loading / Error states ──────────────────────────────────

  it('shows loading skeleton while price is loading', async () => {
    const { useSwr } = await import('../hooks/useSwr')
    vi.mocked(useSwr).mockReturnValue({
      data: undefined,
      loading: true,
      error: null,
      errorMessage: null,
      isValidating: false,
      refetch: vi.fn(),
    })

    renderWithPair()
    expect(screen.getByRole('status', { name: 'Loading price detail' })).toBeInTheDocument()
  })

  it('shows error state when price fetch fails', async () => {
    const { useSwr } = await import('../hooks/useSwr')
    vi.mocked(useSwr).mockReturnValue({
      data: undefined,
      loading: false,
      error: new Error('Failed to fetch'),
      errorMessage: 'Failed to fetch',
      isValidating: false,
      refetch: vi.fn(),
    })

    renderWithPair()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument()
  })

  // ─── Empty state ─────────────────────────────────────────────

  it('shows empty state when no price data is available', async () => {
    const { useSwr } = await import('../hooks/useSwr')
    vi.mocked(useSwr).mockReturnValue({
      data: undefined,
      loading: false,
      error: null,
      isValidating: false,
      refetch: vi.fn(),
    })

    renderWithPair()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('No price data available')).toBeInTheDocument()
  })

  // ─── Successful render ───────────────────────────────────────

  it('renders pair name when data is loaded', async () => {
    const { useSwr } = await import('../hooks/useSwr')
    vi.mocked(useSwr).mockReturnValue({
      data: mockPriceData,
      loading: false,
      error: null,
      errorMessage: null,
      isValidating: false,
      refetch: vi.fn(),
    })

    renderWithPair()
    expect(screen.getByRole('heading', { name: 'BTC/USD' })).toBeInTheDocument()
  })

  it('shows chart when data is loaded', async () => {
    const { useSwr } = await import('../hooks/useSwr')
    vi.mocked(useSwr).mockReturnValue({
      data: mockPriceData,
      loading: false,
      error: null,
      isValidating: false,
      refetch: vi.fn(),
    })

    renderWithPair()
    expect(screen.getByTestId('price-chart')).toBeInTheDocument()
  })

  // ─── AC: Current price rendering ─────────────────────────────

  it('renders the current price with formatting', async () => {
    const { useSwr } = await import('../hooks/useSwr')
    vi.mocked(useSwr).mockReturnValue({
      data: { ...mockPriceData, price: 50000 },
      loading: false,
      error: null,
      isValidating: false,
      refetch: vi.fn(),
    })

    renderWithPair()
    expect(screen.getByText('$50,000.00')).toBeInTheDocument()
  })

  // ─── AC: Confidence rendering ────────────────────────────────

  it('renders confidence as a percentage', async () => {
    const { useSwr } = await import('../hooks/useSwr')
    vi.mocked(useSwr).mockReturnValue({
      data: { ...mockPriceData, confidence: 0.99 },
      loading: false,
      error: null,
      isValidating: false,
      refetch: vi.fn(),
    })

    renderWithPair()
    expect(screen.getByText('99.0% confidence')).toBeInTheDocument()
  })

  it('renders high-confidence with green color class', async () => {
    const { useSwr } = await import('../hooks/useSwr')
    vi.mocked(useSwr).mockReturnValue({
      data: { ...mockPriceData, confidence: 0.95 },
      loading: false,
      error: null,
      isValidating: false,
      refetch: vi.fn(),
    })

    renderWithPair()
    const badge = screen.getByText('95.0% confidence')
    expect(badge.className).toContain('bg-green')
  })

  it('renders low-confidence with red color class', async () => {
    const { useSwr } = await import('../hooks/useSwr')
    vi.mocked(useSwr).mockReturnValue({
      data: { ...mockPriceData, confidence: 0.5 },
      loading: false,
      error: null,
      errorMessage: null,
      isValidating: false,
      refetch: vi.fn(),
    })

    renderWithPair()
    const badge = screen.getByText('50.0% confidence')
    expect(badge.className).toContain('bg-red')
  })

  // ─── AC: Timestamp rendering ─────────────────────────────────

  it('renders relative time since last update', async () => {
    const { useSwr } = await import('../hooks/useSwr')
    const now = Date.now()
    vi.mocked(useSwr).mockReturnValue({
      data: { ...mockPriceData, timestamp: now - 30_000 },
      loading: false,
      error: null,
      isValidating: false,
      refetch: vi.fn(),
    })

    renderWithPair()
    expect(screen.getByText(/Updated \d+s ago/)).toBeInTheDocument()
  })

  it('renders the full formatted timestamp', async () => {
    const { useSwr } = await import('../hooks/useSwr')
    const fixedDate = new Date('2024-01-15T12:30:45').getTime()
    vi.mocked(useSwr).mockReturnValue({
      data: { ...mockPriceData, timestamp: fixedDate },
      loading: false,
      error: null,
      isValidating: false,
      refetch: vi.fn(),
    })

    renderWithPair()
    expect(screen.getByText(/Jan 15/)).toBeInTheDocument()
  })

  // ─── Oracle sources ──────────────────────────────────────────

  it('renders oracle source badges', async () => {
    const { useSwr } = await import('../hooks/useSwr')
    vi.mocked(useSwr).mockReturnValue({
      data: { ...mockPriceData, sources: ['chainlink', 'redstone'] },
      loading: false,
      error: null,
      isValidating: false,
      refetch: vi.fn(),
    })

    renderWithPair()
    expect(screen.getByText('chainlink')).toBeInTheDocument()
    expect(screen.getByText('redstone')).toBeInTheDocument()
  })

  // ─── Chart error boundary tests (#269) ───────────────────────

  it('renders chart error fallback when PriceChart throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    shouldThrowChartError = true

    const { useSwr } = await import('../hooks/useSwr')
    vi.mocked(useSwr).mockReturnValue({
      data: mockPriceData,
      loading: false,
      error: null,
      isValidating: false,
      refetch: vi.fn(),
    })

    renderWithPair()

    // The chart error fallback should be rendered (lazy-loaded, resolves asynchronously)
    expect(await screen.findByRole('alert', { name: 'Chart rendering failed' })).toBeInTheDocument()
    expect(screen.getByText('Chart failed to load')).toBeInTheDocument()
    expect(
      screen.getByText('The price history chart encountered an error. Price data is still available above.'),
    ).toBeInTheDocument()

    spy.mockRestore()
  })

  it('still displays price data when chart throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    shouldThrowChartError = true

    const { useSwr } = await import('../hooks/useSwr')
    vi.mocked(useSwr).mockReturnValue({
      data: mockPriceData,
      loading: false,
      error: null,
      isValidating: false,
      refetch: vi.fn(),
    })

    renderWithPair()

    // Price data should still be visible despite chart crash
    expect(screen.getByRole('heading', { name: 'BTC/USD' })).toBeInTheDocument()
    expect(screen.getByText('$50,000.00')).toBeInTheDocument()
    expect(screen.getByText('99.0% confidence')).toBeInTheDocument()

    // Chart should NOT be rendered
    expect(screen.queryByTestId('price-chart')).not.toBeInTheDocument()

    spy.mockRestore()
  })

  it('renders chart normally when no error occurs', async () => {
    const { useSwr } = await import('../hooks/useSwr')
    vi.mocked(useSwr).mockReturnValue({
      data: mockPriceData,
      loading: false,
      error: null,
      isValidating: false,
      refetch: vi.fn(),
    })

    renderWithPair()

    // Chart should render (lazy-loaded, resolves asynchronously), error fallback should not
    expect(await screen.findByTestId('price-chart')).toBeInTheDocument()
    expect(screen.queryByRole('alert', { name: 'Chart rendering failed' })).not.toBeInTheDocument()

    // Price data rendered too
    expect(screen.getByRole('heading', { name: 'BTC/USD' })).toBeInTheDocument()
    expect(screen.getByText('$50,000.00')).toBeInTheDocument()
  })

  it('shows a price history table alongside the chart when data is loaded', async () => {
    const { useSwr } = await import('../hooks/useSwr')
    vi.mocked(useSwr).mockReturnValue({
      data: { assetPair: 'BTC/USD', price: 50000, timestamp: Date.now(), confidence: 0.99, sources: ['chainlink'] },
      loading: false,
      error: null,
      isValidating: false,
      refetch: vi.fn(),
    })
    const { usePriceHistory } = await import('../hooks/usePriceHistory')
    vi.mocked(usePriceHistory).mockReturnValue({
      ...defaultHistory,
      history: [{ price: 49500, timestamp: Date.now(), confidence: 0.99, sources: ['chainlink'] }],
    })

    renderWithPair()
    expect(await screen.findByTestId('price-chart')).toBeInTheDocument()
    const table = await screen.findByRole('table', { name: 'Price history table' })
    expect(table).toBeInTheDocument()
    expect(within(table).getByText('$49,500.00')).toBeInTheDocument()
  })

  it('shows an error message when price history fails to load', async () => {
    const { useSwr } = await import('../hooks/useSwr')
    vi.mocked(useSwr).mockReturnValue({
      data: { assetPair: 'BTC/USD', price: 50000, timestamp: Date.now(), confidence: 0.99, sources: ['chainlink'] },
      loading: false,
      error: null,
      isValidating: false,
      refetch: vi.fn(),
    })
    const { usePriceHistory } = await import('../hooks/usePriceHistory')
    vi.mocked(usePriceHistory).mockReturnValue({
      ...defaultHistory,
      error: new Error('Network error'),
    })

    renderWithPair()
    const alerts = screen.getAllByRole('alert')
    expect(alerts.some((el) => el.textContent?.includes('Network error'))).toBe(true)
    expect(screen.queryByRole('table', { name: 'Price history table' })).not.toBeInTheDocument()
  })

  // ─── Overview / Proof tabs ─────────────────────────────────────

  it('shows the Overview tab content by default', async () => {
    const { useSwr } = await import('../hooks/useSwr')
    vi.mocked(useSwr).mockReturnValue({
      data: mockPriceData,
      loading: false,
      error: null,
      isValidating: false,
      refetch: vi.fn(),
    })

    renderWithPair()
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Proof' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByTestId('price-chart')).toBeInTheDocument()
    expect(screen.queryByTestId('price-proof-panel')).not.toBeInTheDocument()
  })

  it('switches to the Proof tab and hides Overview content', async () => {
    const { useSwr } = await import('../hooks/useSwr')
    vi.mocked(useSwr).mockReturnValue({
      data: mockPriceData,
      loading: false,
      error: null,
      isValidating: false,
      refetch: vi.fn(),
    })

    renderWithPair()
    fireEvent.click(screen.getByRole('tab', { name: 'Proof' }))

    expect(await screen.findByTestId('price-proof-panel')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Proof' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByTestId('price-chart')).not.toBeInTheDocument()
  })
})
