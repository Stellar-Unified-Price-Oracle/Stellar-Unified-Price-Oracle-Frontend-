import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNetworkStatus } from './useNetworkStatus'

describe('useNetworkStatus', () => {
  let addEventListenerSpy: ReturnType<typeof vi.fn>
  let removeEventListenerSpy: ReturnType<typeof vi.fn>
  let listeners: Record<string, Array<() => void>>

  beforeEach(() => {
    listeners = {}
    addEventListenerSpy = vi.fn((event: string, handler: () => void) => {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(handler)
    })
    removeEventListenerSpy = vi.fn((event: string, handler: () => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((h) => h !== handler)
      }
    })

    vi.spyOn(window, 'addEventListener').mockImplementation(addEventListenerSpy)
    vi.spyOn(window, 'removeEventListener').mockImplementation(removeEventListenerSpy)

    // Default: online
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns isOnline=true when navigator.onLine is true', () => {
    const { result } = renderHook(() => useNetworkStatus())

    expect(result.current.isOnline).toBe(true)
    expect(result.current.lastChanged).toBeNull()
  })

  it('returns isOnline=false when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useNetworkStatus())

    expect(result.current.isOnline).toBe(false)
  })

  it('registers online and offline event listeners', () => {
    renderHook(() => useNetworkStatus())

    expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))
  })

  it('cleans up event listeners on unmount', () => {
    const { unmount } = renderHook(() => useNetworkStatus())

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))
  })

  it('sets isOnline to false when offline event fires', () => {
    const { result } = renderHook(() => useNetworkStatus())

    expect(result.current.isOnline).toBe(true)

    act(() => {
      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true })
      const offlineHandler = listeners['offline'][0]
      offlineHandler()
    })

    expect(result.current.isOnline).toBe(false)
    expect(result.current.lastChanged).not.toBeNull()
  })

  it('sets isOnline back to true when online event fires after offline', () => {
    const { result } = renderHook(() => useNetworkStatus())

    // Go offline
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true })
      listeners['offline']?.[0]?.()
    })

    expect(result.current.isOnline).toBe(false)

    // Go back online
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
      listeners['online']?.[0]?.()
    })

    expect(result.current.isOnline).toBe(true)
  })

  it('updates lastChanged on each status change', () => {
    const { result } = renderHook(() => useNetworkStatus())

    let firstChange: number | null = null

    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true })
      listeners['offline']?.[0]?.()
    })

    firstChange = result.current.lastChanged

    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
      listeners['online']?.[0]?.()
    })

    expect(result.current.lastChanged).not.toBeNull()
    expect(result.current.lastChanged! >= firstChange!).toBe(true)
  })
})
