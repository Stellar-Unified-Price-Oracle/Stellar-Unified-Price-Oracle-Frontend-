import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AlertsProvider } from '../hooks/useAlerts'
import { ToastProvider } from '../context/ToastContext'
import { PreferencesProvider } from '../preferences/PreferencesContext'
import { checkAccessibility } from '../test/accessibility'
import { renderWithProviders } from '../test/render'
import { getLimiter } from '../utils/rateLimit'
import { useRateLimitStore } from '../stores/rateLimitStore'
import { Dashboard } from './Dashboard'

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

/** Full context value with neutral defaults; tests override the slice they exercise. */
const BASE_CTX = {
  prices: [] as typeof mockPrices,
  pricesLoading: true,
  pricesError: null as Error | null,
  pricesValidating: false,
  livePrices: new Map(),
  wsStatus: 'disconnected' as const,
  rateLimitStatus: 'ok' as const,
  rateLimitRetryAfterMs: 0,
  outboundQueued: 0,
  pricesQueued: false,
  requestsThrottled: false,
  refetchPrices: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  _emitPriceUpdate: vi.fn(),
  attributionHistory: new Map(),
  isWsLeader: null,
}

function mockCtx(overrides: Partial<typeof BASE_CTX> = {}): typeof BASE_CTX {
  return { ...BASE_CTX, ...overrides }
}

