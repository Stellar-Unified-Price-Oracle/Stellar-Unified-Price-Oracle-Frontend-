import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { checkAccessibility } from '../test/accessibility'
import { OfflineUnavailableNotice } from './OfflineUnavailableNotice'

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value })
}

afterEach(() => {
  cleanup()
  setOnline(true)
})

describe('OfflineUnavailableNotice', () => {
  it('explains that nothing is cached while offline and offers retry', () => {
    setOnline(false)
    const onRetry = vi.fn()
    render(<OfflineUnavailableNotice onRetry={onRetry} />)
    act(() => window.dispatchEvent(new Event('offline')))

    expect(screen.getByText('No prices available offline')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading prices' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('renders nothing while online', () => {
    setOnline(true)
    const { container } = render(<OfflineUnavailableNotice onRetry={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('has no accessibility violations while offline', async () => {
    setOnline(false)
    const notice = <OfflineUnavailableNotice onRetry={vi.fn()} />
    render(notice)
    await checkAccessibility(notice)
  })
})
