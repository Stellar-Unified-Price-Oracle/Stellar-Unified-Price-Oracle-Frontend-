import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDragOrder } from './useDragOrder'

const items = ['BTC/USD', 'ETH/USD', 'XLM/USD']

describe('useDragOrder', () => {
  it('returns getHandleProps and dragOverIndex', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useDragOrder(items, onChange))
    expect(typeof result.current.getHandleProps).toBe('function')
    expect(result.current.dragOverIndex).toBeNull()
  })

  it('getHandleProps returns draggable and event handlers', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useDragOrder(items, onChange))
    const props = result.current.getHandleProps(0)
    expect(props.draggable).toBe(true)
    expect(typeof props.onDragStart).toBe('function')
    expect(typeof props.onDragOver).toBe('function')
    expect(typeof props.onDrop).toBe('function')
    expect(typeof props.onDragEnd).toBe('function')
    expect(typeof props.onKeyDown).toBe('function')
  })

  it('sets dragOverIndex on dragOver', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useDragOrder(items, onChange))
    act(() => {
      result.current.getHandleProps(1).onDragOver({ preventDefault: vi.fn() } as unknown as React.DragEvent)
    })
    expect(result.current.dragOverIndex).toBe(1)
  })

  it('clears dragOverIndex on dragEnd', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useDragOrder(items, onChange))
    act(() => {
      result.current.getHandleProps(1).onDragOver({ preventDefault: vi.fn() } as unknown as React.DragEvent)
    })
    act(() => {
      result.current.getHandleProps(0).onDragEnd()
    })
    expect(result.current.dragOverIndex).toBeNull()
  })

  it('calls onChange with reordered items on drop', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useDragOrder(items, onChange))
    act(() => result.current.getHandleProps(0).onDragStart())
    act(() => result.current.getHandleProps(2).onDrop())
    expect(onChange).toHaveBeenCalledWith(['ETH/USD', 'XLM/USD', 'BTC/USD'])
  })

  it('does not call onChange when dropping on same index', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useDragOrder(items, onChange))
    act(() => result.current.getHandleProps(1).onDragStart())
    act(() => result.current.getHandleProps(1).onDrop())
    expect(onChange).not.toHaveBeenCalled()
  })

  it('moves item left with ArrowLeft key', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useDragOrder(items, onChange))
    act(() => {
      result.current.getHandleProps(1).onKeyDown({ key: 'ArrowLeft', preventDefault: vi.fn() } as unknown as React.KeyboardEvent)
    })
    expect(onChange).toHaveBeenCalledWith(['ETH/USD', 'BTC/USD', 'XLM/USD'])
  })

  it('moves item right with ArrowRight key', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useDragOrder(items, onChange))
    act(() => {
      result.current.getHandleProps(1).onKeyDown({ key: 'ArrowRight', preventDefault: vi.fn() } as unknown as React.KeyboardEvent)
    })
    expect(onChange).toHaveBeenCalledWith(['BTC/USD', 'XLM/USD', 'ETH/USD'])
  })

  it('does not move first item left', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useDragOrder(items, onChange))
    act(() => {
      result.current.getHandleProps(0).onKeyDown({ key: 'ArrowLeft', preventDefault: vi.fn() } as unknown as React.KeyboardEvent)
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not move last item right', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => useDragOrder(items, onChange))
    act(() => {
      result.current.getHandleProps(2).onKeyDown({ key: 'ArrowRight', preventDefault: vi.fn() } as unknown as React.KeyboardEvent)
    })
    expect(onChange).not.toHaveBeenCalled()
  })
})
