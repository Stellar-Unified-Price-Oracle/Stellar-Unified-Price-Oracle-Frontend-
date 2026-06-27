import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, act } from '@testing-library/react'
import { NetworkStatusBanner } from './NetworkStatusBanner'
import { checkAccessibility } from '../test/accessibility'

afterEach(cleanup)

describe('NetworkStatusBanner', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { onLine: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should have no accessibility violations when offline', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    await checkAccessibility(<NetworkStatusBanner />)
  })

  it('does not render when online', () => {
    const { container } = render(<NetworkStatusBanner />)
    expect(container.innerHTML).toBe('')
  })

  it('renders when offline', () => {
    vi.stubGlobal('navigator', { onLine: false })
    render(<NetworkStatusBanner />)
    expect(screen.getByText('No internet connection')).toBeInTheDocument()
  })

  it('shows and hides on online/offline events', () => {
    const { container } = render(<NetworkStatusBanner />)
    expect(container.innerHTML).toBe('')
    act(() => { window.dispatchEvent(new Event('offline')) })
    expect(screen.getAllByText('No internet connection').length).toBeGreaterThanOrEqual(1)
    act(() => { window.dispatchEvent(new Event('online')) })
    expect(container.querySelector('[role="alert"]')).not.toBeInTheDocument()
  })
})

describe('snapshots', () => {
  it('offline', () => {
    vi.stubGlobal('navigator', { onLine: false })
    const { container } = render(<NetworkStatusBanner />)
    expect(container.firstChild).toMatchSnapshot()
    vi.unstubAllGlobals()
  })
})
