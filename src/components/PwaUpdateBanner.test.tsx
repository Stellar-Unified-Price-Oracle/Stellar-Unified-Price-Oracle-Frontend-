import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { checkAccessibility } from '../test/accessibility'
import type { ServiceWorkerCallbacks } from '../utils/registerServiceWorker'
import { STORAGE_KEYS } from '../utils/storage'
import { PwaUpdateBanner } from './PwaUpdateBanner'

const serviceWorkerMock = vi.hoisted(() => ({
  callbacks: null as ServiceWorkerCallbacks | null,
  apply: vi.fn<() => Promise<void>>(),
}))

const channelMock = vi.hoisted(() => ({
  listener: null as ((message: SwUpdateMessage) => void) | null,
  broadcast: vi.fn(),
}))

vi.mock('../utils/swUpdateChannel', () => ({
  broadcastSwUpdate: channelMock.broadcast,
  subscribeToSwUpdates: (listener: (message: SwUpdateMessage) => void) => {
    channelMock.listener = listener
    return () => {
      channelMock.listener = null
    }
  },
}))

vi.mock('../utils/registerServiceWorker', () => ({
  registerServiceWorker: (callbacks: ServiceWorkerCallbacks) => {
    serviceWorkerMock.callbacks = callbacks
    return vi.fn()
  },
  applyServiceWorkerUpdate: serviceWorkerMock.apply,
}))

