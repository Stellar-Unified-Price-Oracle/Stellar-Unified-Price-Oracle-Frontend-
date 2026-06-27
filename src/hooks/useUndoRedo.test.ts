import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUndoRedo, type Command } from './useUndoRedo'

describe('useUndoRedo', () => {
  it('returns initial state', () => {
    const { result } = renderHook(() => useUndoRedo(0))
    expect(result.current.state).toBe(0)
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('executes a command and updates state', () => {
    const { result } = renderHook(() => useUndoRedo(0))
    const add1: Command<number> = { apply: (s) => s + 1, undo: (s) => s - 1 }

    act(() => result.current.execute(add1))
    expect(result.current.state).toBe(1)
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)
  })

  it('undo reverts the last command', () => {
    const { result } = renderHook(() => useUndoRedo(0))
    const add1: Command<number> = { apply: (s) => s + 1, undo: (s) => s - 1 }

    act(() => result.current.execute(add1))
    act(() => result.current.undo())
    expect(result.current.state).toBe(0)
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)
  })

  it('redo reapplies the last undone command', () => {
    const { result } = renderHook(() => useUndoRedo(0))
    const add1: Command<number> = { apply: (s) => s + 1, undo: (s) => s - 1 }

    act(() => result.current.execute(add1))
    act(() => result.current.undo())
    act(() => result.current.redo())
    expect(result.current.state).toBe(1)
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)
  })

  it('clears future stack when executing a new command after undo', () => {
    const { result } = renderHook(() => useUndoRedo(0))
    const add1: Command<number> = { apply: (s) => s + 1, undo: (s) => s - 1 }
    const add5: Command<number> = { apply: (s) => s + 5, undo: (s) => s - 5 }

    act(() => result.current.execute(add1))
    act(() => result.current.undo())
    act(() => result.current.execute(add5))
    expect(result.current.state).toBe(5)
    expect(result.current.canRedo).toBe(false)
  })

  it('clear removes all history without changing present', () => {
    const { result } = renderHook(() => useUndoRedo(0))
    const add1: Command<number> = { apply: (s) => s + 1, undo: (s) => s - 1 }

    act(() => result.current.execute(add1))
    act(() => result.current.execute(add1))
    act(() => result.current.undo())
    act(() => result.current.clear())
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
    expect(result.current.state).toBe(1)
  })

  it('reset replaces state and clears history', () => {
    const { result } = renderHook(() => useUndoRedo(0))
    const add1: Command<number> = { apply: (s) => s + 1, undo: (s) => s - 1 }

    act(() => result.current.execute(add1))
    act(() => result.current.reset(100))
    expect(result.current.state).toBe(100)
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('respects maxDepth limit', () => {
    const { result } = renderHook(() => useUndoRedo(0, 2))
    const add1: Command<number> = { apply: (s) => s + 1, undo: (s) => s - 1 }

    act(() => result.current.execute(add1))
    act(() => result.current.execute(add1))
    act(() => result.current.execute(add1))
    act(() => result.current.execute(add1))
    expect(result.current.undoCount).toBe(2)
    expect(result.current.state).toBe(4)

    act(() => result.current.undo())
    act(() => result.current.undo())
    expect(result.current.state).toBe(2)
    expect(result.current.canUndo).toBe(false)
    expect(result.current.undoCount).toBe(0)
  })

  it('handles multiple undo/redo cycles', () => {
    const { result } = renderHook(() => useUndoRedo(0))
    const add1: Command<number> = { apply: (s) => s + 1, undo: (s) => s - 1 }

    act(() => result.current.execute(add1))
    act(() => result.current.execute(add1))
    act(() => result.current.execute(add1))
    act(() => result.current.undo())
    act(() => result.current.redo())
    act(() => result.current.redo())
    expect(result.current.state).toBe(3)
  })

  it('does nothing on undo when past is empty', () => {
    const { result } = renderHook(() => useUndoRedo(42))
    act(() => result.current.undo())
    expect(result.current.state).toBe(42)
  })

  it('does nothing on redo when future is empty', () => {
    const { result } = renderHook(() => useUndoRedo(42))
    act(() => result.current.redo())
    expect(result.current.state).toBe(42)
  })
})
