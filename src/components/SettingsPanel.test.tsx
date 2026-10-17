import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { DEFAULT_PREFERENCES } from '../preferences/constants'
import { clearAllData } from '../utils/storage'
import { SettingsPanel } from './SettingsPanel'

const contextMock = vi.hoisted(() => ({
  clearHistory: vi.fn(),
  clearPriceCache: vi.fn<() => Promise<void>>(),
}))

vi.mock('../preferences/PreferencesContext', () => ({
  usePreferences: () => ({
    preferences: DEFAULT_PREFERENCES,
    updatePreference: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
    clearHistory: contextMock.clearHistory,
  }),
}))

vi.mock('../context/PriceContext', () => ({
  usePriceContext: () => ({ clearPriceCache: contextMock.clearPriceCache }),
}))

vi.mock('../utils/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/storage')>()),
  clearAllData: vi.fn<() => Promise<void>>(),
}))

const OFFLINE_CACHE_BUTTON = 'Clear cached offline price snapshot'
const CLEAR_ALL_BUTTON = 'Clear all local data stored by this app'
const CONFIRM_BUTTON = 'Confirm — clear all local data'

describe('SettingsPanel local data clearing', () => {
  beforeEach(() => {
    localStorage.clear()
    contextMock.clearHistory.mockReset()
    contextMock.clearPriceCache.mockReset().mockResolvedValue()
    vi.mocked(clearAllData).mockReset().mockResolvedValue()
  })

  afterEach(cleanup)

  it('clears only the offline price snapshot when that scope is chosen', async () => {
    render(<SettingsPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: OFFLINE_CACHE_BUTTON }))

    expect(await screen.findByRole('button', { name: OFFLINE_CACHE_BUTTON })).toHaveTextContent(
      'Offline price cache cleared',
    )
    expect(contextMock.clearPriceCache).toHaveBeenCalledOnce()
    expect(clearAllData).not.toHaveBeenCalled()
    expect(contextMock.clearHistory).not.toHaveBeenCalled()
  })

  it('shows progress and blocks repeat clicks while the offline snapshot is being cleared', () => {
    let finish: () => void = () => {}
    contextMock.clearPriceCache.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)))
    render(<SettingsPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: OFFLINE_CACHE_BUTTON }))

    const clearing = screen.getByRole('button', { name: OFFLINE_CACHE_BUTTON })
    expect(clearing).toHaveTextContent('Clearing…')
    expect(clearing).toBeDisabled()

    finish()
  })

  it('requires confirmation before clearing all local data', () => {
    render(<SettingsPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: CLEAR_ALL_BUTTON }))

    expect(
      screen.getByText(/This will delete all alerts, notification settings, preferences, and cached prices/),
    ).toBeInTheDocument()
    expect(clearAllData).not.toHaveBeenCalled()
  })

  it('leaves all data untouched when the confirmation is cancelled', () => {
    render(<SettingsPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: CLEAR_ALL_BUTTON }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('button', { name: CLEAR_ALL_BUTTON })).toBeInTheDocument()
    expect(clearAllData).not.toHaveBeenCalled()
    expect(contextMock.clearPriceCache).not.toHaveBeenCalled()
  })

  it('clears every app-owned store and reports the reload once confirmed', async () => {
    render(<SettingsPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: CLEAR_ALL_BUTTON }))
    fireEvent.click(screen.getByRole('button', { name: CONFIRM_BUTTON }))

    expect(await screen.findByText('Data cleared. Reloading…')).toBeInTheDocument()
    expect(clearAllData).toHaveBeenCalledOnce()
    expect(contextMock.clearPriceCache).not.toHaveBeenCalled()
  })

  it('clears undo history without touching cached data', () => {
    render(<SettingsPanel onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Clear undo history' }))

    expect(contextMock.clearHistory).toHaveBeenCalledOnce()
    expect(clearAllData).not.toHaveBeenCalled()
    expect(contextMock.clearPriceCache).not.toHaveBeenCalled()
  })

  it('reports the storage used by this app in the local data section', () => {
    render(<SettingsPanel onClose={vi.fn()} />)

    expect(screen.getByRole('region', { name: 'Local data' })).toHaveTextContent('Storage used')
  })

  it('runs the offline snapshot clear from the keyboard', async () => {
    const user = userEvent.setup()
    render(<SettingsPanel onClose={vi.fn()} />)

    const offlineCache = screen.getByRole('button', { name: OFFLINE_CACHE_BUTTON })
    offlineCache.focus()
    expect(offlineCache).toHaveFocus()

    await user.keyboard('{Enter}')

    expect(contextMock.clearPriceCache).toHaveBeenCalledOnce()
    expect(clearAllData).not.toHaveBeenCalled()
  })

  it('has no accessibility violations in the local data section', async () => {
    render(<SettingsPanel onClose={vi.fn()} />)

    // Scoped to the clear-data region: other panel sections have unlabelled <select>s.
    const results = await axe(screen.getByRole('region', { name: 'Local data' }))
    expect(results).toHaveNoViolations()
  })
})
