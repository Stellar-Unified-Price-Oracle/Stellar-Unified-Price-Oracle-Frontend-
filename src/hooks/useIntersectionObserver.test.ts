import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { RefObject } from 'react'
import { useIntersectionObserver } from './useIntersectionObserver'

describe('useIntersectionObserver', () => {
  let observeSpy: ReturnType<typeof vi.fn>
  let disconnectSpy: ReturnType<typeof vi.fn>
  let observerCallback: IntersectionObserverCallback | null
  let observerInstances: number

  function makeRef(el: Element | null): RefObject<Element | null> {
    return { current: el }
  }

  beforeEach(() => {
    observerInstances = 0
    observeSpy = vi.fn()
    disconnectSpy = vi.fn()
    observerCallback = null

    vi.stubGlobal(
      'IntersectionObserver',
      // A real `function`, not an arrow, so the hook can invoke it with `new`.
      vi.fn(function (this: unknown, cb: IntersectionObserverCallback) {
        observerInstances++
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

  it('observes the element attached to targetRef on mount', () => {
    const el = document.createElement('div')
    renderHook(() => useIntersectionObserver(makeRef(el), vi.fn()))

    expect(observeSpy).toHaveBeenCalledWith(el)
  })

  it('does nothing when targetRef.current is null', () => {
    renderHook(() => useIntersectionObserver(makeRef(null), vi.fn()))

    expect(observeSpy).not.toHaveBeenCalled()
  })

  it('invokes the callback with each observed entry', () => {
    const callback = vi.fn()
    renderHook(() => useIntersectionObserver(makeRef(document.createElement('div')), callback))

    const entry = { isIntersecting: true } as IntersectionObserverEntry
    act(() => {
      observerCallback!([entry], {} as IntersectionObserver)
    })

    expect(callback).toHaveBeenCalledWith(entry)
  })

  it('uses the latest callback across renders (no stale closure)', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ cb }) => useIntersectionObserver(makeRef(document.createElement('div')), cb), {
      initialProps: { cb: first },
    })

    rerender({ cb: second })

    act(() => {
      observerCallback!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    })

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('disconnects the observer on unmount', () => {
    const { unmount } = renderHook(() => useIntersectionObserver(makeRef(document.createElement('div')), vi.fn()))

    unmount()

    expect(disconnectSpy).toHaveBeenCalled()
  })

  it('observes a new target when the targetRef identity changes', () => {
    const el1 = document.createElement('div')
    const el2 = document.createElement('span')
    const { rerender } = renderHook(({ r }) => useIntersectionObserver(r, vi.fn()), {
      initialProps: { r: makeRef(el1) },
    })

    expect(observerInstances).toBe(1)
    expect(observeSpy).toHaveBeenCalledWith(el1)

    rerender({ r: makeRef(el2) })

    expect(observerInstances).toBe(2)
    expect(observeSpy).toHaveBeenCalledWith(el2)
    expect(disconnectSpy).toHaveBeenCalled()
  })

  it('recreates the observer when options change', () => {
    const { rerender } = renderHook(
      ({ threshold }) => useIntersectionObserver(makeRef(document.createElement('div')), vi.fn(), { threshold }),
      { initialProps: { threshold: 0 } },
    )

    expect(observerInstances).toBe(1)

    rerender({ threshold: 0.5 })

    expect(observerInstances).toBe(2)
    expect(disconnectSpy).toHaveBeenCalled()
  })
})
