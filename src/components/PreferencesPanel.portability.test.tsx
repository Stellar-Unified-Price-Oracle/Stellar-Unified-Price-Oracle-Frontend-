import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { PreferencesProvider } from '../preferences/PreferencesContext'
import { DEFAULT_PREFERENCES } from '../preferences/constants'
import { exportPreferences, PREFERENCES_FORMAT, PREFERENCES_SCHEMA_VERSION } from '../preferences/portability'
import { downloadFile } from '../utils/export'
import { STORAGE_KEYS } from '../utils/storage'
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

vi.mock('../utils/export', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/export')>()
  return { ...actual, downloadFile: vi.fn() }
})

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/']}>
      <PreferencesProvider>{children}</PreferencesProvider>
    </MemoryRouter>
  )
}

// jsdom's File has no text() method (browsers do), so supply it for the fixture.
function fileWith(contents: string, name = 'prefs.json') {
  const file = new File([contents], name, { type: 'application/json' })
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(contents) })
  return file
}

function importFile(file: File) {
  const input = screen.getByLabelText('Import preferences file')
  return userEvent.upload(input, file)
}

afterEach(cleanup)
beforeEach(() => vi.clearAllMocks())

describe('PreferencesPanel backup controls', () => {
  it('exports the current portable preferences as a JSON download', async () => {
    const user = userEvent.setup()
    render(<PreferencesPanel />, { wrapper: Wrapper })

    await user.click(screen.getByRole('button', { name: 'Export preferences' }))

    expect(downloadFile).toHaveBeenCalledTimes(1)
    const [content, filename, mime] = vi.mocked(downloadFile).mock.calls[0]
    expect(filename).toBe('supo-preferences.json')
    expect(mime).toBe('application/json')
    const parsed = JSON.parse(content)
    expect(parsed.format).toBe(PREFERENCES_FORMAT)
    expect(parsed.preferences.refreshInterval).toBe(DEFAULT_PREFERENCES.refreshInterval)
  })

  it('stages an imported file as a draft and does not change the form until applied', async () => {
    const user = userEvent.setup()
    render(<PreferencesPanel />, { wrapper: Wrapper })
    const exported = exportPreferences({ ...DEFAULT_PREFERENCES, refreshInterval: 60000 })

    await importFile(fileWith(exported))

    const review = await screen.findByRole('region', { name: 'Imported preferences review' })
    expect(within(review).getByText(/1 setting\(s\) differ/)).toBeInTheDocument()
    expect(screen.getByLabelText('Refresh interval')).toHaveValue(String(DEFAULT_PREFERENCES.refreshInterval))

    await user.click(within(review).getByRole('button', { name: 'Apply imported preferences' }))

    expect(screen.getByLabelText('Refresh interval')).toHaveValue('60000')
    expect(screen.queryByRole('region', { name: 'Imported preferences review' })).not.toBeInTheDocument()
  })

  it('discards a staged draft without touching preferences', async () => {
    const user = userEvent.setup()
    render(<PreferencesPanel />, { wrapper: Wrapper })

    await importFile(fileWith(exportPreferences({ ...DEFAULT_PREFERENCES, refreshInterval: 300000 })))
    await user.click(await screen.findByRole('button', { name: 'Discard' }))

    expect(screen.queryByRole('region', { name: 'Imported preferences review' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Refresh interval')).toHaveValue(String(DEFAULT_PREFERENCES.refreshInterval))
  })

  it('shows an alert and no review for a file that fails validation', async () => {
    render(<PreferencesPanel />, { wrapper: Wrapper })
    const bad = JSON.stringify({
      format: PREFERENCES_FORMAT,
      schemaVersion: PREFERENCES_SCHEMA_VERSION,
      preferences: { ...JSON.parse(exportPreferences(DEFAULT_PREFERENCES)).preferences, dashboardView: 'grid' },
    })

    await importFile(fileWith(bad))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid preference values: dashboardView.')
    expect(screen.queryByRole('region', { name: 'Imported preferences review' })).not.toBeInTheDocument()
  })

  it('reports a non-JSON file with a readable message', async () => {
    render(<PreferencesPanel />, { wrapper: Wrapper })

    await importFile(fileWith('definitely not json'))

    expect(await screen.findByRole('alert')).toHaveTextContent('The file is not valid JSON.')
  })

  it('keeps the import control reachable by keyboard with an accessible name', () => {
    render(<PreferencesPanel />, { wrapper: Wrapper })

    const input = screen.getByLabelText('Import preferences file')
    expect(input).toHaveAttribute('type', 'file')
    expect(input.tabIndex).toBeGreaterThanOrEqual(0)
  })
})

describe('PreferencesPanel unapplied-change warning', () => {
  function unloadIsCancelled(): boolean {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }

  it('warns before the page unloads while an imported draft is pending', async () => {
    render(<PreferencesPanel />, { wrapper: Wrapper })
    expect(unloadIsCancelled()).toBe(false)

    await importFile(fileWith(exportPreferences({ ...DEFAULT_PREFERENCES, largeText: true })))
    await screen.findByRole('region', { name: 'Imported preferences review' })

    expect(unloadIsCancelled()).toBe(true)
  })

  it('stops warning once the draft is applied', async () => {
    const user = userEvent.setup()
    render(<PreferencesPanel />, { wrapper: Wrapper })
    await importFile(fileWith(exportPreferences({ ...DEFAULT_PREFERENCES, largeText: true })))
    const review = await screen.findByRole('region', { name: 'Imported preferences review' })

    await user.click(within(review).getByRole('button', { name: 'Apply imported preferences' }))

    expect(unloadIsCancelled()).toBe(false)
  })

  it('stops warning once the draft is discarded', async () => {
    const user = userEvent.setup()
    render(<PreferencesPanel />, { wrapper: Wrapper })
    await importFile(fileWith(exportPreferences({ ...DEFAULT_PREFERENCES, largeText: true })))
    await user.click(await screen.findByRole('button', { name: 'Discard' }))

    expect(unloadIsCancelled()).toBe(false)
  })
})

describe('PreferencesPanel dismissed-explanation controls', () => {
  it('offers the three reappear policies with the weekly default selected', () => {
    render(<PreferencesPanel />, { wrapper: Wrapper })

    const select = screen.getByLabelText('Show dismissed explanations again')
    expect(select).toHaveValue('weekly')
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Never', 'After 7 days', 'Always'])
  })

  it('updates the policy when the user picks another option', async () => {
    const user = userEvent.setup()
    render(<PreferencesPanel />, { wrapper: Wrapper })

    await user.selectOptions(screen.getByLabelText('Show dismissed explanations again'), 'never')

    expect(screen.getByLabelText('Show dismissed explanations again')).toHaveValue('never')
  })

  it('clears stored dismissals on reset and confirms it in a live region', async () => {
    const user = userEvent.setup()
    localStorage.setItem(STORAGE_KEYS.dismissedExplanations, JSON.stringify({ 'confidence-gap': Date.now() }))
    render(<PreferencesPanel />, { wrapper: Wrapper })

    await user.click(screen.getByRole('button', { name: 'Reset dismissed explanations' }))

    expect(localStorage.getItem(STORAGE_KEYS.dismissedExplanations)).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Dismissed explanations reset.')
  })
})
