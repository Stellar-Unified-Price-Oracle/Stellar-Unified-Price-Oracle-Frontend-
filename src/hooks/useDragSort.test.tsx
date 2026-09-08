import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDragSort } from './useDragSort'

interface Item {
  id: string
  label: string
}

const items = (): Item[] => [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
]

function fakeDragEvent() {
  return {
    preventDefault: vi.fn(),
    dataTransfer: { effectAllowed: '', dropEffect: '', setData: vi.fn() },
  } as unknown as React.DragEvent
}

/** Drags the item at `from` and drops it at `to`, the way the DOM would. */
function dragAndDrop(result: { current: ReturnType<typeof useDragSort<Item>> }, from: number, to: number): void {
  const dragEvent = fakeDragEvent()
  act(() => {
    result.current.getItemProps(from).onDragStart(dragEvent)
  })
  const dropEvent = fakeDragEvent()
  act(() => {
    result.current.getItemProps(to).onDrop(dropEvent)
  })
}

describe('useDragSort', () => {
  it('renders the latest upstream items when values change but keys/length do not', () => {
    const initial = items()
    const onReorder = vi.fn()
    const { result, rerender } = renderHook(({ list }) => useDragSort(list, onReorder, (item) => item.id), {
      initialProps: { list: initial },
    })

    expect(result.current.items.map((i) => i.label)).toEqual(['A', 'B', 'C'])

    // A live update replaces the objects in place — same ids, same length.
    const updated = [
      { id: 'a', label: 'A (live: 61,234)' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ]
    rerender({ list: updated })

    expect(result.current.items.map((i) => i.label)).toEqual(['A (live: 61,234)', 'B', 'C'])
  })

  it('appends newly added upstream items after the current order', () => {
    const initial = items()
    const onReorder = vi.fn()
    const { result, rerender } = renderHook(({ list }) => useDragSort(list, onReorder, (item) => item.id), {
      initialProps: { list: initial },
    })

    rerender({ list: [...initial, { id: 'd', label: 'D' }] })
    expect(result.current.items.map((i) => i.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('drops removed upstream items from the order', () => {
    const initial = items()
    const onReorder = vi.fn()
    const { result, rerender } = renderHook(({ list }) => useDragSort(list, onReorder, (item) => item.id), {
      initialProps: { list: initial },
    })

    rerender({ list: initial.filter((i) => i.id !== 'b') })
    expect(result.current.items.map((i) => i.id)).toEqual(['a', 'c'])
  })

  it('reports drops through onReorder and keeps the reordered list stable across updates', () => {
    const initial = items()
    const onReorder = vi.fn()
    const { result, rerender } = renderHook(({ list }) => useDragSort(list, onReorder, (item) => item.id), {
      initialProps: { list: initial },
    })

    // Drag the first card to the last slot.
    dragAndDrop(result, 0, 2)
    expect(result.current.items.map((i) => i.id)).toEqual(['b', 'c', 'a'])
    expect(onReorder).toHaveBeenCalledWith([initial[1], initial[2], initial[0]])

    // A subsequent value-only upstream update must not undo the reorder.
    rerender({ list: initial.map((i) => ({ ...i, label: i.label + '!' })) })
    expect(result.current.items.map((i) => i.id)).toEqual(['b', 'c', 'a'])
    expect(result.current.items.map((i) => i.label)).toEqual(['B!', 'C!', 'A!'])
  })
})
