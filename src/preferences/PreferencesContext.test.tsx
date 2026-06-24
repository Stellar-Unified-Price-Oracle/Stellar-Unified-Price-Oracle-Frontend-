import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, renderHook, act, screen } from '@testing-library/react'
import { MemoryRouter, Link } from 'react-router-dom'
import { PreferencesProvider, usePreferences } from './PreferencesContext'
import { DEFAULT_PREFERENCES } from './constants'
import type { ReactNode } from 'react'

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/']}>
      <PreferencesProvider>{children}</PreferencesProvider>
    </MemoryRouter>
  )
}

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
})

describe('PreferencesProvider / usePreferences', () => {
  it('provides default preferences', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper })
    expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES)
  })

  it('updatePreference changes a single preference', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper })

    act(() => result.current.updatePreference('refreshInterval', 30000))
    expect(result.current.preferences.refreshInterval).toBe(30000)
    expect(result.current.preferences.chartTimeRange).toBe(DEFAULT_PREFERENCES.chartTimeRange)
  })

  it('undo reverts the last preference change', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper })

    act(() => result.current.updatePreference('refreshInterval', 30000))
    expect(result.current.preferences.refreshInterval).toBe(30000)
    expect(result.current.canUndo).toBe(true)

    act(() => result.current.undo())
    expect(result.current.preferences.refreshInterval).toBe(DEFAULT_PREFERENCES.refreshInterval)
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)
  })

  it('redo reapplies the last undone preference change', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper })

    act(() => result.current.updatePreference('refreshInterval', 30000))
    act(() => result.current.undo())
    act(() => result.current.redo())
    expect(result.current.preferences.refreshInterval).toBe(30000)
  })

  it('updatePreference with same value does nothing', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper })

    act(() => result.current.updatePreference('refreshInterval', DEFAULT_PREFERENCES.refreshInterval))
    expect(result.current.canUndo).toBe(false)
  })

  it('clearHistory clears the undo stack', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper })

    act(() => result.current.updatePreference('refreshInterval', 30000))
    act(() => result.current.updatePreference('chartTimeRange', '7d'))
    act(() => result.current.clearHistory())
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('supports multiple preference changes', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper })

    act(() => result.current.updatePreference('refreshInterval', 5000))
    act(() => result.current.updatePreference('chartTimeRange', '7d'))
    act(() => result.current.updatePreference('staleThresholdMinutes', 15))

    expect(result.current.preferences).toEqual({
      ...DEFAULT_PREFERENCES,
      refreshInterval: 5000,
      chartTimeRange: '7d',
      staleThresholdMinutes: 15,
      dashboardView: 'card',
      cardOrder: [],
    })

    act(() => result.current.undo())
    expect(result.current.preferences.staleThresholdMinutes).toBe(DEFAULT_PREFERENCES.staleThresholdMinutes)

    act(() => result.current.undo())
    expect(result.current.preferences.chartTimeRange).toBe(DEFAULT_PREFERENCES.chartTimeRange)

    act(() => result.current.undo())
    expect(result.current.preferences.refreshInterval).toBe(DEFAULT_PREFERENCES.refreshInterval)
    expect(result.current.canUndo).toBe(false)
  })

  it('clears history on route change', () => {
    function NavTest() {
      const prefs = usePreferences()
      return (
        <div>
          <Link to="/other">Navigate</Link>
          <button onClick={() => prefs.updatePreference('refreshInterval', 5000)} data-testid="change">
            Change
          </button>
          <span data-testid="canUndo">{String(prefs.canUndo)}</span>
        </div>
      )
    }

    render(
      <MemoryRouter initialEntries={['/']}>
        <PreferencesProvider>
          <NavTest />
        </PreferencesProvider>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('canUndo').textContent).toBe('false')
    act(() => screen.getByTestId('change').click())
    expect(screen.getByTestId('canUndo').textContent).toBe('true')
  })
})

describe('Settings panel UI integration', () => {
  it('renders children within provider', () => {
    render(
      <MemoryRouter>
        <PreferencesProvider>
          <div data-testid="child">Hello</div>
        </PreferencesProvider>
      </MemoryRouter>,
    )
    expect(screen.getByTestId('child')).toHaveTextContent('Hello')
  })

  it('throws when usePreferences is used without provider', () => {
    expect(() => renderHook(() => usePreferences())).toThrow(
      'usePreferences must be used within a PreferencesProvider',
    )
  })
})
