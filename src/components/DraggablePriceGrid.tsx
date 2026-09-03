import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDragSort } from '../hooks/useDragSort'
import type { PriceData } from '../types'
import { PriceCard } from './PriceCard'

interface DraggablePriceGridProps {
  items: PriceData[]
  livePairs: Set<string>
  isStale?: boolean
  hasAlertFn: (pair: string) => boolean
  onCardClick: (pair: string) => void
  onAlertClick: (e: React.MouseEvent, pair: string) => void
  selectMode?: boolean
  selected?: Set<string>
  onReorder: (orderedPairs: string[]) => void
}

/**
 * A price card grid that supports drag-and-drop reordering via the HTML5
 * drag API. Delegates to {@link useDragSort} for state and calls `onReorder`
 * with the new ordered list of asset-pair strings whenever a card is dropped.
 */
export const DraggablePriceGrid = memo(function DraggablePriceGrid({
  items,
  livePairs,
  isStale,
  hasAlertFn,
  onCardClick,
  onAlertClick,
  selectMode,
  selected,
  onReorder,
}: DraggablePriceGridProps) {
  const { t } = useTranslation()

  const handleReorder = useCallback(
    (reordered: PriceData[]) => {
      onReorder(reordered.map((p) => p.assetPair))
    },
    [onReorder],
  )

  const { items: orderedItems, dragState, getItemProps } = useDragSort(items, handleReorder)

  return (
    <section
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
      aria-label={t('dashboard.feedsAriaLabel')}
    >
      {orderedItems.map((p, index) => {
        const dragProps = getItemProps(index)
        const isDragging = dragState.dragIndex === index
        const isOver = dragState.overIndex === index && dragState.dragIndex !== index

        return (
          <div
            key={p.assetPair}
            {...dragProps}
            className={[
              'transition-all duration-150 cursor-grab active:cursor-grabbing',
              isDragging ? 'opacity-40 scale-95' : '',
              isOver ? 'ring-2 ring-cyan-500/60 ring-offset-2 ring-offset-gray-950 rounded-xl' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            title={t('draggableGrid.dragHint')}
          >
            {/* Drag handle indicator */}
            <div
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 pointer-events-none z-10 text-gray-600"
              aria-hidden="true"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                <circle cx="5" cy="4" r="1.2" />
                <circle cx="11" cy="4" r="1.2" />
                <circle cx="5" cy="8" r="1.2" />
                <circle cx="11" cy="8" r="1.2" />
                <circle cx="5" cy="12" r="1.2" />
                <circle cx="11" cy="12" r="1.2" />
              </svg>
            </div>

            <PriceCard
              price={p}
              isLive={livePairs.has(p.assetPair)}
              isStale={isStale}
              hasAlert={hasAlertFn(p.assetPair)}
              onClick={onCardClick}
              onAlertClick={onAlertClick}
              selectMode={selectMode}
              isSelected={selected?.has(p.assetPair)}
            />
          </div>
        )
      })}
    </section>
  )
})
