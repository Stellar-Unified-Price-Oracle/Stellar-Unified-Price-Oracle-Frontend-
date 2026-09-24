import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { AlertsProvider } from '../hooks/useAlerts'
import { checkAccessibility } from '../test/accessibility'
import { Layout } from './Layout'

function renderLayout(children: ReactNode = <div>Test Content</div>) {
  return render(
    <MemoryRouter>
      <AlertsProvider>
        <Layout>{children}</Layout>
      </AlertsProvider>
    </MemoryRouter>,
  )
}

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

vi.mock('./SettingsPanel', () => ({
  SettingsPanel: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="settings-panel">
      <button onClick={onClose}>Close settings</button>
    </div>
  ),
}))

vi.mock('../wallet/WalletContext', () => ({
  useWallet: vi.fn(() => ({
    status: 'disconnected',
    address: null,
    network: null,
    networkPassphrase: null,
    balance: null,
    balanceLoading: false,
    error: null,
    errorCode: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    refreshBalance: vi.fn(),
    signTransaction: vi.fn(),
  })),
}))

describe('Layout', () => {
  it('should have no accessibility violations', async () => {
    await checkAccessibility(
      <MemoryRouter>
        <AlertsProvider>
          <Layout>
            <div>Test Content</div>
          </Layout>
        </AlertsProvider>
      </MemoryRouter>,
    )
  })

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
    expect(screen.getAllByText('Stellar Oracle').length).toBeGreaterThanOrEqual(1)
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

  it('loads the settings panel only after the settings action', async () => {
    renderLayout()

    expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

    expect(await screen.findByTestId('settings-panel')).toBeInTheDocument()
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

  it('does not render a hamburger menu button (replaced by bottom nav)', () => {
    render(
      <MemoryRouter>
        <AlertsProvider>
          <Layout>
            <div />
          </Layout>
        </AlertsProvider>
      </MemoryRouter>,
    )
    // The hamburger "Toggle menu" button is no longer present — mobile
    // navigation is handled by the bottom navigation bar instead.
    expect(screen.queryByLabelText('Toggle menu')).not.toBeInTheDocument()
  })

  it('highlights the active nav link based on current route', () => {
    render(
      <MemoryRouter initialEntries={['/api-docs']}>
        <AlertsProvider>
          <Layout>
            <div />
          </Layout>
        </AlertsProvider>
      </MemoryRouter>,
    )
    const activeLinks = screen.getAllByRole('link', { name: 'API Docs' })
    activeLinks.forEach((link) => {
      expect(link.className).toMatch(/text-cyan/)
    })
    const inactiveLinks = screen.getAllByRole('link', { name: 'Dashboard' })
    inactiveLinks.forEach((link) => {
      expect(link.className).not.toMatch(/text-cyan/)
    })
  })

  describe('desktop navigation', () => {
    it('renders the desktop nav links to Dashboard and API Docs', () => {
      renderLayout()

      const nav = screen.getByRole('navigation', { name: 'Main navigation' })
      const desktopNav = nav.querySelector('.hidden.sm\\:flex')
      expect(desktopNav).not.toBeNull()

      const { getByRole } = within(desktopNav as HTMLElement)
      expect(getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
      expect(getByRole('link', { name: 'API Docs' })).toBeInTheDocument()
    })
  })

  describe('mobile bottom navigation bar (#292)', () => {
    it('renders a bottom navigation bar with Dashboard and API Docs links', () => {
      renderLayout()

      const mobileNav = screen.getByRole('navigation', { name: 'Mobile navigation' })
      expect(mobileNav).toBeInTheDocument()

      const { getAllByRole } = within(mobileNav)
      const links = getAllByRole('link')
      const linkTexts = links.map((l) => l.textContent ?? '')
      expect(linkTexts.some((t) => t.includes('Dashboard'))).toBe(true)
      expect(linkTexts.some((t) => t.includes('API Docs'))).toBe(true)
    })

    it('renders an Alerts button in the bottom navigation bar', () => {
      renderLayout()

      const mobileNav = screen.getByRole('navigation', { name: 'Mobile navigation' })
      const alertsBtn = within(mobileNav).getByLabelText('Toggle price alerts')
      expect(alertsBtn).toBeInTheDocument()
    })

    it('renders nav links in both the top bar and the bottom bar', () => {
      renderLayout()
      // With the bottom bar always visible, Dashboard appears in both navbars
      expect(screen.getAllByRole('link', { name: /Dashboard/i }).length).toBeGreaterThanOrEqual(2)
      expect(screen.getAllByRole('link', { name: /API Docs/i }).length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('children', () => {
    it('renders children inside the main landmark', () => {
      renderLayout(<div>Test Content</div>)

      const main = screen.getByRole('main')
      expect(within(main).getByText('Test Content')).toBeInTheDocument()
    })
  })

  describe('accessibility landmarks', () => {
    it('renders main navigation, mobile navigation, main, and footer landmarks', () => {
      renderLayout()

      expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
      expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument()
      expect(screen.getByRole('main')).toBeInTheDocument()
      // footer is in the DOM but visually hidden on mobile via CSS
      expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    })
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
