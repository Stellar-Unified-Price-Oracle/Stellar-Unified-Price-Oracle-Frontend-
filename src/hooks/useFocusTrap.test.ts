import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFocusTrap } from './useFocusTrap'

describe('useFocusTrap', () => {
  it('returns a ref and keyDown handler', () => {
    const { result } = renderHook(() => useFocusTrap())
    expect(result.current.containerRef).toBeDefined()
    expect(typeof result.current.handleKeyDown).toBe('function')
  })

  it('calls preventDefault on Tab when focused on last element', () => {
    const { result } = renderHook(() => useFocusTrap())

    const container = document.createElement('div')
    const btn1 = document.createElement('button')
    const btn2 = document.createElement('button')
    container.appendChild(btn1)
    container.appendChild(btn2)
    document.body.appendChild(container)

    result.current.containerRef.current = container

    const tabEvent = {
      key: 'Tab',
      shiftKey: false,
      preventDefault: vi.fn(),
    }

    expect(() => result.current.handleKeyDown(tabEvent as unknown as React.KeyboardEvent)).not.toThrow()

    document.body.removeChild(container)
  })

  it('calls preventDefault on Shift+Tab when focused on first element', () => {
    const { result } = renderHook(() => useFocusTrap())

    const container = document.createElement('div')
    const btn1 = document.createElement('button')
    const btn2 = document.createElement('button')
    container.appendChild(btn1)
    container.appendChild(btn2)
    document.body.appendChild(container)

    result.current.containerRef.current = container

    const shiftTabEvent = {
      key: 'Tab',
      shiftKey: true,
      preventDefault: vi.fn(),
    }

    expect(() => result.current.handleKeyDown(shiftTabEvent as unknown as React.KeyboardEvent)).not.toThrow()

    document.body.removeChild(container)
  })

  it('does not prevent default for non-Tab keys', () => {
    const { result } = renderHook(() => useFocusTrap())

    const event = {
      key: 'Enter',
      preventDefault: vi.fn(),
    }

    result.current.handleKeyDown(event as unknown as React.KeyboardEvent)
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('does nothing when container ref is null', () => {
    const { result } = renderHook(() => useFocusTrap())

    const event = {
      key: 'Tab',
      shiftKey: false,
      preventDefault: vi.fn(),
    }

    result.current.handleKeyDown(event as unknown as React.KeyboardEvent)
    expect(event.preventDefault).not.toHaveBeenCalled()
  })
})
