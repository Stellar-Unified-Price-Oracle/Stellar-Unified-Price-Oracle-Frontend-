import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { AlertsProvider } from '../hooks/useAlerts'
import { Layout } from './Layout'
import { checkAccessibility } from '../test/accessibility'

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

    it('does not render the mobile dropdown nav when the menu is closed', () => {
      renderLayout()

      expect(screen.getAllByRole('link', { name: 'Dashboard' })).toHaveLength(1)
      expect(screen.getAllByRole('link', { name: 'API Docs' })).toHaveLength(1)
    })
  })

  describe('mobile hamburger menu', () => {
    it('opens the mobile dropdown nav when the hamburger button is clicked', async () => {
      const user = userEvent.setup()
      renderLayout()

      expect(screen.getAllByRole('link', { name: 'Dashboard' })).toHaveLength(1)

      await user.click(screen.getByLabelText('Toggle menu'))

      // Once open, the mobile dropdown renders a second copy of each nav link
      // alongside the always-present desktop copy.
      expect(screen.getAllByRole('link', { name: 'Dashboard' })).toHaveLength(2)
      expect(screen.getAllByRole('link', { name: 'API Docs' })).toHaveLength(2)
    })

    it('closes the mobile dropdown nav when a mobile nav link is clicked', async () => {
      const user = userEvent.setup()
      renderLayout()

      await user.click(screen.getByLabelText('Toggle menu'))
      const mobileDashboardLink = screen.getAllByRole('link', { name: 'Dashboard' })[1]

      await user.click(mobileDashboardLink)

      expect(screen.getAllByRole('link', { name: 'Dashboard' })).toHaveLength(1)
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
    it('renders nav, main, and footer landmarks', () => {
      renderLayout()

      expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
      expect(screen.getByRole('main')).toBeInTheDocument()
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
