import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'
import { checkAccessibility } from '../test/accessibility'

afterEach(cleanup)

const Bomb = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) throw new Error('💥')
  return <div>Safe</div>
}

describe('ErrorBoundary', () => {
  it('should have no accessibility violations (children)', async () => {
    await checkAccessibility(
      <ErrorBoundary>
        <div>Hello</div>
      </ErrorBoundary>,
    )
  })

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Hello</div>
      </ErrorBoundary>,
    )
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('renders fallback UI on error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('💥')).toBeInTheDocument()
    expect(screen.getByText('Reload page')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('renders custom fallback when provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary fallback={<div>Custom Error</div>}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Custom Error')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('calls onError callback when error is caught', () => {
    const onError = vi.fn()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary onError={onError}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    )
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ componentStack: expect.any(String) }))
    spy.mockRestore()
  })

  it('logs error to console.error in componentDidCatch', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    )
    expect(spy).toHaveBeenCalledWith('ErrorBoundary caught:', expect.any(Error), expect.any(String))
    spy.mockRestore()
  })

  it('resets error state when key prop changes (navigation)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(
      <ErrorBoundary key="1">
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    rerender(
      <ErrorBoundary key="2">
        <div>Navigated</div>
      </ErrorBoundary>,
    )
    expect(screen.getByText('Navigated')).toBeInTheDocument()
    spy.mockRestore()
  })
})

describe('snapshots', () => {
  it('children', () => {
    const { container } = render(
      <ErrorBoundary>
        <div>Safe</div>
      </ErrorBoundary>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('error fallback', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    )
    expect(container.firstChild).toMatchSnapshot()
    spy.mockRestore()
  })

  it('custom fallback', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(
      <ErrorBoundary fallback={<div>Custom Error</div>}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    )
    expect(container.firstChild).toMatchSnapshot()
    spy.mockRestore()
  })
})
