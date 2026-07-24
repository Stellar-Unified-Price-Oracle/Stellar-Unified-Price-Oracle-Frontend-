import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { ToastProvider, useToast, showApiErrorToast } from './ToastContext'

afterEach(cleanup)

function ToastConsumer() {
  const { toasts } = useToast()
  return (
    <ul>
      {toasts.map((t) => (
        <li key={t.id}>{`${t.type}: ${t.message}`}</li>
      ))}
    </ul>
  )
}

describe('ToastContext', () => {
  it('useToast throws when called outside a ToastProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<ToastConsumer />)).toThrow('useToast must be used within a ToastProvider')

    consoleSpy.mockRestore()
  })

  it('addToast adds a toast that useToast consumers can read', () => {
    function Trigger() {
      const { addToast } = useToast()
      return (
        <button onClick={() => addToast({ type: 'success', message: 'Saved!' })}>add</button>
      )
    }
    render(
      <ToastProvider>
        <Trigger />
        <ToastConsumer />
      </ToastProvider>,
    )

    act(() => {
      screen.getByText('add').click()
    })

    expect(screen.getByText('success: Saved!')).toBeInTheDocument()
  })

  it('removeToast removes a toast by id', () => {
    function Trigger() {
      const { addToast, removeToast, toasts } = useToast()
      return (
        <>
          <button onClick={() => addToast({ type: 'info', message: 'Hello' })}>add</button>
          {toasts.map((t) => (
            <button key={t.id} onClick={() => removeToast(t.id)}>
              remove
            </button>
          ))}
        </>
      )
    }
    render(
      <ToastProvider>
        <Trigger />
        <ToastConsumer />
      </ToastProvider>,
    )

    act(() => {
      screen.getByText('add').click()
    })
    expect(screen.getByText('info: Hello')).toBeInTheDocument()

    act(() => {
      screen.getByText('remove').click()
    })
    expect(screen.queryByText('info: Hello')).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // showApiErrorToast — the bridge used by src/api/rest.ts (#184)
  // ---------------------------------------------------------------------------
  describe('showApiErrorToast', () => {
    it('is a safe no-op when no ToastProvider is mounted', () => {
      expect(() => showApiErrorToast('should not throw')).not.toThrow()
    })

    it('adds an error toast once a ToastProvider is mounted', () => {
      render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>,
      )

      act(() => {
        showApiErrorToast('API is down')
      })

      expect(screen.getByText('error: API is down')).toBeInTheDocument()
    })

    it('stops delivering to a provider after it unmounts, without throwing', () => {
      const { unmount } = render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>,
      )
      unmount()

      expect(() => showApiErrorToast('after unmount')).not.toThrow()
    })

    it('delivers to whichever ToastProvider is currently mounted (remount re-registers)', () => {
      const first = render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>,
      )
      first.unmount()

      render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>,
      )

      act(() => {
        showApiErrorToast('second mount')
      })

      expect(screen.getByText('error: second mount')).toBeInTheDocument()
    })
  })
})
