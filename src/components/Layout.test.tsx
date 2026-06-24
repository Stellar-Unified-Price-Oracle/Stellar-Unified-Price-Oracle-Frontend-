import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AlertsProvider } from '../hooks/useAlerts'
import { Layout } from './Layout'

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

describe('Layout', () => {
  it('renders children', () => {
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Layout>
            <div>Test Content</div>
          </Layout>
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('renders the nav with Stellar Oracle brand', () => {
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Layout>
            <div />
          </Layout>
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText('Stellar Oracle')).toBeInTheDocument()
  })

  it('renders footer', () => {
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Layout>
            <div />
          </Layout>
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(screen.getByText((content) => content.includes('Developer Portal'))).toBeInTheDocument()
  })

  it('renders Dashboard nav link', () => {
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Layout>
            <div />
          </Layout>
        </AlertsProvider>
      </MemoryRouter>,
    )
    const links = screen.getAllByText('Dashboard')
    expect(links.length).toBeGreaterThanOrEqual(1)
  })

  it('has a mobile menu button with aria-label', () => {
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Layout>
            <div />
          </Layout>
        </AlertsProvider>
      </MemoryRouter>,
    )
    const buttons = screen.getAllByLabelText('Toggle menu')
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })
})

describe('snapshots', () => {
  it('default', () => {
    const { container } = render(
      <MemoryRouter>
        <AlertsProvider>
          <Layout>
            <div>Content</div>
          </Layout>
        </AlertsProvider>
      </MemoryRouter>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
