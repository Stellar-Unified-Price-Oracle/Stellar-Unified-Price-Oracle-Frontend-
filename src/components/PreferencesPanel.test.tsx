/**
 * PreferencesPanel.test.tsx
 *
 * #270 — Fix incorrect act() wrapper anti-pattern
 *
 * render() from @testing-library/react already wraps itself in act().
 * Double-wrapping with act(() => { render(...) }) can mask legitimate
 * state-update warnings and makes tests harder to debug.
 *
 * This file uses the correct pattern throughout:
 *   - render() is called directly, never inside act()
 *   - user interactions go through userEvent (which handles act internally)
 *   - act() is used only where there is no higher-level Testing Library API
 *     and a state update needs to be flushed synchronously
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { PreferencesProvider } from '../preferences/PreferencesContext'
import { DEFAULT_PREFERENCES } from '../preferences/constants'
import { PreferencesPanel } from './PreferencesPanel'

vi.mock('../hooks/useIndexedDB', () => ({
  idbCache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue(() => {}),
    fetchWithCache: vi.fn().mockResolvedValue(null),
  },
}))

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/']}>
      <PreferencesProvider>{children}</PreferencesProvider>
    </MemoryRouter>
  )
}

afterEach(cleanup)
beforeEach(() => vi.clearAllMocks())

describe('PreferencesPanel', () => {
  it('renders without crashing', () => {
    // render() is called directly — NOT wrapped in act()
    render(<PreferencesPanel />, { wrapper: Wrapper })
    expect(screen.getByRole('region', { name: 'Preferences' })).toBeInTheDocument()
  })

  it('displays the refresh interval select with the default value', () => {
    render(<PreferencesPanel />, { wrapper: Wrapper })
    const select = screen.getByLabelText('Refresh interval')
    expect(select).toHaveValue(String(DEFAULT_PREFERENCES.refreshInterval))
  })

  it('displays the chart time range select with the default value', () => {
    render(<PreferencesPanel />, { wrapper: Wrapper })
    const select = screen.getByLabelText('Chart time range')
    expect(select).toHaveValue(DEFAULT_PREFERENCES.chartTimeRange)
  })

  it('displays the stale threshold select with the default value', () => {
    render(<PreferencesPanel />, { wrapper: Wrapper })
    const select = screen.getByLabelText('Stale threshold (minutes)')
    expect(select).toHaveValue(String(DEFAULT_PREFERENCES.staleThresholdMinutes))
  })

  it('undo and redo buttons are disabled by default', () => {
    render(<PreferencesPanel />, { wrapper: Wrapper })
    expect(screen.getByRole('button', { name: 'Undo last preference change' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Redo last preference change' })).toBeDisabled()
  })

  it('updates the refresh interval when the user selects a new value', async () => {
    const user = userEvent.setup()
    // render() is called directly — NOT wrapped in act()
    render(<PreferencesPanel />, { wrapper: Wrapper })

    const select = screen.getByLabelText('Refresh interval')
    await user.selectOptions(select, '30000')

    expect(select).toHaveValue('30000')
  })

  it('enables the undo button after a preference change', async () => {
    const user = userEvent.setup()
    render(<PreferencesPanel />, { wrapper: Wrapper })

    await user.selectOptions(screen.getByLabelText('Refresh interval'), '5000')

    expect(screen.getByRole('button', { name: 'Undo last preference change' })).toBeEnabled()
  })

  it('reverts a preference change when undo is clicked', async () => {
    const user = userEvent.setup()
    render(<PreferencesPanel />, { wrapper: Wrapper })

    await user.selectOptions(screen.getByLabelText('Refresh interval'), '30000')
    expect(screen.getByLabelText('Refresh interval')).toHaveValue('30000')

    await user.click(screen.getByRole('button', { name: 'Undo last preference change' }))
    expect(screen.getByLabelText('Refresh interval')).toHaveValue(
      String(DEFAULT_PREFERENCES.refreshInterval),
    )
  })

  it('enables redo after an undo and reapplies the change', async () => {
    const user = userEvent.setup()
    render(<PreferencesPanel />, { wrapper: Wrapper })

    await user.selectOptions(screen.getByLabelText('Chart time range'), '7d')
    await user.click(screen.getByRole('button', { name: 'Undo last preference change' }))

    expect(screen.getByRole('button', { name: 'Redo last preference change' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Redo last preference change' }))
    expect(screen.getByLabelText('Chart time range')).toHaveValue('7d')
  })
})
