import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ServiceWorkerCallbacks } from '../utils/registerServiceWorker'
import type { SwUpdateMessage } from '../utils/swUpdateChannel'
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
})
