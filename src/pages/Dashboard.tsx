import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { usePriceContext } from '../context/PriceContext'
import { useAlerts } from '../hooks/useAlerts'
import { useColumnCount } from '../hooks/useColumnCount'
import { useDashboardPrefs, useDragAndDrop, applyOrder } from '../hooks/useDashboardPrefs'
import { PriceCard } from '../components/PriceCard'
import { PriceCardSkeleton } from '../components/PriceCardSkeleton'
import { PriceTable } from '../components/PriceTable'
import { AlertModal } from '../components/AlertModal'
import { AlertBadge } from '../components/AlertBadge'
import { ConnectionBadge } from '../components/ConnectionBadge'
import { NetworkStatusBanner } from '../components/NetworkStatusBanner'
import { FilterBar } from '../components/FilterBar'
import type { AlertFormData, PriceData } from '../types'

const ROW_HEIGHT = 200
const SKELETON_COUNT = 8

function mergePrices(
  restPrices: PriceData[],
  livePrices: Map<string, PriceData>,
): PriceData[] {
  return restPrices.map((p) => {
    const live = livePrices.get(p.assetPair)
    if (live && live.timestamp >= p.timestamp) {
      return { ...p, ...live }
    }
    return p
  })
}

// --- View toggle button ---
function ViewToggle({ mode, onChange }: { mode: 'card' | 'table'; onChange: (m: 'card' | 'table') => void }) {
  return (
    <div
      className="flex items-center bg-gray-800 border border-gray-700 rounded-lg overflow-hidden"
      role="group"
      aria-label="View mode"
    >
      <button
        type="button"
        onClick={() => onChange('card')}
        aria-pressed={mode === 'card'}
        aria-label="Card view"
        className={`px-3 py-1.5 text-sm transition-colors ${mode === 'card' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="2" y="2" width="9" height="9" rx="1" />
          <rect x="13" y="2" width="9" height="9" rx="1" />
          <rect x="2" y="13" width="9" height="9" rx="1" />
          <rect x="13" y="13" width="9" height="9" rx="1" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onChange('table')}
        aria-pressed={mode === 'table'}
        aria-label="Table view"
        className={`px-3 py-1.5 text-sm transition-colors ${mode === 'table' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 4v16M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" />
        </svg>
      </button>
    </div>
  )
}

// --- Draggable card grid ---
interface DraggableCardGridProps {
  items: PriceData[]
  columns: number
  livePrices: Map<string, PriceData>
  pricesValidating: boolean
  hasAlertsForPair: (pair: string) => boolean
  onCardClick: (pair: string) => void
  onAlertClick: (e: React.MouseEvent, pair: string) => void
  onReorder: (newPairs: string[]) => void
  containerRef: React.RefObject<HTMLDivElement | null>
}

function DraggableCardGrid({
  items,
  columns,
  livePrices,
  pricesValidating,
  hasAlertsForPair,
  onCardClick,
  onAlertClick,
  onReorder,
  containerRef,
}: DraggableCardGridProps) {
  const pairs = useMemo(() => items.map((p) => p.assetPair), [items])
  const { onDragStart, onDragOver, onDrop, onDragEnd, overIndex } = useDragAndDrop(pairs, onReorder)

  const rowCount = Math.ceil(items.length / columns)
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: useCallback(() => document.documentElement, []),
    estimateSize: useCallback(() => ROW_HEIGHT, []),
    overscan: 5,
  })

  // Keyboard reorder: arrow keys on drag handle
  const handleKeyReorder = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (index === 0) return
        e.preventDefault()
        const next = [...pairs]
        ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
        onReorder(next)
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (index === pairs.length - 1) return
        e.preventDefault()
        const next = [...pairs]
        ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
        onReorder(next)
      }
    },
    [pairs, onReorder],
  )

  return (
    <div
      ref={containerRef}
      style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
      aria-label="Price feeds"
    >
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const startIdx = virtualRow.index * columns
        const rowItems = items.slice(startIdx, startIdx + columns)
        return (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap: '1rem',
              }}
              role="list"
            >
              {rowItems.map((p, colIdx) => {
                const itemIndex = startIdx + colIdx
                const isOver = overIndex === itemIndex
                return (
                  <div
                    key={p.assetPair}
                    draggable
                    onDragStart={() => onDragStart(itemIndex)}
                    onDragOver={(e) => onDragOver(e, itemIndex)}
                    onDrop={(e) => onDrop(e, itemIndex)}
                    onDragEnd={onDragEnd}
                    className={`relative transition-opacity ${isOver ? 'opacity-50' : ''}`}
                    role="listitem"
                  >
                    {/* Drag handle */}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`Drag to reorder ${p.assetPair}`}
                      className="absolute top-2 right-2 z-10 p-1 cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded"
                      onKeyDown={(e) => handleKeyReorder(e, itemIndex)}
                      // Prevent card click when handle is focused/activated
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="9" cy="6" r="1.5" />
                        <circle cx="15" cy="6" r="1.5" />
                        <circle cx="9" cy="12" r="1.5" />
                        <circle cx="15" cy="12" r="1.5" />
                        <circle cx="9" cy="18" r="1.5" />
                        <circle cx="15" cy="18" r="1.5" />
                      </svg>
                    </div>
                    <PriceCard
                      price={p}
                      isLive={livePrices.has(p.assetPair)}
                      isStale={pricesValidating}
                      hasAlert={hasAlertsForPair(p.assetPair)}
                      onClick={() => onCardClick(p.assetPair)}
                      onAlertClick={(e) => onAlertClick(e, p.assetPair)}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function Dashboard() {
  const { prices, pricesLoading, pricesError, pricesValidating, livePrices, wsStatus } = usePriceContext()
  const navigate = useNavigate()
  const { alerts, addAlert, removeAlert, hasAlertsForPair, activeCount } = useAlerts()
  const [searchParams] = useSearchParams()
  const { cardOrder, updateOrder, viewMode, setViewMode } = useDashboardPrefs()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalPair, setModalPair] = useState('')

  const search = searchParams.get('search') || ''
  const confidence = searchParams.get('confidence') || 'all'
  const source = searchParams.get('source') || 'all'
  const sort = searchParams.get('sort') || ''

  const containerRef = useRef<HTMLDivElement>(null)
  const columns = useColumnCount(containerRef)

  const merged = mergePrices(prices, livePrices)

  const filtered = useMemo(() => {
    let result = merged

    if (search) {
      result = result.filter((p) => p.assetPair.toLowerCase().includes(search.toLowerCase()))
    }

    if (confidence === 'high') {
      result = result.filter((p) => p.confidence > 80)
    } else if (confidence === 'medium') {
      result = result.filter((p) => p.confidence > 50)
    }

    if (source !== 'all') {
      result = result.filter((p) => p.sources.some((s) => s.toLowerCase() === source.toLowerCase()))
    }

    if (sort === 'price-high') {
      result = [...result].sort((a, b) => b.price - a.price)
    } else if (sort === 'price-low') {
      result = [...result].sort((a, b) => a.price - b.price)
    } else if (sort === 'confidence') {
      result = [...result].sort((a, b) => b.confidence - a.confidence)
    } else if (sort === 'recent') {
      result = [...result].sort((a, b) => b.timestamp - a.timestamp)
    }

    return result
  }, [merged, search, confidence, source, sort])

  // Apply user-defined card order (only in card view, only when no sort active)
  const orderedFiltered = useMemo(() => {
    if (viewMode === 'table' || sort) return filtered
    return applyOrder(filtered, cardOrder)
  }, [filtered, cardOrder, viewMode, sort])

  const handleCardClick = useCallback(
    (pair: string) => navigate(`/price/${encodeURIComponent(pair)}`),
    [navigate],
  )

  const handleAlertClick = useCallback((e: React.MouseEvent, pair: string) => {
    e.stopPropagation()
    setModalPair(pair)
    setModalOpen(true)
  }, [])

  const handleSave = useCallback(
    (data: AlertFormData) => {
      addAlert({
        assetPair: data.assetPair,
        upperThreshold: data.upperThreshold ? Number.parseFloat(data.upperThreshold) : null,
        lowerThreshold: data.lowerThreshold ? Number.parseFloat(data.lowerThreshold) : null,
        triggerOnce: data.triggerOnce,
        active: true,
      })
      setModalOpen(false)
    },
    [addAlert],
  )

  // When user reorders in card view: merge with full orderedFiltered pairs
  const handleReorder = useCallback(
    (newFilteredPairs: string[]) => {
      // Rebuild full order: new filtered order + any pairs not currently filtered
      const filteredSet = new Set(newFilteredPairs)
      const unfiltered = cardOrder.filter((p) => !filteredSet.has(p))
      // Pairs new to cardOrder (not previously tracked) that aren't filtered
      const allPairs = merged.map((p) => p.assetPair)
      const trackedSet = new Set([...cardOrder, ...newFilteredPairs])
      const newPairs = allPairs.filter((p) => !trackedSet.has(p))
      updateOrder([...newFilteredPairs, ...unfiltered, ...newPairs])
    },
    [cardOrder, merged, updateOrder],
  )

  const livePairSet = useMemo(() => new Set(livePrices.keys()), [livePrices])

  return (
    <div>
      <NetworkStatusBanner />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Price Oracle Dashboard</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Aggregated from Chainlink, Redstone, Band &amp; Reflector
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!pricesLoading && prices.length > 0 && (
            <ViewToggle mode={viewMode} onChange={setViewMode} />
          )}
          <AlertBadge count={activeCount} alerts={alerts} />
          <ConnectionBadge status={wsStatus} />
        </div>
      </div>

      {pricesError && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-xl text-sm text-red-400" role="alert">
          {pricesError}
        </div>
      )}

      {!pricesLoading && prices.length > 0 && <FilterBar />}

      {pricesLoading && prices.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" aria-label="Loading price cards">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <PriceCardSkeleton key={i} />
          ))}
        </div>
      ) : viewMode === 'table' ? (
        <PriceTable
          prices={filtered}
          livePairs={livePairSet}
          isStale={pricesValidating}
          onRowClick={handleCardClick}
          onAlertClick={handleAlertClick}
          hasAlert={hasAlertsForPair}
        />
      ) : (
        <DraggableCardGrid
          items={orderedFiltered}
          columns={columns}
          livePrices={livePrices}
          pricesValidating={pricesValidating}
          hasAlertsForPair={hasAlertsForPair}
          onCardClick={handleCardClick}
          onAlertClick={handleAlertClick}
          onReorder={handleReorder}
          containerRef={containerRef}
        />
      )}

      {!pricesLoading && merged.length === 0 && (
        <div className="text-center py-32 text-gray-500">
          <p className="text-lg mb-2">No price feeds available</p>
          <p className="text-sm">Connect to the aggregator API to see price data.</p>
        </div>
      )}

      {!pricesLoading && merged.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No results for "{search}"</p>
          <p className="text-sm">Try a different search term.</p>
        </div>
      )}

      <AlertModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        alert={alerts.find((a) => a.assetPair === modalPair) ?? null}
        defaultAssetPair={modalPair}
        onDelete={
          alerts.find((a) => a.assetPair === modalPair)
            ? () => {
                const existing = alerts.find((a) => a.assetPair === modalPair)
                if (existing) removeAlert(existing.id)
                setModalOpen(false)
              }
            : undefined
        }
      />
    </div>
  )
}
