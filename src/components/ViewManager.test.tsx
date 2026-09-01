import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ViewManager } from './ViewManager'
import { idbCache } from '../hooks/useIndexedDB'

// Wrap in ToastContext
import { ToastProvider } from '../context/ToastContext'
import type { ReactNode } from 'react'

afterEach(() => {
  cleanup()
  idbCache._reset()
})

beforeEach(() => {
  idbCache._reset()
  idbCache._disableSyncQueue()
})

function Wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}

describe('ViewManager', () => {
  it('renders the "Saved Views" trigger button', () => {
    render(
      <Wrapper>
        <ViewManager />
      </Wrapper>,
    )
    expect(screen.getByRole('button', { name: /saved views/i })).toBeInTheDocument()
  })

  it('opens the popover when the trigger is clicked', async () => {
    const user = userEvent.setup()
    render(
      <Wrapper>
        <ViewManager />
      </Wrapper>,
    )
    await user.click(screen.getByRole('button', { name: /saved views/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('shows a "Save current view" form when the panel is open', async () => {
    const user = userEvent.setup()
    render(
      <Wrapper>
        <ViewManager />
      </Wrapper>,
    )
    await user.click(screen.getByRole('button', { name: /saved views/i }))
    expect(screen.getByPlaceholderText(/my view/i)).toBeInTheDocument()
  })

  it('closes the popover when Escape is pressed', async () => {
    const user = userEvent.setup()
    render(
      <Wrapper>
        <ViewManager />
      </Wrapper>,
    )
    await user.click(screen.getByRole('button', { name: /saved views/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })

  it('saves a new view when the form is submitted', async () => {
    const user = userEvent.setup()
    render(
      <Wrapper>
        <ViewManager currentSearch="BTC" currentViewMode="grid" />
      </Wrapper>,
    )
    await user.click(screen.getByRole('button', { name: /saved views/i }))
    const nameInput = screen.getByPlaceholderText(/name|view name/i)
    await user.type(nameInput, 'My BTC View')
    await user.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(screen.queryByText('My BTC View')).toBeInTheDocument())
  })

  it('renders without crashing when no current props are provided', () => {
    expect(() =>
      render(
        <Wrapper>
          <ViewManager />
        </Wrapper>,
      ),
    ).not.toThrow()
  })
})
