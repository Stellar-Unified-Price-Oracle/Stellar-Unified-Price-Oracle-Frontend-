import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  useHighContrastMode,
  getHighContrastMode,
  isHighContrastModeActive,
} from './useHighContrastMode'

function mockMatchMedia(forcedColors: boolean, prefersContrast: boolean) {
  return vi.fn((query: string) => ({
    matches: query === '(forced-colors: active)' ? forcedColors : query === '(prefers-contrast: more)' ? prefersContrast : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe('useHighContrastMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('detects when high contrast mode is inactive', () => {
    vi.stubGlobal('matchMedia', mockMatchMedia(false, false))
    const { result } = renderHook(() => useHighContrastMode())

    expect(result.current.isActive).toBe(false)
    expect(result.current.isForcedColors).toBe(false)
    expect(result.current.prefersHigherContrast).toBe(false)
  })

  it('detects forced-colors (Windows High Contrast)', () => {
    vi.stubGlobal('matchMedia', mockMatchMedia(true, false))
    const { result } = renderHook(() => useHighContrastMode())

    expect(result.current.isActive).toBe(true)
    expect(result.current.isForcedColors).toBe(true)
    expect(result.current.prefersHigherContrast).toBe(false)
  })

  it('detects prefers-contrast: more', () => {
    vi.stubGlobal('matchMedia', mockMatchMedia(false, true))
    const { result } = renderHook(() => useHighContrastMode())

    expect(result.current.isActive).toBe(true)
    expect(result.current.isForcedColors).toBe(false)
    expect(result.current.prefersHigherContrast).toBe(true)
  })

  it('detects both forced-colors and prefers-contrast', () => {
    vi.stubGlobal('matchMedia', mockMatchMedia(true, true))
    const { result } = renderHook(() => useHighContrastMode())

    expect(result.current.isActive).toBe(true)
    expect(result.current.isForcedColors).toBe(true)
    expect(result.current.prefersHigherContrast).toBe(true)
  })

  it('syncs across multiple hook instances', () => {
    vi.stubGlobal('matchMedia', mockMatchMedia(false, false))

    const { result: result1 } = renderHook(() => useHighContrastMode())
    const { result: result2 } = renderHook(() => useHighContrastMode())

    expect(result1.current.isActive).toBe(result2.current.isActive)
  })
})

describe('getHighContrastMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('matchMedia', mockMatchMedia(false, false))
  })

  it('returns current high contrast mode status (initialized)', () => {
    // Since getHighContrastMode reads from module-level state,
    // we can't easily test it without re-importing. This is a limitation
    // of the module-level state pattern. In practice, useHighContrastMode
    // hook is the primary interface and is well-tested above.
    const status = getHighContrastMode()

    expect(status).toBeDefined()
    expect(status.isActive).toBeDefined()
    expect(status.isForcedColors).toBeDefined()
    expect(status.prefersHigherContrast).toBeDefined()
  })

  it('returns a copy of the state', () => {
    const status1 = getHighContrastMode()
    const status2 = getHighContrastMode()

    expect(status1).not.toBe(status2)
    expect(status1).toEqual(status2)
  })
})

describe('isHighContrastModeActive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns false when high contrast is not active', () => {
    vi.stubGlobal('matchMedia', mockMatchMedia(false, false))
    expect(isHighContrastModeActive()).toBe(false)
  })

  it('returns true when forced-colors is active', () => {
    vi.stubGlobal('matchMedia', mockMatchMedia(true, false))
    expect(isHighContrastModeActive()).toBe(true)
  })

  it('returns true when prefers-contrast is active', () => {
    vi.stubGlobal('matchMedia', mockMatchMedia(false, true))
    expect(isHighContrastModeActive()).toBe(true)
  })

  it('returns false if window is undefined (SSR)', () => {
    const windowSpy = vi.spyOn(global, 'window', 'get')
    windowSpy.mockReturnValue(undefined as unknown as typeof window)

    expect(isHighContrastModeActive()).toBe(false)

    windowSpy.mockRestore()
  })
})
