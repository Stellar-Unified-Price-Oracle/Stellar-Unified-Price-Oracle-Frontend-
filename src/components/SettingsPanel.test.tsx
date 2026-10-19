import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { PreferencesProvider } from '../preferences/PreferencesContext'
import {
  saveAnalyticsConsent,
  getAnalyticsConsent,
  acceptAllAnalyticsConsent,
  DEFAULT_ANALYTICS_CONSENT,
} from '../utils/analyticsConsent'
import { SettingsPanel } from './SettingsPanel'

vi.mock('../context/PriceContext', () => ({
  usePriceContext: () => ({
    clearPriceCache: vi.fn(),
  }),
}))

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <PreferencesProvider>
        {ui}
      </PreferencesProvider>
    </MemoryRouter>
  )
}

describe('SettingsPanel - Privacy & Granular Analytics Controls', () => {
  beforeEach(() => {
    localStorage.clear()
    saveAnalyticsConsent({ ...DEFAULT_ANALYTICS_CONSENT, hasExplicitChoice: true })
    vi.restoreAllMocks()
  })

  it('renders Privacy section with master toggle and granular categories', () => {
    renderWithProviders(<SettingsPanel onClose={vi.fn()} />)

    expect(screen.getByRole('heading', { name: /privacy/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/product analytics/i)).toBeInTheDocument()
    expect(screen.getByText('Granular Data Categories')).toBeInTheDocument()

    expect(screen.getByLabelText('Navigation & Page Views')).toBeInTheDocument()
    expect(screen.getByLabelText('Feature Usage & Interactions')).toBeInTheDocument()
    expect(screen.getByLabelText('Performance & Diagnostics')).toBeInTheDocument()
    expect(screen.getByLabelText('UI Engagement & Usability')).toBeInTheDocument()
  })

  it('toggling master analytics switches telemetry on/off and disables categories', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPanel onClose={vi.fn()} />)

    const masterToggle = screen.getByLabelText(/product analytics/i)
    expect(masterToggle).toBeChecked()

    // Toggle master off
    await user.click(masterToggle)
    expect(masterToggle).not.toBeChecked()

    const consent = getAnalyticsConsent()
    expect(consent.enabled).toBe(false)

    // Category toggles should now be disabled
    expect(screen.getByLabelText('Navigation & Page Views')).toBeDisabled()
    expect(screen.getByLabelText('Feature Usage & Interactions')).toBeDisabled()
  })

  it('toggling individual category updates granular consent', async () => {
    const user = userEvent.setup()
    acceptAllAnalyticsConsent()
    renderWithProviders(<SettingsPanel onClose={vi.fn()} />)

    const featureToggle = screen.getByLabelText('Feature Usage & Interactions')
    expect(featureToggle).toBeChecked()

    await user.click(featureToggle)
    expect(featureToggle).not.toBeChecked()

    const consent = getAnalyticsConsent()
    expect(consent.categories.feature).toBe(false)
    expect(consent.categories.navigation).toBe(true)
  })

  it('All and None quick action buttons update all categories', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPanel onClose={vi.fn()} />)

    // Click None
    const noneBtn = screen.getByRole('button', { name: /opt out of all analytics categories/i })
    await user.click(noneBtn)

    let consent = getAnalyticsConsent()
    expect(consent.enabled).toBe(false)

    // Turn master back on
    const masterToggle = screen.getByLabelText(/product analytics/i)
    await user.click(masterToggle)

    // Click All
    const allBtn = screen.getByRole('button', { name: /opt in to all analytics categories/i })
    await user.click(allBtn)

    consent = getAnalyticsConsent()
    expect(consent.enabled).toBe(true)
    expect(Object.values(consent.categories).every(Boolean)).toBe(true)
  })

  it('reset categories button restores default configuration', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsPanel onClose={vi.fn()} />)

    const resetBtn = screen.getByRole('button', { name: /reset categories to defaults/i })
    await user.click(resetBtn)

    const consent = getAnalyticsConsent()
    expect(consent.categories.feature).toBe(DEFAULT_ANALYTICS_CONSENT.categories.feature)
  })
})
