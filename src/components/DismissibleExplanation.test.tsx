import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { PreferencesProvider } from '../preferences/PreferencesContext'
import { DEFAULT_PREFERENCES } from '../preferences/constants'
import { idbCache } from '../hooks/useIndexedDB'
import { STORAGE_KEYS } from '../utils/storage'
import { WEEKLY_REAPPEAR_MS } from '../utils/explanationDismissals'
import { DismissibleExplanation } from './DismissibleExplanation'

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

function Note() {
  return (
    <DismissibleExplanation id="confidence-gap" title="Why confidence dropped">
      Fewer sources reported this interval.
    </DismissibleExplanation>
  )
}

afterEach(cleanup)
beforeEach(() => {
  localStorage.clear()
  vi.useRealTimers()
})

describe('DismissibleExplanation', () => {
  it('shows the note with an accessible name and a labelled dismiss button', () => {
    render(<Note />, { wrapper: Wrapper })

    expect(screen.getByRole('note', { name: 'Why confidence dropped' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss: Why confidence dropped' })).toBeInTheDocument()
  })

  it('hides the note when dismissed and remembers the dismissal', async () => {
    const user = userEvent.setup()
    render(<Note />, { wrapper: Wrapper })

    await user.click(screen.getByRole('button', { name: 'Dismiss: Why confidence dropped' }))

    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEYS.dismissedExplanations)).toContain('confidence-gap')
  })

  it('stays hidden on a later mount under the default weekly policy', () => {
    localStorage.setItem(STORAGE_KEYS.dismissedExplanations, JSON.stringify({ 'confidence-gap': Date.now() }))

    render(<Note />, { wrapper: Wrapper })

    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('reappears under the weekly policy once seven days have passed', () => {
    const eightDaysAgo = Date.now() - WEEKLY_REAPPEAR_MS - 1000
    localStorage.setItem(STORAGE_KEYS.dismissedExplanations, JSON.stringify({ 'confidence-gap': eightDaysAgo }))

    render(<Note />, { wrapper: Wrapper })

    expect(screen.getByRole('note')).toBeInTheDocument()
  })

  it('honours the saved "never" policy even after a week has passed', async () => {
    const tenWeeksAgo = Date.now() - WEEKLY_REAPPEAR_MS * 10
    localStorage.setItem(STORAGE_KEYS.dismissedExplanations, JSON.stringify({ 'confidence-gap': tenWeeksAgo }))
    vi.mocked(idbCache.get).mockResolvedValueOnce({ ...DEFAULT_PREFERENCES, explanationReappearPolicy: 'never' })

    render(<Note />, { wrapper: Wrapper })

    // Under the default weekly policy this note would be visible, so waiting for it to disappear
    // proves the saved "never" preference loaded and took effect.
    await waitFor(() => expect(screen.queryByRole('note')).not.toBeInTheDocument())
    expect(idbCache.get).toHaveBeenCalled()
  })

  it('shows a dismissed note again under the saved "always" policy', async () => {
    localStorage.setItem(STORAGE_KEYS.dismissedExplanations, JSON.stringify({ 'confidence-gap': Date.now() }))
    vi.mocked(idbCache.get).mockResolvedValueOnce({ ...DEFAULT_PREFERENCES, explanationReappearPolicy: 'always' })

    render(<Note />, { wrapper: Wrapper })

    await waitFor(() => expect(screen.getByRole('note', { name: 'Why confidence dropped' })).toBeInTheDocument())
  })

  it('does not hide other explanations when one is dismissed', async () => {
    const user = userEvent.setup()
    render(
      <>
        <Note />
        <DismissibleExplanation id="other" title="Other note">
          Something else.
        </DismissibleExplanation>
      </>,
      { wrapper: Wrapper },
    )

    await user.click(screen.getByRole('button', { name: 'Dismiss: Why confidence dropped' }))

    expect(screen.getByRole('note', { name: 'Other note' })).toBeInTheDocument()
  })
})
