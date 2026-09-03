import { useCallback, useRef, useState } from 'react'

export interface DragSortState {
  dragIndex: number | null
  overIndex: number | null
}

export interface UseDragSortReturn<T> {
  items: T[]
  dragState: DragSortState
  /** Attach to the draggable container element */
  getItemProps: (index: number) => {
    draggable: true
    onDragStart: (e: React.DragEvent) => void
    onDragOver: (e: React.DragEvent) => void
    onDragEnter: (e: React.DragEvent) => void
    onDragLeave: (e: React.DragEvent) => void
    onDrop: (e: React.DragEvent) => void
    onDragEnd: (e: React.DragEvent) => void
    'aria-grabbed': boolean
    'data-drag-index': number
  }
}

/**
 * Hook for drag-and-drop reordering of a list.
 *
 * Manages drag state internally and calls `onReorder` with the reordered array
 * when a drop is completed. Uses the HTML5 drag-and-drop API — no extra
 * dependencies needed.
 *
 * @param initialItems - The list to reorder
 * @param onReorder - Called with the reordered array after a successful drop
 */
export function useDragSort<T>(
  initialItems: T[],
  onReorder: (reordered: T[]) => void,
): UseDragSortReturn<T> {
  const [items, setItems] = useState<T[]>(initialItems)
  const [dragState, setDragState] = useState<DragSortState>({ dragIndex: null, overIndex: null })
  const dragIndexRef = useRef<number | null>(null)

  // Keep items in sync when the upstream list changes (e.g. initial load)
  // by replacing items only when the list identity changes length or keys.
  // We do this via a ref comparison to avoid a render loop.
  const prevItemsRef = useRef<T[]>(initialItems)
  if (prevItemsRef.current !== initialItems && initialItems.length !== items.length) {
    prevItemsRef.current = initialItems
    setItems(initialItems)
  }

  const onDragStart = useCallback((e: React.DragEvent, index: number) => {
    dragIndexRef.current = index
    setDragState({ dragIndex: index, overIndex: null })
    // Set drag data so the browser's ghost image works
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }, [])

  const onDragOver = useCallback((e: React.DragEvent, overIndex: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const dragIndex = dragIndexRef.current
    if (dragIndex === null || dragIndex === overIndex) return
    setDragState((prev) => (prev.overIndex === overIndex ? prev : { ...prev, overIndex }))
  }, [])

  const onDragEnter = useCallback((e: React.DragEvent, overIndex: number) => {
    e.preventDefault()
    const dragIndex = dragIndexRef.current
    if (dragIndex === null || dragIndex === overIndex) return
    setDragState((prev) => ({ ...prev, overIndex }))
  }, [])

  const onDragLeave = useCallback((_e: React.DragEvent, _index: number) => {
    // Only clear overIndex; keep dragIndex so visual state is stable
    // We don't clear here to avoid flickering between adjacent items
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault()
      const dragIndex = dragIndexRef.current
      if (dragIndex === null || dragIndex === dropIndex) {
        setDragState({ dragIndex: null, overIndex: null })
        dragIndexRef.current = null
        return
      }

      const reordered = [...items]
      const [removed] = reordered.splice(dragIndex, 1)
      reordered.splice(dropIndex, 0, removed)

      setItems(reordered)
      setDragState({ dragIndex: null, overIndex: null })
      dragIndexRef.current = null
      onReorder(reordered)
    },
    [items, onReorder],
  )

  const onDragEnd = useCallback((_e: React.DragEvent) => {
    setDragState({ dragIndex: null, overIndex: null })
    dragIndexRef.current = null
  }, [])

  const getItemProps = useCallback(
    (index: number) => ({
      draggable: true as const,
      onDragStart: (e: React.DragEvent) => onDragStart(e, index),
      onDragOver: (e: React.DragEvent) => onDragOver(e, index),
      onDragEnter: (e: React.DragEvent) => onDragEnter(e, index),
      onDragLeave: (e: React.DragEvent) => onDragLeave(e, index),
      onDrop: (e: React.DragEvent) => onDrop(e, index),
      onDragEnd: (e: React.DragEvent) => onDragEnd(e),
      'aria-grabbed': dragState.dragIndex === index,
      'data-drag-index': index,
    }),
    [dragState.dragIndex, onDragStart, onDragOver, onDragEnter, onDragLeave, onDrop, onDragEnd],
  )

  return { items, dragState, getItemProps }
}
