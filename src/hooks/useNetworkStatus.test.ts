import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNetworkStatus } from './useNetworkStatus'

describe('useNetworkStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns true when online', () => {
    vi.stubGlobal('navigator', { onLine: true })
    const { result } = renderHook(() => useNetworkStatus())
    expect(result.current).toBe(true)
  })

  it('returns false when offline', () => {
    vi.stubGlobal('navigator', { onLine: false })
    const { result } = renderHook(() => useNetworkStatus())
    expect(result.current).toBe(false)
  })

  it('reacts to offline event', () => {
    vi.stubGlobal('navigator', { onLine: true })
    const { result } = renderHook(() => useNetworkStatus())
    act(() => { window.dispatchEvent(new Event('offline')) })
    expect(result.current).toBe(false)
  })

  it('reacts to online event', () => {
    vi.stubGlobal('navigator', { onLine: false })
    const { result } = renderHook(() => useNetworkStatus())
    act(() => { window.dispatchEvent(new Event('online')) })
    expect(result.current).toBe(true)
  })
})
