import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { useTheme as UseThemeType } from './useTheme'

// We use dynamic imports so vi.resetModules() fully resets module-level state.
// The module reads localStorage at import time, so localStorage must be set
// BEFORE the dynamic import for tests that verify stored preference loading.
let useTheme: typeof UseThemeType

function mockMatchMedia(matches: boolean) {
  return vi.fn((_query: string) => ({
    matches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

async function importModule() {
  vi.resetModules()
  const mod = await import('./useTheme')
  useTheme = mod.useTheme
}

describe('useTheme', () => {
  let classListAddSpy: ReturnType<typeof vi.fn>
  let classListRemoveSpy: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    localStorage.clear()
    document.documentElement.classList.remove('light', 'dark')

    classListAddSpy = vi.fn()
    classListRemoveSpy = vi.fn()

    vi.spyOn(document.documentElement.classList, 'add').mockImplementation(classListAddSpy)
    vi.spyOn(document.documentElement.classList, 'remove').mockImplementation(classListRemoveSpy)

    // Stub matchMedia BEFORE importing the module so the theme resolves correctly
    // Default: system prefers light
    vi.stubGlobal('matchMedia', mockMatchMedia(false))

    // Default: import with empty localStorage (system mode, resolves to light)
    await importModule()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to system mode when no preference is stored', () => {
    vi.stubGlobal('matchMedia', mockMatchMedia(false))

    const { result } = renderHook(() => useTheme())

    expect(result.current.mode).toBe('system')
    expect(result.current.theme).toBe('light')
  })

  it('respects stored dark preference', async () => {
    // Must set localStorage before importing the module
    localStorage.setItem('theme-preference', 'dark')
    await importModule()
    vi.stubGlobal('matchMedia', mockMatchMedia(false))

    const { result } = renderHook(() => useTheme())

    expect(result.current.mode).toBe('dark')
    expect(result.current.theme).toBe('dark')
  })

  it('respects stored light preference', async () => {
    localStorage.setItem('theme-preference', 'light')
    await importModule()
    vi.stubGlobal('matchMedia', mockMatchMedia(false))

    const { result } = renderHook(() => useTheme())

    expect(result.current.mode).toBe('light')
    expect(result.current.theme).toBe('light')
  })

  it('setMode changes the mode and persists it', () => {
    vi.stubGlobal('matchMedia', mockMatchMedia(false))
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setMode('dark')
    })

    expect(result.current.mode).toBe('dark')
    expect(result.current.theme).toBe('dark')
    expect(localStorage.getItem('theme-preference')).toBe('dark')
  })

  it('setMode to system follows system preference', () => {
    vi.stubGlobal('matchMedia', mockMatchMedia(true))
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setMode('system')
    })

    expect(result.current.mode).toBe('system')
    expect(result.current.theme).toBe('dark')
  })

  it('toggle switches between light and dark', () => {
    vi.stubGlobal('matchMedia', mockMatchMedia(false))
    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('light')

    act(() => {
      result.current.toggle()
    })

    expect(result.current.mode).toBe('dark')
    expect(result.current.theme).toBe('dark')

    act(() => {
      result.current.toggle()
    })

    expect(result.current.mode).toBe('light')
    expect(result.current.theme).toBe('light')
  })

  it('applies theme class to document element', () => {
    vi.stubGlobal('matchMedia', mockMatchMedia(false))

    renderHook(() => useTheme())

    expect(classListRemoveSpy).toHaveBeenCalledWith('light', 'dark')
    expect(classListAddSpy).toHaveBeenCalledWith('light')
  })

  it('syncs across multiple hook instances', () => {
    vi.stubGlobal('matchMedia', mockMatchMedia(false))

    const { result: result1 } = renderHook(() => useTheme())
    const { result: result2 } = renderHook(() => useTheme())

    act(() => {
      result1.current.setMode('dark')
    })

    expect(result1.current.mode).toBe('dark')
    expect(result2.current.mode).toBe('dark')
    expect(result2.current.theme).toBe('dark')
  })

  it('handles invalid stored value gracefully', async () => {
    localStorage.setItem('theme-preference', 'not-a-theme')
    await importModule()
    vi.stubGlobal('matchMedia', mockMatchMedia(false))

    const { result } = renderHook(() => useTheme())

    expect(result.current.mode).toBe('system')
  })

  it('handles localStorage read errors gracefully', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Access denied')
    })
    // Re-import so the module reads with the throwing mock
    vi.resetModules()
    const mod = await import('./useTheme')
    useTheme = mod.useTheme
    vi.stubGlobal('matchMedia', mockMatchMedia(false))

    const { result } = renderHook(() => useTheme())

    expect(result.current.mode).toBe('system')
  })
})