describe('PwaUpdateBanner', () => {
  beforeEach(() => {
    localStorage.clear()
    serviceWorkerMock.callbacks = null
    serviceWorkerMock.apply.mockReset().mockResolvedValue()
    channelMock.listener = null
    channelMock.broadcast.mockReset()
  })

  afterEach(cleanup)

  it('shows the ready version and release notes before applying an update', () => {
    render(<PwaUpdateBanner />)
    const registration = {} as ServiceWorkerRegistration

    act(() => serviceWorkerMock.callbacks?.onUpdateAvailable(registration))

    expect(screen.getByRole('region', { name: 'Update available' })).toHaveTextContent('Version 1.0.1')
    expect(screen.getByText('Includes the latest fixes and improvements.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reload to update' }))
    expect(serviceWorkerMock.apply).toHaveBeenCalledWith(registration)
  })

  it('reports activation errors and retains an explicit recovery state', async () => {
    serviceWorkerMock.apply.mockRejectedValueOnce(new Error('activation timed out'))
    render(<PwaUpdateBanner />)
    act(() => serviceWorkerMock.callbacks?.onUpdateAvailable({} as ServiceWorkerRegistration))

    fireEvent.click(screen.getByRole('button', { name: 'Reload to update' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('the requested service worker change was not applied')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument())
  })

  it('tells other tabs when it starts applying an update', () => {
    render(<PwaUpdateBanner />)
    act(() => serviceWorkerMock.callbacks?.onUpdateAvailable({} as ServiceWorkerRegistration))

    fireEvent.click(screen.getByRole('button', { name: 'Reload to update' }))

    expect(channelMock.broadcast).toHaveBeenCalledWith({ type: 'applying' })
  })

  it('disables its prompt while another tab is applying the same update', () => {
    render(<PwaUpdateBanner />)
    act(() => serviceWorkerMock.callbacks?.onUpdateAvailable({} as ServiceWorkerRegistration))

    act(() => channelMock.listener?.({ type: 'applying', sender: 'other-tab' }))

    const button = screen.getByRole('button', { name: 'Applying…' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(serviceWorkerMock.apply).not.toHaveBeenCalled()
  })

  it('hides its prompt when another tab dismisses it', () => {
    render(<PwaUpdateBanner />)
    act(() => serviceWorkerMock.callbacks?.onUpdateAvailable({} as ServiceWorkerRegistration))
    expect(screen.getByRole('region', { name: 'Update available' })).toBeInTheDocument()

    act(() => channelMock.listener?.({ type: 'dismissed', until: Date.now() + 60_000, sender: 'other-tab' }))

    expect(screen.queryByRole('region', { name: 'Update available' })).toBeNull()
  })

  it('broadcasts its own dismissal so peer tabs hide the prompt too', () => {
    render(<PwaUpdateBanner />)
    act(() => serviceWorkerMock.callbacks?.onUpdateAvailable({} as ServiceWorkerRegistration))

    fireEvent.click(screen.getByRole('button', { name: 'Later' }))

    expect(channelMock.broadcast).toHaveBeenCalledWith(expect.objectContaining({ type: 'dismissed' }))
  })

  it('announces offline readiness without claiming live data is available offline', () => {
    render(<PwaUpdateBanner />)
    act(() => serviceWorkerMock.callbacks?.onOfflineReady())

    expect(screen.getByRole('status')).toHaveTextContent('The app shell is cached for offline access.')
    expect(screen.getByRole('status')).toHaveTextContent('Live prices still need a connection.')
  })

  it('surfaces service worker registration failures', () => {
    render(<PwaUpdateBanner />)
    act(() => serviceWorkerMock.callbacks?.onError(new Error('registration failed')))

    expect(screen.getByRole('alert')).toHaveTextContent('the requested service worker change was not applied')
  })

  it('keeps the release summary to the version and one-line notes, with no apply call until confirmed', () => {
    render(<PwaUpdateBanner />)
    act(() => serviceWorkerMock.callbacks?.onUpdateAvailable({} as ServiceWorkerRegistration))

    const summary = screen.getByRole('region', { name: 'Update available' })
    expect(summary).toHaveTextContent('Version 1.0.1')
    expect(summary).toHaveTextContent('Includes the latest fixes and improvements.')
    expect(serviceWorkerMock.apply).not.toHaveBeenCalled()
  })

  it('shows applying progress and blocks repeat activation while the update is in flight', async () => {
    let finish: () => void = () => {}
    serviceWorkerMock.apply.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)))
    render(<PwaUpdateBanner />)
    act(() => serviceWorkerMock.callbacks?.onUpdateAvailable({} as ServiceWorkerRegistration))

    fireEvent.click(screen.getByRole('button', { name: 'Reload to update' }))

    const applying = screen.getByRole('button', { name: 'Applying…' })
    expect(applying).toBeDisabled()
    fireEvent.click(applying)
    expect(serviceWorkerMock.apply).toHaveBeenCalledTimes(1)

    await act(async () => finish())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('snoozes the update for six hours when the user chooses Later', () => {
    const before = Date.now()
    render(<PwaUpdateBanner />)
    act(() => serviceWorkerMock.callbacks?.onUpdateAvailable({} as ServiceWorkerRegistration))

    fireEvent.click(screen.getByRole('button', { name: 'Later' }))

    expect(screen.queryByRole('region', { name: 'Update available' })).not.toBeInTheDocument()
    const until = Number(localStorage.getItem(STORAGE_KEYS.pwaUpdateDismissed))
    expect(until).toBeGreaterThanOrEqual(before + 6 * 60 * 60 * 1000)
    expect(until).toBeLessThanOrEqual(Date.now() + 6 * 60 * 60 * 1000)
  })

  it('keeps a snoozed update hidden on the next visit until the snooze expires', () => {
    localStorage.setItem(STORAGE_KEYS.pwaUpdateDismissed, String(Date.now() + 60_000))
    render(<PwaUpdateBanner />)
    act(() => serviceWorkerMock.callbacks?.onUpdateAvailable({} as ServiceWorkerRegistration))

    expect(screen.queryByRole('region', { name: 'Update available' })).not.toBeInTheDocument()
  })

  it('shows an update again once its snooze has expired', () => {
    localStorage.setItem(STORAGE_KEYS.pwaUpdateDismissed, String(Date.now() - 1_000))
    render(<PwaUpdateBanner />)
    act(() => serviceWorkerMock.callbacks?.onUpdateAvailable({} as ServiceWorkerRegistration))

    expect(screen.getByRole('region', { name: 'Update available' })).toBeInTheDocument()
  })

  it('lets the user dismiss an activation error and returns to the update prompt to retry', async () => {
    serviceWorkerMock.apply.mockRejectedValueOnce(new Error('activation timed out'))
    render(<PwaUpdateBanner />)
    act(() => serviceWorkerMock.callbacks?.onUpdateAvailable({} as ServiceWorkerRegistration))
    fireEvent.click(screen.getByRole('button', { name: 'Reload to update' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload to update' })).toBeEnabled()
  })

  it('lets the user dismiss the offline-ready notice', () => {
    render(<PwaUpdateBanner />)
    act(() => serviceWorkerMock.callbacks?.onOfflineReady())

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('replaces an offline-ready notice with the update summary when a new worker is waiting', () => {
    render(<PwaUpdateBanner />)
    act(() => serviceWorkerMock.callbacks?.onOfflineReady())

    act(() => serviceWorkerMock.callbacks?.onUpdateAvailable({} as ServiceWorkerRegistration))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Update available' })).toBeInTheDocument()
  })

  it('is keyboard operable and has no accessibility violations', async () => {
    const user = userEvent.setup()
    const banner = <PwaUpdateBanner />
    render(banner)
    act(() => serviceWorkerMock.callbacks?.onUpdateAvailable({} as ServiceWorkerRegistration))

    await user.tab()
    expect(screen.getByRole('button', { name: 'Reload to update' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Later' })).toHaveFocus()

    await checkAccessibility(banner)
  })
})
