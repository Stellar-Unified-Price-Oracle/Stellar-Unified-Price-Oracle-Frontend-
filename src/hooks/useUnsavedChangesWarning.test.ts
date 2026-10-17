import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useUnsavedChangesWarning } from './useUnsavedChangesWarning'

// Dispatches a real beforeunload event and reports whether a listener cancelled it.
function fireBeforeUnload(): boolean {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

afterEach(cleanup)

describe('useUnsavedChangesWarning', () => {
  it('does not interfere with unload when there is nothing unapplied', () => {
    renderHook(() => useUnsavedChangesWarning(false))

    expect(fireBeforeUnload()).toBe(false)
  })

  it('cancels unload while there are unapplied changes', () => {
    renderHook(() => useUnsavedChangesWarning(true))

    expect(fireBeforeUnload()).toBe(true)
  })

  it('stops warning once the changes are cleared', () => {
    const { rerender } = renderHook(({ dirty }) => useUnsavedChangesWarning(dirty), {
      initialProps: { dirty: true },
    })
    expect(fireBeforeUnload()).toBe(true)

    rerender({ dirty: false })

    expect(fireBeforeUnload()).toBe(false)
  })

  it('removes its listener on unmount', () => {
    const { unmount } = renderHook(() => useUnsavedChangesWarning(true))

    unmount()

    expect(fireBeforeUnload()).toBe(false)
  })
})
