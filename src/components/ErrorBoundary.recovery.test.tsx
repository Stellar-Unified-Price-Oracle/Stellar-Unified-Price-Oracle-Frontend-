import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

let broken = true

function FlakyPanel() {
  if (broken) throw new Error('bad saved layout')
  return <p>panel content</p>
}

describe('ErrorBoundary recovery actions', () => {
  beforeEach(() => {
    broken = true
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders no context actions when none are supplied', () => {
    render(
      <ErrorBoundary featureLabel="Price Cards">
        <FlakyPanel />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('button', { name: 'Retry Price Cards' })).toBeInTheDocument()
    const contextButtons = screen
      .getAllByRole('button')
      .filter((b) => !['Retry', 'Show details'].includes(b.textContent ?? ''))
    expect(contextButtons).toHaveLength(0)
  })

  it('runs the matching action and retries the subtree so the fix takes effect', () => {
    const onAction = vi.fn(() => {
      broken = false
    })
    render(
      <ErrorBoundary featureLabel="Price Cards" recoveryActions={[{ label: 'Reset card order', onAction }]}>
        <FlakyPanel />
      </ErrorBoundary>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reset card order for Price Cards' }))

    expect(onAction).toHaveBeenCalledTimes(1)
    expect(screen.getByText('panel content')).toBeInTheDocument()
  })

  it('keeps the fallback visible when the action does not fix the error', () => {
    const onAction = vi.fn()
    render(
      <ErrorBoundary featureLabel="Price Table" recoveryActions={[{ label: 'Switch to card view', onAction }]}>
        <FlakyPanel />
      </ErrorBoundary>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Switch to card view for Price Table' }))

    expect(onAction).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
