import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSavedViews } from './useSavedViews'
import { idbCache } from './useIndexedDB'
import { ToastProvider } from '../context/ToastContext'
import type { ReactNode } from 'react'

function Wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}

beforeEach(() => {
  idbCache._reset()
  idbCache._disableSyncQueue()
  vi.clearAllMocks()
})

afterEach(() => {
  idbCache._reset()
})

const baseViewInput = {
  name: 'BTC View',
  search: 'BTC',
  filters: {},
  sortField: 'price',
  sortDirection: 'desc' as const,
  viewMode: 'grid' as const,
}

describe('useSavedViews', () => {
  it('returns empty views initially', async () => {
    const { result } = renderHook(() => useSavedViews(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.views).toEqual([])
  })

  it('saves a new view and includes it in views', async () => {
    const { result } = renderHook(() => useSavedViews(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.saveView(baseViewInput)
    })

    await waitFor(() => {
      expect(result.current.views).toHaveLength(1)
    })
    expect(result.current.views[0].name).toBe('BTC View')
  })

  it('saveView returns the new view with generated id and timestamps', async () => {
    const { result } = renderHook(() => useSavedViews(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    let newView: ReturnType<typeof result.current.saveView> | undefined
    act(() => {
      newView = result.current.saveView(baseViewInput)
    })

    expect(typeof newView?.id).toBe('string')
    expect(newView?.id.length).toBeGreaterThan(0)
    expect(typeof newView?.createdAt).toBe('number')
    expect(typeof newView?.updatedAt).toBe('number')
  })

  it('deletes a view by id', async () => {
    const { result } = renderHook(() => useSavedViews(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    let id = ''
    act(() => {
      const view = result.current.saveView(baseViewInput)
      id = view.id
    })

    await waitFor(() => expect(result.current.views).toHaveLength(1))

    act(() => {
      result.current.deleteView(id)
    })

    await waitFor(() => expect(result.current.views).toHaveLength(0))
  })

  it('updateView patches name and bumps updatedAt', async () => {
    const { result } = renderHook(() => useSavedViews(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    let id = ''
    let originalUpdatedAt = 0
    act(() => {
      const view = result.current.saveView(baseViewInput)
      id = view.id
      originalUpdatedAt = view.updatedAt
    })

    await waitFor(() => expect(result.current.views).toHaveLength(1))

    // Advance time so updatedAt changes
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 10_000)

    act(() => {
      result.current.updateView(id, { name: 'Updated Name' })
    })

    await waitFor(() => {
      const updated = result.current.views.find((v) => v.id === id)
      expect(updated?.name).toBe('Updated Name')
      expect(updated?.updatedAt).toBeGreaterThan(originalUpdatedAt)
    })

    vi.useRealTimers()
  })

  it('deleteView on unknown id does not throw', async () => {
    const { result } = renderHook(() => useSavedViews(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(() => {
      act(() => {
        result.current.deleteView('nonexistent-id')
      })
    }).not.toThrow()
  })

  it('activateView calls window.location.assign with a URL containing the view state', async () => {
    const assignSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign: assignSpy },
    })

    const { result } = renderHook(() => useSavedViews(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    let id = ''
    act(() => {
      const view = result.current.saveView(baseViewInput)
      id = view.id
    })

    await waitFor(() => expect(result.current.views).toHaveLength(1))

    act(() => {
      result.current.activateView(id)
    })

    expect(assignSpy).toHaveBeenCalledTimes(1)
    const calledUrl: string = assignSpy.mock.calls[0][0] as string
    expect(calledUrl).toContain('search=BTC')
  })

  it('views are sorted newest-first', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useSavedViews(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      vi.setSystemTime(1_000)
      result.current.saveView({ ...baseViewInput, name: 'Older' })
    })
    await waitFor(() => expect(result.current.views).toHaveLength(1))

    act(() => {
      vi.setSystemTime(2_000)
      result.current.saveView({ ...baseViewInput, name: 'Newer' })
    })
    await waitFor(() => expect(result.current.views).toHaveLength(2))

    expect(result.current.views[0].name).toBe('Newer')
    expect(result.current.views[1].name).toBe('Older')

    vi.useRealTimers()
  })
})
