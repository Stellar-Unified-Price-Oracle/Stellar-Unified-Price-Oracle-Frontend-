import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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

function defaultKey<T>(item: T): string {
  return typeof item === 'string' || typeof item === 'number' ? String(item) : JSON.stringify(item)
}

/**
 * Hook for drag-and-drop reordering of a list.
 *
 * Ordering is owned by this hook (tracked as a stable list of item keys),
 * while the rendered item objects always come from the *current* upstream
 * `items` prop. That way live updates to item contents (e.g. a WebSocket
 * price tick that mutates nothing about the list's length or keys) flow
 * straight through to the DOM instead of being frozen inside stale internal
 * state — the previous length-only sync never picked them up.
 *
 * - Items added upstream are appended after the existing order; removed items
 *   are dropped from the order.
 * - Dragging calls `onReorder` with the reordered array; the hook keeps the
 *   new order (the parent may also persist it, e.g. a user preference).
 *
 * @param items - The current upstream list
 * @param onReorder - Called with the reordered array after a successful drop
 * @param getKey - Extracts a stable identity for each item (defaults to the
 *   item itself for primitives)
 */
export function useDragSort<T>(
  items: T[],
  onReorder: (reordered: T[]) => void,
  getKey: (item: T) => string = defaultKey,
): UseDragSortReturn<T> {
  // Display order as a stable key sequence. Persists across renders (and
  // across upstream value-only updates) so a user's reorder is not lost.
  const [orderKeys, setOrderKeys] = useState<string[]>(() => items.map(getKey))
  const [dragState, setDragState] = useState<DragSortState>({ dragIndex: null, overIndex: null })
  const dragIndexRef = useRef<number | null>(null)
  const orderKeysRef = useRef(orderKeys)
  orderKeysRef.current = orderKeys
  const onReorderRef = useRef(onReorder)
  onReorderRef.current = onReorder
  const getKeyRef = useRef(getKey)
  getKeyRef.current = getKey

  // Reconcile the stored order with the upstream key set whenever it changes
  // (pairs/columns added or removed): keep existing keys in their current
  // positions and append any newcomers. Pure key-set comparisons mean
  // value-only updates never touch the order.
  useEffect(() => {
    const current = orderKeysRef.current
    const nextKeys = items.map((item) => getKeyRef.current(item))
    const currentSet = new Set(current)
    const nextSet = new Set(nextKeys)
    if (nextKeys.every((k) => currentSet.has(k)) && currentSet.size === nextSet.size) return

    const kept = current.filter((k) => nextSet.has(k))
    const added = nextKeys.filter((k) => !currentSet.has(k))
    const merged = [...kept, ...added]
    if (merged.join('\u0000') !== current.join('\u0000')) setOrderKeys(merged)
  }, [items])

  // Always resolve the order against the current upstream items so item
  // references (and therefore their values) are never stale.
  const orderedItems = useMemo<T[]>(() => {
    const byKey = new Map(items.map((item) => [getKeyRef.current(item), item]))
    const seen = new Set<string>()
    const result: T[] = []
    for (const key of orderKeys) {
      const item = byKey.get(key)
      if (item !== undefined && !seen.has(key)) {
        result.push(item)
        seen.add(key)
      }
    }
    for (const item of items) {
      const key = getKeyRef.current(item)
      if (!seen.has(key)) {
        result.push(item)
        seen.add(key)
      }
    }
    return result
  }, [items, orderKeys])

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

      const keys = [...orderKeysRef.current]
      const [moved] = keys.splice(dragIndex, 1)
      keys.splice(dropIndex, 0, moved)

      setOrderKeys(keys)
      setDragState({ dragIndex: null, overIndex: null })
      dragIndexRef.current = null
      onReorderRef.current(keys.map((k) => items.find((item) => getKeyRef.current(item) === k) as T))
    },
    // items must be fresh at drop time so the reordered payload carries the
    // latest values, not a stale snapshot from when the drag started.
    [items],
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

  return { items: orderedItems, dragState, getItemProps }
}
