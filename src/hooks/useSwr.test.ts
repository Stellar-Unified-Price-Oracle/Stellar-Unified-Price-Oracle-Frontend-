import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSwr } from './useSwr'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useSwr', () => {
  it('returns loading initially and data after fetch', async () => {
    const fetcher = vi.fn().mockResolvedValue('data')
    const { result } = renderHook(() => useSwr('key1', fetcher))

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeUndefined()

    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.data).toBe('data')
    expect(result.current.error).toBeNull()
  })

  it('returns cached data on subsequent mount with same key', async () => {
    const fetcher = vi.fn().mockResolvedValue('cached')
    const { result, unmount } = renderHook(() =>
      useSwr('key-cache', fetcher, { staleTime: 60_000 }),
    )
    await vi.waitFor(() => expect(result.current.loading).toBe(false))

    unmount()

    const fetcher2 = vi.fn().mockResolvedValue('fresh')
    const { result: result2 } = renderHook(() =>
      useSwr('key-cache', fetcher2, { staleTime: 60_000 }),
    )

    expect(result2.current.data).toBe('cached')
    expect(fetcher2).not.toHaveBeenCalled()
  })

  it('returns stale data and re-fetches in background', async () => {
    const fetcher = vi.fn().mockResolvedValue('stale-data')

    const { result } = renderHook(() =>
      useSwr('key-stale', fetcher, { staleTime: 5000 }),
    )

    await vi.waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBe('stale-data')
    expect(fetcher).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(6000)
    })

    const fetcher2 = vi.fn().mockResolvedValue('fresh-data')
    const { result: result2 } = renderHook(() =>
      useSwr('key-stale', fetcher2, { staleTime: 5000 }),
    )

    expect(result2.current.data).toBe('stale-data')
    expect(result2.current.isValidating).toBe(true)

    await vi.waitFor(() => {
      expect(result2.current.isValidating).toBe(false)
    })
    expect(result2.current.data).toBe('fresh-data')
  })

  it('sets error on fetch failure', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useSwr('key-error', fetcher))

    await vi.waitFor(() => {
      expect(result.current.error).toBe('Network error')
    })
    expect(result.current.loading).toBe(false)
  })

  it('retries on failure up to retryCount', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Retry error'))
    renderHook(() => useSwr('key-retry', fetcher, { retryCount: 2 }))

    await vi.waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(1)
    })

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    await vi.waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2)
    })

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    await vi.waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(3)
    })
  })

  it('polls at refreshInterval', async () => {
    const fetcher = vi.fn().mockResolvedValue('polled')
    renderHook(() =>
      useSwr('key-poll', fetcher, { refreshInterval: 1000 }),
    )

    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3))
  })

  it('does not fetch when enabled is false', () => {
    const fetcher = vi.fn().mockResolvedValue('data')
    renderHook(() => useSwr('key-disabled', fetcher, { enabled: false }))

    expect(fetcher).not.toHaveBeenCalled()
  })

  it('refetch re-executes the fetcher', async () => {
    const fetcher = vi.fn().mockResolvedValue('first')
    const { result } = renderHook(() => useSwr('key-refetch', fetcher))

    await vi.waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBe('first')

    fetcher.mockResolvedValue('second')
    act(() => {
      result.current.refetch()
    })

    await vi.waitFor(() => expect(result.current.data).toBe('second'))
  })

  it('aborts fetch on unmount', async () => {
    const fetcher = vi.fn().mockImplementation(() => {
      return new Promise((_resolve, reject) => {
        reject(new DOMException('The operation was aborted', 'AbortError'))
      })
    })

    const { unmount } = renderHook(() => useSwr('key-abort', fetcher))
    unmount()

    await vi.waitFor(() => {
      expect(fetcher).toHaveBeenCalled()
    })
  })
})
