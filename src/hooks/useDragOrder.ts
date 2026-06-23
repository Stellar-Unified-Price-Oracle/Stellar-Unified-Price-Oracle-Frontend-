import { useCallback, useRef, useState } from 'react'

export function useDragOrder<T extends string>(
  items: T[],
  onChange: (newOrder: T[]) => void,
) {
  const dragIndexRef = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const onDragStart = useCallback((index: number) => {
    dragIndexRef.current = index
  }, [])

  const onDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }, [])

  const onDrop = useCallback(
    (index: number) => {
      const from = dragIndexRef.current
      if (from === null || from === index) {
        dragIndexRef.current = null
        setDragOverIndex(null)
        return
      }
      const next = [...items]
      const [moved] = next.splice(from, 1)
      next.splice(index, 0, moved)
      onChange(next)
      dragIndexRef.current = null
      setDragOverIndex(null)
    },
    [items, onChange],
  )

  const onDragEnd = useCallback(() => {
    dragIndexRef.current = null
    setDragOverIndex(null)
  }, [])

  // Keyboard: arrow keys reorder, called from handle keydown
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (index === 0) return
        const next = [...items]
        ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
        onChange(next)
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        if (index === items.length - 1) return
        const next = [...items]
        ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
        onChange(next)
      }
    },
    [items, onChange],
  )

  const getHandleProps = useCallback(
    (index: number) => ({
      draggable: true as const,
      onDragStart: () => onDragStart(index),
      onDragOver: (e: React.DragEvent) => onDragOver(e, index),
      onDrop: () => onDrop(index),
      onDragEnd,
      onKeyDown: (e: React.KeyboardEvent) => onKeyDown(e, index),
    }),
    [onDragStart, onDragOver, onDrop, onDragEnd, onKeyDown],
  )

  return { getHandleProps, dragOverIndex }
}
