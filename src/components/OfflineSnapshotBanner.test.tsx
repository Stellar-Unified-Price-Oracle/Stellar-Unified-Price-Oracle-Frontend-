import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { checkAccessibility } from '../test/accessibility'
import { OfflineSnapshotBanner } from './OfflineSnapshotBanner'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('OfflineSnapshotBanner', () => {
  it('shows snapshot age and keeps refresh available while offline', () => {
    const onRefresh = vi.fn()
    render(<OfflineSnapshotBanner savedAt={Date.now() - 65_000} isRefreshing={false} onRefresh={onRefresh} />)
    act(() => window.dispatchEvent(new Event('offline')))

    expect(screen.getByText(/snapshot age 1m ago/)).toBeInTheDocument()
    expect(screen.getByText(/Your browser is offline/)).toBeInTheDocument()
    const refresh = screen.getByRole('button', { name: 'Refresh prices from the network' })
    expect(refresh).toBeEnabled()
    fireEvent.click(refresh)
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('updates the displayed age as the cached snapshot gets older', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    render(<OfflineSnapshotBanner savedAt={Date.now() - 1_000} isRefreshing={false} onRefresh={vi.fn()} />)
    expect(screen.getByText(/snapshot age 1s ago/)).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByText(/snapshot age 1m ago/)).toBeInTheDocument()
  })

  it('disables refresh during an active request and has no accessibility violations', async () => {
    const banner = <OfflineSnapshotBanner savedAt={Date.now()} isRefreshing onRefresh={vi.fn()} />
    render(banner)
    expect(screen.getByRole('button', { name: 'Refresh prices from the network' })).toBeDisabled()
    expect(screen.getByText('Refreshing…')).toBeInTheDocument()
    await checkAccessibility(banner)
  })

  it('warns that prices may be stale while online and switches copy with connectivity', () => {
    render(<OfflineSnapshotBanner savedAt={Date.now() - 5_000} isRefreshing={false} onRefresh={vi.fn()} />)
    expect(screen.getByText(/These prices may be stale/)).toBeInTheDocument()

    act(() => window.dispatchEvent(new Event('offline')))
    expect(screen.getByText(/Your browser is offline/)).toBeInTheDocument()
    expect(screen.queryByText(/These prices may be stale/)).not.toBeInTheDocument()

    act(() => window.dispatchEvent(new Event('online')))
    expect(screen.getByText(/These prices may be stale/)).toBeInTheDocument()
    expect(screen.queryByText(/Your browser is offline/)).not.toBeInTheDocument()
  })

  it('formats snapshot ages in hours and days', () => {
    const { unmount } = render(
      <OfflineSnapshotBanner savedAt={Date.now() - 3 * 60 * 60 * 1_000} isRefreshing={false} onRefresh={vi.fn()} />,
    )
    expect(screen.getByText(/snapshot age 3h ago/)).toBeInTheDocument()
    unmount()

    render(
      <OfflineSnapshotBanner
        savedAt={Date.now() - 2 * 24 * 60 * 60 * 1_000}
        isRefreshing={false}
        onRefresh={vi.fn()}
      />,
    )
    expect(screen.getByText(/snapshot age 2d ago/)).toBeInTheDocument()
  })

  it('clamps a snapshot timestamp from the future to zero seconds', () => {
    render(<OfflineSnapshotBanner savedAt={Date.now() + 60_000} isRefreshing={false} onRefresh={vi.fn()} />)
    expect(screen.getByText(/snapshot age 0s ago/)).toBeInTheDocument()
  })

  it('keeps refresh reachable and activatable from the keyboard', async () => {
    const user = userEvent.setup()
    const onRefresh = vi.fn()
    render(<OfflineSnapshotBanner savedAt={Date.now()} isRefreshing={false} onRefresh={onRefresh} />)

    await user.tab()
    const refresh = screen.getByRole('button', { name: 'Refresh prices from the network' })
    expect(refresh).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(onRefresh).toHaveBeenCalledOnce()
  })
})