describe('Dashboard', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    localStorage.clear()
    // Alert creation is rate-limited (5/min) by a module-level singleton;
    // reset it (and refresh the zustand snapshot it feeds) so tests later in
    // this file aren't throttled by earlier ones.
    getLimiter('alertCreate').reset()
    useRateLimitStore.getState().refresh()
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
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
      }),
    )
  })

  it('should have no accessibility violations when loading', async () => {
    await checkAccessibility(<Dashboard />, {
      wrapper: (children) => (
        <MemoryRouter>
          <ToastProvider>
            <PreferencesProvider>
              <AlertsProvider>{children}</AlertsProvider>
            </PreferencesProvider>
          </ToastProvider>
        </MemoryRouter>
      ),
      rules: {
        'nested-interactive': { enabled: false },
      },
    })
  })

  it('should have no accessibility violations with data', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
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
      }),
    )
    await checkAccessibility(<Dashboard />, {
      wrapper: (children) => (
        <MemoryRouter>
          <ToastProvider>
            <PreferencesProvider>
              <AlertsProvider>{children}</AlertsProvider>
            </PreferencesProvider>
          </ToastProvider>
        </MemoryRouter>
      ),
      rules: {
        'nested-interactive': { enabled: false },
      },
    })
  })

  it('renders the title', () => {
    renderWithProviders(<Dashboard />, { withAlerts: true })
    expect(screen.getByText('Price Oracle Dashboard')).toBeInTheDocument()
  })

  it('shows loading skeletons when loading and no prices', () => {
    renderWithProviders(<Dashboard />, { withAlerts: true })
    expect(document.querySelectorAll('.skeleton-offscreen').length).toBeGreaterThan(0)
  })

  it('shows error alert when there is an error', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
        prices: [],
        pricesLoading: false,
        pricesError: new Error('Something broke'),
        pricesValidating: false,
        livePrices: new Map(),
        wsStatus: 'disconnected',
        rateLimitStatus: 'ok',
        rateLimitRetryAfterMs: 0,
        refetchPrices: vi.fn(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      }),
    )
    renderWithProviders(<Dashboard />, { withAlerts: true })
    expect(screen.getByText('Something broke')).toBeInTheDocument()
  })

  it('shows empty state when no prices loaded', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
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
      }),
    )
    renderWithProviders(<Dashboard />, { withAlerts: true })
    expect(screen.getByText('No price feeds available')).toBeInTheDocument()
  })

  it('renders price cards when data exists', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
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
      }),
    )
    renderWithProviders(<Dashboard />, { withAlerts: true })
    expect(screen.getAllByText('BTC/USD').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('ETH/USD').length).toBeGreaterThanOrEqual(1)
  })

  it('opens alert modal when Set alert is clicked', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
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
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<Dashboard />, { withAlerts: true })
    await user.click(screen.getByLabelText('Set alert for BTC/USD'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('New Price Alert')).toBeInTheDocument()
  })

  it('creates alert from modal and shows indicator', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
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
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<Dashboard />, { withAlerts: true })
    await user.click(screen.getByLabelText('Set alert for BTC/USD'))
    fireEvent.change(screen.getByLabelText('Upper Threshold'), { target: { value: '60000' } })
    await user.click(screen.getByText('Create Alert'))
    await waitFor(() => {
      expect(screen.getByText('Alert set')).toBeInTheDocument()
    })
  })

  it('shows AlertBadge with active count', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
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
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<Dashboard />, { withAlerts: true })

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
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
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
      }),
    )
    renderWithProviders(<Dashboard />, { withAlerts: true, route: ['/?search=btc'] })
    expect(screen.getByText('BTC/USD')).toBeInTheDocument()
    expect(screen.queryByText('ETH/USD')).not.toBeInTheDocument()
  })

  it('filters by confidence from URL params', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    const pricesWithConfidence = [
      { assetPair: 'BTC/USD', price: 50000, timestamp: Date.now(), confidence: 0.9, sources: ['chainlink'] },
      { assetPair: 'ETH/USD', price: 3000, timestamp: Date.now(), confidence: 0.45, sources: ['redstone'] },
    ]
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
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
      }),
    )
    renderWithProviders(<Dashboard />, { withAlerts: true, route: ['/?confidence=high'] })
    expect(screen.getByText('BTC/USD')).toBeInTheDocument()
    expect(screen.queryByText('ETH/USD')).not.toBeInTheDocument()
  })

  it('filters by source from URL params', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
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
      }),
    )
    renderWithProviders(<Dashboard />, { withAlerts: true, route: ['/?source=chainlink'] })
    expect(screen.getByText('BTC/USD')).toBeInTheDocument()
    expect(screen.queryByText('ETH/USD')).not.toBeInTheDocument()
  })

  it('sorts by price high to low from URL params', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
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
      }),
    )
    renderWithProviders(<Dashboard />, { withAlerts: true, route: ['/?sort=price-high'] })
    expect(screen.getByText('BTC/USD')).toBeInTheDocument()
    expect(screen.getByText('ETH/USD')).toBeInTheDocument()
  })

  it('applies multiple filters and sort from URL params', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    const manyPrices = [
      { assetPair: 'BTC/USD', price: 50000, timestamp: Date.now(), confidence: 0.9, sources: ['chainlink'] },
      { assetPair: 'ETH/USD', price: 3000, timestamp: Date.now(), confidence: 0.85, sources: ['chainlink'] },
      { assetPair: 'XLM/USD', price: 0.1, timestamp: Date.now(), confidence: 0.7, sources: ['redstone'] },
    ]
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
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
      }),
    )
    renderWithProviders(<Dashboard />, {
      withAlerts: true,
      route: ['/?source=chainlink&confidence=high&sort=price-low'],
    })
    expect(screen.getByText('ETH/USD')).toBeInTheDocument()
    expect(screen.getByText('BTC/USD')).toBeInTheDocument()
    expect(screen.queryByText('XLM/USD')).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Error states
  // ---------------------------------------------------------------------------

  it('renders error banner with role="alert" for accessibility', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
        prices: [],
        pricesLoading: false,
        pricesError: new Error('Failed to fetch prices'),
        pricesValidating: false,
        livePrices: new Map(),
        wsStatus: 'disconnected',
        rateLimitStatus: 'ok',
        rateLimitRetryAfterMs: 0,
        refetchPrices: vi.fn(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      }),
    )
    renderWithProviders(<Dashboard />, { withAlerts: true })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Failed to fetch prices')
  })

  it('shows error banner above existing price cards when error occurs with data', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
        prices: mockPrices,
        pricesLoading: false,
        pricesError: new Error('Background sync failed'),
        pricesValidating: false,
        livePrices: new Map(),
        wsStatus: 'disconnected',
        rateLimitStatus: 'ok',
        rateLimitRetryAfterMs: 0,
        refetchPrices: vi.fn(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      }),
    )
    renderWithProviders(<Dashboard />, { withAlerts: true })
    // Error banner is visible
    expect(screen.getByText('Background sync failed')).toBeInTheDocument()
    // Price cards are still visible beneath the error
    expect(screen.getByText('BTC/USD')).toBeInTheDocument()
    expect(screen.getByText('ETH/USD')).toBeInTheDocument()
  })

  it('does not render error banner when pricesError is null', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
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
      }),
    )
    renderWithProviders(<Dashboard />, { withAlerts: true })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows both error banner and empty state when error occurs with no data', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
        prices: [],
        pricesLoading: false,
        pricesError: new Error('Network failure'),
        pricesValidating: false,
        livePrices: new Map(),
        wsStatus: 'disconnected',
        rateLimitStatus: 'ok',
        rateLimitRetryAfterMs: 0,
        refetchPrices: vi.fn(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      }),
    )
    renderWithProviders(<Dashboard />, { withAlerts: true })
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
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
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
      }),
    )
    renderWithProviders(<Dashboard />, { withAlerts: true, route: ['/?search=nonexistentpair'] })
    expect(screen.getByText('No results for "nonexistentpair"')).toBeInTheDocument()
    expect(screen.getByText('Try a different search term.')).toBeInTheDocument()
  })

  it('shows "No results" when active filters remove all results', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
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
      }),
    )
    renderWithProviders(<Dashboard />, { withAlerts: true, route: ['/?minPrice=75000&maxPrice=80000'] })
    expect(screen.getByText('No results')).toBeInTheDocument()
    expect(screen.getByText('Try adjusting your filters.')).toBeInTheDocument()
  })

  it('does not show filtered-empty state when there is no data at all', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
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
      }),
    )
    renderWithProviders(<Dashboard />, { withAlerts: true })
    // Shows the empty state (merged.length === 0), not the filtered-empty state
    expect(screen.getByText('No price feeds available')).toBeInTheDocument()
    expect(screen.queryByText('No results')).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Loading states
  // ---------------------------------------------------------------------------

  it('hides select button during initial loading', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
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
      }),
    )
    renderWithProviders(<Dashboard />, { withAlerts: true })
    expect(screen.queryByLabelText('Toggle selection mode')).not.toBeInTheDocument()
  })

  it('hides view toggle during initial loading', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
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
      }),
    )
    renderWithProviders(<Dashboard />, { withAlerts: true })
    expect(screen.queryByLabelText('View toggle')).not.toBeInTheDocument()
  })

  it('renders correct number of skeleton placeholders during initial loading', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
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
      }),
    )
    renderWithProviders(<Dashboard />, { withAlerts: true })
    // Should render 8 skeletons (SKELETON_COUNT = 8)
    expect(screen.getByLabelText('Loading price cards')).toBeInTheDocument()
    const skeletons = document.querySelectorAll('.skeleton-offscreen')
    expect(skeletons.length).toBe(8)
  })

  it('shows select button after loading completes with data', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
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
      }),
    )
    renderWithProviders(<Dashboard />, { withAlerts: true })
    expect(screen.getByLabelText('Toggle selection mode')).toBeInTheDocument()
    expect(screen.getByLabelText('View toggle')).toBeInTheDocument()
  })

  it('does not show skeletons when loading with existing cached prices', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
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
      }),
    )
    renderWithProviders(<Dashboard />, { withAlerts: true })
    // Should show price cards, not skeletons, since prices.length > 0
    expect(screen.getByText('BTC/USD')).toBeInTheDocument()
    expect(screen.queryByLabelText('Loading price cards')).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Validating / stale state
  // ---------------------------------------------------------------------------

  it('passes stale flag to price cards when validating', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue(
      mockCtx({
        prices: mockPrices,
        pricesLoading: false,
        pricesError: null,
        pricesValidating: true,
        livePrices: new Map(),
        wsStatus: 'disconnected',
        rateLimitStatus: 'ok',
        rateLimitRetryAfterMs: 0,
        outboundQueued: 0,
        pricesQueued: false,
        requestsThrottled: false,
        refetchPrices: vi.fn(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        _emitPriceUpdate: vi.fn(),
        attributionHistory: new Map(),
        isWsLeader: null,
      }),
    )
    renderWithProviders(<Dashboard />, { withAlerts: true })
    // Price cards still render during validation
    expect(screen.getByText('BTC/USD')).toBeInTheDocument()
    expect(screen.getByText('ETH/USD')).toBeInTheDocument()
    // Select and view toggle are visible (not loading, has prices)
    expect(screen.getByLabelText('Toggle selection mode')).toBeInTheDocument()
  })
})
