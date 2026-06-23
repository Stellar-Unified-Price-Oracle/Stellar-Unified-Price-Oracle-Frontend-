import { useState, useCallback, useRef } from 'react'

const LS_ORDER_KEY = 'dashboard:cardOrder'
const LS_VIEW_KEY = 'dashboard:viewMode'

export type ViewMode = 'card' | 'table'

function loadOrder(): string[] {
  try {
    const raw = localStorage.getItem(LS_ORDER_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function saveOrder(order: string[]) {
  try {
    localStorage.setItem(LS_ORDER_KEY, JSON.stringify(order))
  } catch {
    // ignore quota errors
  }
}

function loadViewMode(): ViewMode {
  try {
    const raw = localStorage.getItem(LS_VIEW_KEY)
    return raw === 'table' ? 'table' : 'card'
  } catch {
    return 'card'
  }
}

function saveViewMode(mode: ViewMode) {
  try {
    localStorage.setItem(LS_VIEW_KEY, mode)
  } catch {
    // ignore
  }
}

/**
 * Applies a saved order to a list of items.
 * Items not in the saved order are appended at the end (preserving new pairs).
 */
export function applyOrder<T extends { assetPair: string }>(items: T[], order: string[]): T[] {
  if (order.length === 0) return items
  const indexed = new Map(items.map((item) => [item.assetPair, item]))
  const known = order.flatMap((pair) => {
    const item = indexed.get(pair)
    return item ? [item] : []
  })
  const knownSet = new Set(order)
  const rest = items.filter((item) => !knownSet.has(item.assetPair))
  return [...known, ...rest]
}

export function useDashboardPrefs() {
  const [cardOrder, setCardOrder] = useState<string[]>(loadOrder)
  const [viewMode, setViewModeSt] = useState<ViewMode>(loadViewMode)

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeSt(mode)
    saveViewMode(mode)
  }, [])

  const updateOrder = useCallback((newOrder: string[]) => {
    setCardOrder(newOrder)
    saveOrder(newOrder)
  }, [])

  return { cardOrder, updateOrder, viewMode, setViewMode }
}

// ---- Drag-and-drop helpers ----

export interface DragState {
  dragIndex: number | null
  overIndex: number | null
}

export function useDragAndDrop(items: string[], onReorder: (newOrder: string[]) => void) {
  const dragIndexRef = useRef<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const onDragStart = useCallback((index: number) => {
    dragIndexRef.current = index
  }, [])

  const onDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault()
      if (dragIndexRef.current !== null && dragIndexRef.current !== index) {
        setOverIndex(index)
      }
    },
    [],
  )

  const onDrop = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault()
      const from = dragIndexRef.current
      if (from === null || from === index) {
        setOverIndex(null)
        return
      }
      const next = [...items]
      const [moved] = next.splice(from, 1)
      next.splice(index, 0, moved)
      onReorder(next)
      dragIndexRef.current = null
      setOverIndex(null)
    },
    [items, onReorder],
  )

  const onDragEnd = useCallback(() => {
    dragIndexRef.current = null
    setOverIndex(null)
  }, [])

  return { onDragStart, onDragOver, onDrop, onDragEnd, overIndex }
}
