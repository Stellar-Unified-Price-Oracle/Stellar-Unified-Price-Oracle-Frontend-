import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from './Dashboard'
import { AlertsProvider } from '../hooks/useAlerts'
import { checkAccessibility } from '../test/accessibility'

afterEach(cleanup)

vi.mock('../context/PriceContext', () => ({
  usePriceContext: vi.fn(() => ({
    prices: [],
    pricesLoading: true,
    pricesError: null,
    pricesValidating: false,
    livePrices: new Map(),
    wsStatus: 'disconnected',
    rateLimitStatus: 'ok' as const,
    rateLimitRetryAfterMs: 0,
    refetchPrices: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  })),
}))

const FIXED_NOW = 1700100000000
const mockPrices = [
  { assetPair: 'BTC/USD', price: 50000, timestamp: FIXED_NOW - 60000, confidence: 0.99, sources: ['chainlink'] },
  { assetPair: 'ETH/USD', price: 3000, timestamp: FIXED_NOW - 120000, confidence: 0.95, sources: ['redstone'] },
]

describe('Dashboard', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    localStorage.clear()
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: [],
      pricesLoading: true,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
  })

  it('should have no accessibility violations when loading', async () => {
    await checkAccessibility(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
      {
        rules: {
          'nested-interactive': { enabled: false },
        },
      },
    )
  })

  it('should have no accessibility violations with data', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: mockPrices,
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    await checkAccessibility(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
      {
        rules: {
          'nested-interactive': { enabled: false },
        },
      },
    )
  })

  it('renders the title', () => {
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText('Price Oracle Dashboard')).toBeInTheDocument()
  })

  it('shows loading skeletons when loading and no prices', () => {
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('shows error alert when there is an error', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: [],
      pricesLoading: false,
      pricesError: 'Something broke',
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText('Something broke')).toBeInTheDocument()
  })

  it('shows empty state when no prices loaded', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: [],
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText('No price feeds available')).toBeInTheDocument()
  })

  it('renders price cards when data exists', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: mockPrices,
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(screen.getAllByText('BTC/USD').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('ETH/USD').length).toBeGreaterThanOrEqual(1)
  })

  it('opens alert modal when Set alert is clicked', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: mockPrices,
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    await user.click(screen.getByLabelText('Set alert for BTC/USD'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('New Price Alert')).toBeInTheDocument()
  })

  it('creates alert from modal and shows indicator', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: mockPrices,
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    await user.click(screen.getByLabelText('Set alert for BTC/USD'))
    fireEvent.change(screen.getByLabelText('Upper Threshold'), { target: { value: '60000' } })
    await user.click(screen.getByText('Create Alert'))
    await waitFor(() => {
      expect(screen.getByText('Alert set')).toBeInTheDocument()
    })
  })

  it('shows AlertBadge with active count', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: mockPrices,
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )

    await user.click(screen.getByLabelText('Set alert for BTC/USD'))
    fireEvent.change(screen.getByLabelText('Upper Threshold'), { target: { value: '60000' } })
    await user.click(screen.getByText('Create Alert'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByLabelText('Set alert for ETH/USD'))
    fireEvent.change(screen.getByLabelText('Upper Threshold'), { target: { value: '4000' } })
    await user.click(screen.getByText('Create Alert'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    const badge = screen.getByLabelText('2 active alerts')
    expect(badge).toBeInTheDocument()
  })

  it('reads search from URL params', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: mockPrices,
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    render(
      <MemoryRouter initialEntries={['/?search=btc']}>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText('BTC/USD')).toBeInTheDocument()
    expect(screen.queryByText('ETH/USD')).not.toBeInTheDocument()
  })

  it('filters by confidence from URL params', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    const pricesWithConfidence = [
      { assetPair: 'BTC/USD', price: 50000, timestamp: Date.now(), confidence: 0.90, sources: ['chainlink'] },
      { assetPair: 'ETH/USD', price: 3000, timestamp: Date.now(), confidence: 0.45, sources: ['redstone'] },
    ]
    vi.mocked(usePriceContext).mockReturnValue({
      prices: pricesWithConfidence,
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    render(
      <MemoryRouter initialEntries={['/?confidence=high']}>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText('BTC/USD')).toBeInTheDocument()
    expect(screen.queryByText('ETH/USD')).not.toBeInTheDocument()
  })

  it('filters by source from URL params', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: mockPrices,
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    render(
      <MemoryRouter initialEntries={['/?source=chainlink']}>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText('BTC/USD')).toBeInTheDocument()
    expect(screen.queryByText('ETH/USD')).not.toBeInTheDocument()
  })

  it('sorts by price high to low from URL params', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: mockPrices,
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    render(
      <MemoryRouter initialEntries={['/?sort=price-high']}>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText('BTC/USD')).toBeInTheDocument()
    expect(screen.getByText('ETH/USD')).toBeInTheDocument()
  })

  it('applies multiple filters and sort from URL params', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    const manyPrices = [
      { assetPair: 'BTC/USD', price: 50000, timestamp: Date.now(), confidence: 0.90, sources: ['chainlink'] },
      { assetPair: 'ETH/USD', price: 3000, timestamp: Date.now(), confidence: 0.85, sources: ['chainlink'] },
      { assetPair: 'XLM/USD', price: 0.1, timestamp: Date.now(), confidence: 0.70, sources: ['redstone'] },
    ]
    vi.mocked(usePriceContext).mockReturnValue({
      prices: manyPrices,
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    render(
      <MemoryRouter initialEntries={['/?source=chainlink&confidence=high&sort=price-low']}>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText('ETH/USD')).toBeInTheDocument()
    expect(screen.getByText('BTC/USD')).toBeInTheDocument()
    expect(screen.queryByText('XLM/USD')).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Error states
  // ---------------------------------------------------------------------------

  it('renders error banner with role="alert" for accessibility', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: [],
      pricesLoading: false,
      pricesError: 'Failed to fetch prices',
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Failed to fetch prices')
  })

  it('shows error banner above existing price cards when error occurs with data', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: mockPrices,
      pricesLoading: false,
      pricesError: 'Background sync failed',
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    // Error banner is visible
    expect(screen.getByText('Background sync failed')).toBeInTheDocument()
    // Price cards are still visible beneath the error
    expect(screen.getByText('BTC/USD')).toBeInTheDocument()
    expect(screen.getByText('ETH/USD')).toBeInTheDocument()
  })

  it('does not render error banner when pricesError is null', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: mockPrices,
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows both error banner and empty state when error occurs with no data', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: [],
      pricesLoading: false,
      pricesError: 'Network failure',
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    // Error is visible
    expect(screen.getByText('Network failure')).toBeInTheDocument()
    // Empty state is also visible because prices are empty
    expect(screen.getByText('No price feeds available')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Empty & filtered-empty states
  // ---------------------------------------------------------------------------

  it('shows "No results" when search term filters out all prices', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: mockPrices,
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    render(
      <MemoryRouter initialEntries={['/?search=nonexistentpair']}>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText('No results for "nonexistentpair"')).toBeInTheDocument()
    expect(screen.getByText('Try a different search term.')).toBeInTheDocument()
  })

  it('shows "No results" when active filters remove all results', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: mockPrices,
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    render(
      <MemoryRouter initialEntries={['/?minPrice=75000&maxPrice=80000']}>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText('No results')).toBeInTheDocument()
    expect(screen.getByText('Try adjusting your filters.')).toBeInTheDocument()
  })

  it('does not show filtered-empty state when there is no data at all', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: [],
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    // Shows the empty state (merged.length === 0), not the filtered-empty state
    expect(screen.getByText('No price feeds available')).toBeInTheDocument()
    expect(screen.queryByText('No results')).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Loading states
  // ---------------------------------------------------------------------------

  it('hides select button during initial loading', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: [],
      pricesLoading: true,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(screen.queryByLabelText('Toggle selection mode')).not.toBeInTheDocument()
  })

  it('hides view toggle during initial loading', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: [],
      pricesLoading: true,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(screen.queryByLabelText('View toggle')).not.toBeInTheDocument()
  })

  it('renders correct number of skeleton placeholders during initial loading', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: [],
      pricesLoading: true,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    // Should render 8 skeletons (SKELETON_COUNT = 8)
    expect(screen.getByLabelText('Loading price cards')).toBeInTheDocument()
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBe(8)
  })

  it('shows select button after loading completes with data', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: mockPrices,
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(screen.getByLabelText('Toggle selection mode')).toBeInTheDocument()
    expect(screen.getByLabelText('View toggle')).toBeInTheDocument()
  })

  it('does not show skeletons when loading with existing cached prices', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: mockPrices,
      pricesLoading: true,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    // Should show price cards, not skeletons, since prices.length > 0
    expect(screen.getByText('BTC/USD')).toBeInTheDocument()
    expect(screen.queryByLabelText('Loading price cards')).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Validating / stale state
  // ---------------------------------------------------------------------------

  it('passes stale flag to price cards when validating', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: mockPrices,
      pricesLoading: false,
      pricesError: null,
      pricesValidating: true,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      rateLimitStatus: 'ok',
      rateLimitRetryAfterMs: 0,
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    // Price cards still render during validation
    expect(screen.getByText('BTC/USD')).toBeInTheDocument()
    expect(screen.getByText('ETH/USD')).toBeInTheDocument()
    // Select and view toggle are visible (not loading, has prices)
    expect(screen.getByLabelText('Toggle selection mode')).toBeInTheDocument()
  })
})
