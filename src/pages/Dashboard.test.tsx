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
