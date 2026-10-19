import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, beforeEach } from 'vitest'
import { axe } from 'vitest-axe'
import { AnalyticsConsentBanner } from './AnalyticsConsentBanner'
import {
  getAnalyticsConsent,
  saveAnalyticsConsent,
  acceptAllAnalyticsConsent,
  DEFAULT_ANALYTICS_CONSENT,
} from '../utils/analyticsConsent'

describe('AnalyticsConsentBanner', () => {
  beforeEach(() => {
    localStorage.clear()
    saveAnalyticsConsent({ ...DEFAULT_ANALYTICS_CONSENT, hasExplicitChoice: false })
  })

  it('renders when user has not made an explicit choice', () => {
    render(<AnalyticsConsentBanner />)
    expect(screen.getByRole('region', { name: 'Analytics & Privacy Choices' })).toBeInTheDocument()
    expect(screen.getByText('Privacy & Analytics Preferences')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decline All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Customize Categories' })).toBeInTheDocument()
  })

  it('does not render when user has already made an explicit choice', () => {
    acceptAllAnalyticsConsent()
    const { container } = render(<AnalyticsConsentBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('clicking Accept All grants consent and hides the banner', async () => {
    const user = userEvent.setup()
    render(<AnalyticsConsentBanner />)

    const acceptBtn = screen.getByRole('button', { name: 'Accept All' })
    await user.click(acceptBtn)

    const consent = getAnalyticsConsent()
    expect(consent.enabled).toBe(true)
    expect(consent.hasExplicitChoice).toBe(true)
    expect(consent.categories.navigation).toBe(true)
    expect(consent.categories.feature).toBe(true)
    expect(screen.queryByRole('region', { name: 'Analytics & Privacy Choices' })).not.toBeInTheDocument()
  })

  it('clicking Decline All opts out of all telemetry and hides banner', async () => {
    const user = userEvent.setup()
    render(<AnalyticsConsentBanner />)

    const declineBtn = screen.getByRole('button', { name: 'Decline All' })
    await user.click(declineBtn)

    const consent = getAnalyticsConsent()
    expect(consent.enabled).toBe(false)
    expect(consent.hasExplicitChoice).toBe(true)
    expect(screen.queryByRole('region', { name: 'Analytics & Privacy Choices' })).not.toBeInTheDocument()
  })

  it('allows customizing granular categories inline', async () => {
    const user = userEvent.setup()
    render(<AnalyticsConsentBanner />)

    await user.click(screen.getByRole('button', { name: 'Customize Categories' }))

    expect(screen.getByText('Granular Category Controls:')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Navigation & Page Views' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Feature Usage & Interactions' })).toBeChecked()

    // Uncheck feature usage
    await user.click(screen.getByRole('checkbox', { name: 'Feature Usage & Interactions' }))
    expect(screen.getByRole('checkbox', { name: 'Feature Usage & Interactions' })).not.toBeChecked()

    // Save preferences
    await user.click(screen.getByRole('button', { name: 'Save Preferences' }))

    const consent = getAnalyticsConsent()
    expect(consent.enabled).toBe(true)
    expect(consent.categories.feature).toBe(false)
    expect(consent.categories.navigation).toBe(true)
    expect(consent.hasExplicitChoice).toBe(true)
    expect(screen.queryByRole('region', { name: 'Analytics & Privacy Choices' })).not.toBeInTheDocument()
  })

  it('has no accessibility violations (a11y/axe)', async () => {
    const { container } = render(<AnalyticsConsentBanner />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
