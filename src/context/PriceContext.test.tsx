import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { PriceProvider, usePriceContext } from './PriceContext'
import { fetchPrice } from '../api/rest'

const mockConnect = vi.fn()
const mockDisconnect = vi.fn()
const mockSubscribe = vi.fn()
const mockUnsubscribe = vi.fn()
let messageHandler: ((msg: {
  type: 'price_update'
  assetPair: string
  price: number
  timestamp: number
  confidence: number
  sources: string[]
}) => void) | null = null

vi.mock('../hooks/useSwr', () => ({
  useSwr: vi.fn(() => ({
    data: [
      { assetPair: 'BTC/USD', price: 50000, timestamp: Date.now(), confidence: 0.99, sources: ['chainlink'] },
      { assetPair: 'ETH/USD', price: 3000, timestamp: Date.now(), confidence: 0.95, sources: ['redstone'] },
    ],
    loading: false,
    error: null,
    isValidating: false,
    refetch: vi.fn(),
  })),
}))

vi.mock('../api/rest', () => ({
  fetchAllPrices: vi.fn(),
  fetchPrice: vi.fn(),
}))

vi.mock('../api/websocket', () => ({
  WebSocketClient: vi.fn(() => ({
    status: 'connected',
    connect: mockConnect,
    disconnect: mockDisconnect,
    onMessage: vi.fn((handler) => {
      messageHandler = handler
      return vi.fn()
    }),
    onStatusChange: vi.fn(() => vi.fn()),
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
    send: vi.fn(),
  })),
}))

function TestConsumer() {
  const ctx = usePriceContext()
  const btcLive = ctx.livePrices.get('BTC/USD')
  return (
    <div>
      <span data-testid="price-count">{ctx.prices.length}</span>
      <span data-testid="loading">{String(ctx.pricesLoading)}</span>
      <span data-testid="ws-status">{ctx.wsStatus}</span>
      <span data-testid="live-size">{ctx.livePrices.size}</span>
      <span data-testid="btc-live-price">{btcLive?.data.price ?? 'none'}</span>
      <span data-testid="btc-live-state">{btcLive?.syncState ?? 'none'}</span>
    </div>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  messageHandler = null
  vi.mocked(fetchPrice).mockResolvedValue({
    assetPair: 'BTC/USD',
    price: 50010,
    timestamp: 1700000001000,
    confidence: 0.99,
    sources: ['chainlink'],
  })
})

afterEach(cleanup)

describe('PriceProvider', () => {
  it('renders children', () => {
    render(
      <PriceProvider>
        <div>child</div>
      </PriceProvider>,
    )
    expect(screen.getByText('child')).toBeInTheDocument()
  })

  it('provides price context to consumers', () => {
    render(
      <PriceProvider>
        <TestConsumer />
      </PriceProvider>,
    )
    expect(screen.getAllByTestId('price-count')[0].textContent).toBe('2')
    expect(screen.getAllByTestId('loading')[0].textContent).toBe('false')
  })

  it('provides default wsStatus as disconnected', () => {
    render(
      <PriceProvider>
        <TestConsumer />
      </PriceProvider>,
    )
    expect(screen.getAllByTestId('ws-status')[0].textContent).toBe('disconnected')
  })

  it('applies websocket updates optimistically before REST confirmation', async () => {
    render(
      <PriceProvider>
        <TestConsumer />
      </PriceProvider>,
    )

    act(() => {
      messageHandler?.({
        type: 'price_update',
        assetPair: 'BTC/USD',
        price: 50010,
        timestamp: 1700000001000,
        confidence: 0.99,
        sources: ['chainlink'],
      })
    })

    expect(screen.getByTestId('btc-live-price').textContent).toBe('50010')
    expect(screen.getByTestId('btc-live-state').textContent).toBe('optimistic')

    await waitFor(() => {
      expect(screen.getByTestId('btc-live-state').textContent).toBe('confirmed')
    })
  })

  it('rolls back when REST revalidation conflicts with the optimistic update', async () => {
    vi.mocked(fetchPrice).mockResolvedValueOnce({
      assetPair: 'BTC/USD',
      price: 49990,
      timestamp: 1700000002000,
      confidence: 0.97,
      sources: ['redstone'],
    })

    render(
      <PriceProvider>
        <TestConsumer />
      </PriceProvider>,
    )

    act(() => {
      messageHandler?.({
        type: 'price_update',
        assetPair: 'BTC/USD',
        price: 50010,
        timestamp: 1700000001000,
        confidence: 0.99,
        sources: ['chainlink'],
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('btc-live-state').textContent).toBe('rollback')
    })
    expect(screen.getByTestId('btc-live-price').textContent).toBe('49990')
  })
})

describe('usePriceContext', () => {
  it('throws when used outside provider', () => {
    function BadComponent() {
      usePriceContext()
      return null
    }

    expect(() => render(<BadComponent />)).toThrow(
      'usePriceContext must be used within a PriceProvider',
    )
  })
})
