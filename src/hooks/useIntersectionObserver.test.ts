import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIntersectionObserver } from './useIntersectionObserver'

describe('useIntersectionObserver', () => {
  let observeSpy: ReturnType<typeof vi.fn>
  let disconnectSpy: ReturnType<typeof vi.fn>
  let observerCallback: IntersectionObserverCallback | null

  beforeEach(() => {
    observeSpy = vi.fn()
    disconnectSpy = vi.fn()
    observerCallback = null

    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn((cb: IntersectionObserverCallback) => {
        observerCallback = cb
        return {
          observe: observeSpy,
          disconnect: disconnectSpy,
          unobserve: vi.fn(),
          takeRecords: vi.fn(() => []),
          root: null,
          rootMargin: '',
          thresholds: [],
        }
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a ref and isIntersecting=false initially', () => {
    const { result } = renderHook(() => useIntersectionObserver())
    expect(result.current.isIntersecting).toBe(false)
    expect(typeof result.current.ref).toBe('function')
  })

  it('observes when ref is called with an element', () => {
    const { result } = renderHook(() => useIntersectionObserver())
    const el = document.createElement('div')

    act(() => {
      result.current.ref(el)
    })

    expect(observeSpy).toHaveBeenCalledWith(el)
  })

  it('sets isIntersecting=true when callback fires with intersecting entry', () => {
    const { result } = renderHook(() => useIntersectionObserver())

    act(() => {
      result.current.ref(document.createElement('div'))
    })

    act(() => {
      observerCallback!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
    })

    expect(result.current.isIntersecting).toBe(true)
  })

  it('sets isIntersecting=false when callback fires with non-intersecting entry', () => {
    const { result } = renderHook(() => useIntersectionObserver())

    act(() => {
      result.current.ref(document.createElement('div'))
    })

    // First set to true
    act(() => {
      observerCallback!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
    })

    // Then set to false
    act(() => {
      observerCallback!(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
    })

    expect(result.current.isIntersecting).toBe(false)
  })

  it('invokes onIntersect callback with the entry', () => {
    const onIntersect = vi.fn()
    const { result } = renderHook(() => useIntersectionObserver({ onIntersect }))

    act(() => {
      result.current.ref(document.createElement('div'))
    })

    const entry = { isIntersecting: true } as IntersectionObserverEntry

    act(() => {
      observerCallback!([entry], {} as IntersectionObserver)
    })

    expect(onIntersect).toHaveBeenCalledWith(entry)
  })

  it('disconnects observer on unmount', () => {
    const { result, unmount } = renderHook(() => useIntersectionObserver())

    act(() => {
      result.current.ref(document.createElement('div'))
    })

    unmount()

    expect(disconnectSpy).toHaveBeenCalled()
  })

  it('disconnects previous observer when ref changes element', () => {
    const { result } = renderHook(() => useIntersectionObserver())

    act(() => {
      result.current.ref(document.createElement('div'))
    })

    act(() => {
      result.current.ref(document.createElement('span'))
    })

    expect(disconnectSpy).toHaveBeenCalled()
  })

  it('disconnects when ref is called with null', () => {
    const { result } = renderHook(() => useIntersectionObserver())

    act(() => {
      result.current.ref(document.createElement('div'))
    })

    act(() => {
      result.current.ref(null)
    })

    expect(disconnectSpy).toHaveBeenCalled()
  })
})
