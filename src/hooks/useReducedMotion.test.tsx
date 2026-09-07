import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { PreferencesProvider } from '../preferences/PreferencesContext'
import { useReducedMotion } from './useReducedMotion'

/** Builds a MediaQueryList stub that captures the change listener when registered. */
function makeMatchMedia(initialMatches: boolean): {
  mql: MediaQueryList
  changeListener: { current: ((e: MediaQueryListEvent) => void) | null }
} {
  const changeListener: { current: ((e: MediaQueryListEvent) => void) | null } = { current: null }
  const mql = {
    matches: initialMatches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    onmsevent: undefined,
    addEventListener: (type: string, handler: (e: MediaQueryListEvent) => void) => {
      if (type === 'change') changeListener.current = handler
    },
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  } as unknown as MediaQueryList
  return { mql, changeListener }
}

describe('useReducedMotion', () => {
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    vi.clearAllMocks()
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <PreferencesProvider>{children}</PreferencesProvider>
    </MemoryRouter>
  )

  it('returns false by default', () => {
    const { mql } = makeMatchMedia(false)
    window.matchMedia = vi.fn(() => mql)

    const { result } = renderHook(() => useReducedMotion(), { wrapper })
    expect(result.current).toBe(false)
  })

  it('returns true when system prefers reduced motion', () => {
    const { mql } = makeMatchMedia(true)
    window.matchMedia = vi.fn(() => mql)

    const { result } = renderHook(() => useReducedMotion(), { wrapper })
    expect(result.current).toBe(true)
  })

  it('responds to system media query changes', async () => {
    const { mql, changeListener } = makeMatchMedia(false)
    window.matchMedia = vi.fn(() => mql)

    const { result } = renderHook(() => useReducedMotion(), { wrapper })
    expect(result.current).toBe(false)

    // Simulate the system preference flipping to reduce-motion
    act(() => {
      changeListener.current?.({ matches: true, media: '(prefers-reduced-motion: reduce)' } as MediaQueryListEvent)
    })

    await waitFor(() => {
      expect(result.current).toBe(true)
    })
  })

  it('cleans up event listeners on unmount', () => {
    const { mql } = makeMatchMedia(false)
    window.matchMedia = vi.fn(() => mql)

    const { unmount } = renderHook(() => useReducedMotion(), { wrapper })
    unmount()

    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
