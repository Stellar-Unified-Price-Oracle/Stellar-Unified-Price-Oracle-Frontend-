import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useReducedMotion } from './useReducedMotion'
import { PreferencesProvider } from '../preferences/PreferencesContext'
import type { ReactNode } from 'react'

describe('useReducedMotion', () => {
  let originalMatchMedia: (query: string) => MediaQueryList

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <PreferencesProvider>{children}</PreferencesProvider>
  )

  it('returns false by default', () => {
    window.matchMedia = vi.fn(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as (query: string) => MediaQueryList

    const { result } = renderHook(() => useReducedMotion(), { wrapper })
    expect(result.current).toBe(false)
  })

  it('returns true when system prefers reduced motion', () => {
    window.matchMedia = vi.fn(() => ({
      matches: true,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as (query: string) => MediaQueryList

    const { result } = renderHook(() => useReducedMotion(), { wrapper })
    expect(result.current).toBe(true)
  })

  it('responds to system media query changes', async () => {
    let listener: ((e: MediaQueryListEvent) => void) | null = null
    const mockMediaQuery: Partial<MediaQueryList> = {
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((type: string, handler: (e: MediaQueryListEvent) => void) => {
        if (type === 'change') listener = handler
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }

    window.matchMedia = vi.fn(() => mockMediaQuery as MediaQueryList)

    const { result } = renderHook(() => useReducedMotion(), { wrapper })
    expect(result.current).toBe(false)

    // Simulate system preference change
    if (listener) {
      listener({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
      } as MediaQueryListEvent)

      await waitFor(() => {
        expect(result.current).toBe(true)
      })
    }
  })

  it('cleans up event listeners on unmount', () => {
    const removeEventListenerMock = vi.fn()
    window.matchMedia = vi.fn(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: removeEventListenerMock,
      dispatchEvent: vi.fn(),
    })) as unknown as (query: string) => MediaQueryList

    const { unmount } = renderHook(() => useReducedMotion(), { wrapper })
    unmount()

    expect(removeEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
