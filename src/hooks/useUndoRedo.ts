import { useState, useCallback, useRef } from 'react'

export interface Command<T> {
  apply: (state: T) => T
  undo: (state: T) => T
  description?: string
}

interface UndoRedoState<T> {
  past: Command<T>[]
  present: T
  future: Command<T>[]
}

export function useUndoRedo<T>(initialState: T, maxDepth: number = 20) {
  const maxDepthRef = useRef(maxDepth)
  maxDepthRef.current = maxDepth

  const [state, setState] = useState<UndoRedoState<T>>({
    past: [],
    present: initialState,
    future: [],
  })

  const execute = useCallback((command: Command<T>) => {
    setState((prev) => {
      const newPast = [...prev.past, command]
      if (newPast.length > maxDepthRef.current) {
        newPast.splice(0, newPast.length - maxDepthRef.current)
      }
      return {
        past: newPast,
        present: command.apply(prev.present),
        future: [],
      }
    })
  }, [])

  const undo = useCallback(() => {
    setState((prev) => {
      if (prev.past.length === 0) return prev
      const command = prev.past[prev.past.length - 1]
      return {
        past: prev.past.slice(0, -1),
        present: command.undo(prev.present),
        future: [...prev.future, command],
      }
    })
  }, [])

  const redo = useCallback(() => {
    setState((prev) => {
      if (prev.future.length === 0) return prev
      const command = prev.future[prev.future.length - 1]
      return {
        past: [...prev.past, command],
        present: command.apply(prev.present),
        future: prev.future.slice(0, -1),
      }
    })
  }, [])

  const clear = useCallback(() => {
    setState((prev) => ({ ...prev, past: [], future: [] }))
  }, [])

  const reset = useCallback((newPresent: T) => {
    setState({ past: [], present: newPresent, future: [] })
  }, [])

  return {
    state: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    undoCount: state.past.length,
    redoCount: state.future.length,
    execute,
    undo,
    redo,
    clear,
    reset,
  }
}
