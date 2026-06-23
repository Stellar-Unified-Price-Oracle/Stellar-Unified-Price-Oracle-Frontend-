import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from './Dashboard'
import { AlertsProvider } from '../hooks/useAlerts'

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: (i: number) => number }) => {
    const items = Array.from({ length: count }, (_, i) => {
      const size = estimateSize(i)
      const start = i * size
      return { key: i, index: i, start, end: start + size, size, lane: 0 }
    })
    return {
      getVirtualItems: () => items,
      getTotalSize: () => items.reduce((total, item) => total + item.size, 0),
      measure: () => {},
    }
  },
}))

vi.mock('../preferences/PreferencesContext', () => ({
  usePreferences: vi.fn(() => ({
    preferences: { refreshInterval: 10000, chartTimeRange: '24h', staleThresholdMinutes: 5, dashboardView: 'card', cardOrder: [] },
    updatePreference: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
    clearHistory: vi.fn(),
  })),
}))

afterEach(cleanup)

vi.mock('../context/PriceContext', () => ({
  usePriceContext: vi.fn(() => ({
    prices: [],
    pricesLoading: true,
    pricesError: null,
    pricesValidating: false,
    livePrices: new Map(),
    wsStatus: 'disconnected',
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
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
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
    const emptyTexts = screen.getAllByText('No price feeds available')
    expect(emptyTexts).toHaveLength(1)
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

  it('shows search input when prices are loaded', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: mockPrices,
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
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
    expect(screen.getByPlaceholderText('Search by asset pair...')).toBeInTheDocument()
  })

  it('filters price cards by search query', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: mockPrices,
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
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

    const searchInput = screen.getByPlaceholderText('Search by asset pair...')
    await user.type(searchInput, 'btc')

    expect(screen.getByText('BTC/USD')).toBeInTheDocument()
    expect(screen.queryByText('ETH/USD')).not.toBeInTheDocument()
  })

  it('shows no results message when search matches nothing', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: mockPrices,
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
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

    const searchInput = screen.getByPlaceholderText('Search by asset pair...')
    await user.type(searchInput, 'zzz')

    expect(screen.queryByText('BTC/USD')).not.toBeInTheDocument()
    expect(screen.queryByText('ETH/USD')).not.toBeInTheDocument()
    expect(screen.getByText(/No results for/)).toBeInTheDocument()
  })

  it('does not show search input while loading', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: [],
      pricesLoading: true,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
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
    expect(screen.queryByPlaceholderText('Search by asset pair...')).not.toBeInTheDocument()
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
      { assetPair: 'BTC/USD', price: 50000, timestamp: Date.now(), confidence: 90, sources: ['chainlink'] },
      { assetPair: 'ETH/USD', price: 3000, timestamp: Date.now(), confidence: 45, sources: ['redstone'] },
    ]
    vi.mocked(usePriceContext).mockReturnValue({
      prices: pricesWithConfidence,
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
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
      { assetPair: 'BTC/USD', price: 50000, timestamp: Date.now(), confidence: 90, sources: ['chainlink'] },
      { assetPair: 'ETH/USD', price: 3000, timestamp: Date.now(), confidence: 85, sources: ['chainlink'] },
      { assetPair: 'XLM/USD', price: 0.1, timestamp: Date.now(), confidence: 70, sources: ['redstone'] },
    ]
    vi.mocked(usePriceContext).mockReturnValue({
      prices: manyPrices,
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
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
})

describe('snapshots', () => {
  beforeEach(async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700100000000)
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: [],
      pricesLoading: true,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })
  it('loading', () => {
    const { container } = render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('error', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: [],
      pricesLoading: false,
      pricesError: 'Failed to fetch prices',
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    const { container } = render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('empty', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: [],
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    const { container } = render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('with data', async () => {
    const { usePriceContext } = await import('../context/PriceContext')
    vi.mocked(usePriceContext).mockReturnValue({
      prices: mockPrices,
      pricesLoading: false,
      pricesError: null,
      pricesValidating: false,
      livePrices: new Map(),
      wsStatus: 'disconnected',
      refetchPrices: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })
    const { container } = render(
      <MemoryRouter>
        <AlertsProvider>
          <Dashboard />
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
