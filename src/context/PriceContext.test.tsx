import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PriceProvider, usePriceContext } from './PriceContext'

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

vi.mock('../api/websocket', () => ({
  WebSocketClient: vi.fn(() => ({
    status: 'connected',
    connect: vi.fn(),
    disconnect: vi.fn(),
    onMessage: vi.fn(() => vi.fn()),
    onStatusChange: vi.fn(() => vi.fn()),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    send: vi.fn(),
  })),
}))

function TestConsumer() {
  const ctx = usePriceContext()
  return (
    <div>
      <span data-testid="price-count">{ctx.prices.length}</span>
      <span data-testid="loading">{String(ctx.pricesLoading)}</span>
      <span data-testid="ws-status">{ctx.wsStatus}</span>
      <span data-testid="live-size">{ctx.livePrices.size}</span>
    </div>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

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
