import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { checkAccessibility } from '../test/accessibility'
import { STORAGE_KEYS } from '../utils/storage'
import { InstallPrompt } from './InstallPrompt'

function dispatchInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted', prompt = vi.fn()) {
  const event = new Event('beforeinstallprompt', { cancelable: true })
  Object.assign(event, {
    prompt,
    userChoice: Promise.resolve({ outcome }),
  })
  act(() => {
    window.dispatchEvent(event)
  })
  return { event, prompt }
}

describe('InstallPrompt', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(cleanup)

  it('explains the install value and invokes the browser install prompt', async () => {
    render(<InstallPrompt />)
    const { event, prompt } = dispatchInstallPrompt()

    expect(event.defaultPrevented).toBe(true)
    expect(screen.getByRole('region', { name: 'Install Stellar Oracle' })).toHaveTextContent(
      'Keep live oracle prices one tap away',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Install' }))
    await waitFor(() => expect(prompt).toHaveBeenCalledOnce())
    expect(screen.queryByRole('region', { name: 'Install Stellar Oracle' })).not.toBeInTheDocument()
  })

  it('persists dismissal and suppresses the prompt on the next visit', () => {
    const firstVisit = render(<InstallPrompt />)
    dispatchInstallPrompt()
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(localStorage.getItem(STORAGE_KEYS.pwaInstallDismissed)).not.toBeNull()
    expect(screen.queryByRole('region', { name: 'Install Stellar Oracle' })).not.toBeInTheDocument()

    firstVisit.unmount()
    render(<InstallPrompt />)
    dispatchInstallPrompt()

    expect(screen.queryByRole('region', { name: 'Install Stellar Oracle' })).not.toBeInTheDocument()
  })

  it('reports browser prompt failures instead of silently hiding them', async () => {
    render(<InstallPrompt />)
    dispatchInstallPrompt('accepted', vi.fn().mockRejectedValue(new Error('prompt blocked')))

    fireEvent.click(screen.getByRole('button', { name: 'Install' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The install prompt could not be opened')
  })

  it('renders nothing until the browser offers the install prompt', () => {
    render(<InstallPrompt />)

    expect(screen.queryByRole('region', { name: 'Install Stellar Oracle' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('snoozes the prompt for 30 days when the browser reports a dismissed choice', async () => {
    const before = Date.now()
    render(<InstallPrompt />)
    dispatchInstallPrompt('dismissed')

    fireEvent.click(screen.getByRole('button', { name: 'Install' }))

    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Install Stellar Oracle' })).not.toBeInTheDocument(),
    )
    const until = Number(localStorage.getItem(STORAGE_KEYS.pwaInstallDismissed))
    expect(until).toBeGreaterThanOrEqual(before + 30 * 24 * 60 * 60 * 1000)
    expect(until).toBeLessThanOrEqual(Date.now() + 30 * 24 * 60 * 60 * 1000)
  })

  it('does not write a snooze when the browser reports an accepted install', async () => {
    render(<InstallPrompt />)
    dispatchInstallPrompt('accepted')

    fireEvent.click(screen.getByRole('button', { name: 'Install' }))

    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Install Stellar Oracle' })).not.toBeInTheDocument(),
    )
    expect(localStorage.getItem(STORAGE_KEYS.pwaInstallDismissed)).toBeNull()
  })

  it('shows the prompt again once an earlier snooze has expired', () => {
    localStorage.setItem(STORAGE_KEYS.pwaInstallDismissed, String(Date.now() - 1_000))
    render(<InstallPrompt />)
    dispatchInstallPrompt()

    expect(screen.getByRole('region', { name: 'Install Stellar Oracle' })).toBeInTheDocument()
  })

  it('clears the snooze and any open prompt when the app is installed', () => {
    localStorage.setItem(STORAGE_KEYS.pwaInstallDismissed, String(Date.now() + 60_000))
    render(<InstallPrompt />)
    dispatchInstallPrompt()
    expect(screen.queryByRole('region', { name: 'Install Stellar Oracle' })).not.toBeInTheDocument()

    act(() => window.dispatchEvent(new Event('appinstalled')))

    expect(localStorage.getItem(STORAGE_KEYS.pwaInstallDismissed)).toBeNull()
    dispatchInstallPrompt()
    expect(screen.getByRole('region', { name: 'Install Stellar Oracle' })).toBeInTheDocument()
  })

  it('hides a visible prompt when the app is installed from the browser', () => {
    render(<InstallPrompt />)
    dispatchInstallPrompt()
    expect(screen.getByRole('region', { name: 'Install Stellar Oracle' })).toBeInTheDocument()

    act(() => window.dispatchEvent(new Event('appinstalled')))

    expect(screen.queryByRole('region', { name: 'Install Stellar Oracle' })).not.toBeInTheDocument()
  })

  it('disables the install action while the browser prompt is open', () => {
    render(<InstallPrompt />)
    dispatchInstallPrompt(
      'accepted',
      vi.fn(() => new Promise<void>(() => {})),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Install' }))

    const opening = screen.getByRole('button', { name: 'Opening…' })
    expect(opening).toBeDisabled()
    fireEvent.click(opening)
    expect(screen.getByRole('button', { name: 'Opening…' })).toBeDisabled()
  })

  it('lets the user dismiss an install error and returns to the hidden state', async () => {
    render(<InstallPrompt />)
    dispatchInstallPrompt('accepted', vi.fn().mockRejectedValue(new Error('prompt blocked')))
    fireEvent.click(screen.getByRole('button', { name: 'Install' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Install Stellar Oracle' })).not.toBeInTheDocument()
  })

  it('keeps the install action keyboard reachable and has no accessibility violations', async () => {
    const user = userEvent.setup()
    const prompt = <InstallPrompt />
    render(prompt)
    dispatchInstallPrompt()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Install' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Not now' })).toHaveFocus()

    await checkAccessibility(prompt)
  })
})
