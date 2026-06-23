import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { usePriceContext } from '../context/PriceContext'
import { useAlerts } from '../hooks/useAlerts'
import { useColumnCount } from '../hooks/useColumnCount'
import { useDragOrder } from '../hooks/useDragOrder'
import { usePreferences } from '../preferences/PreferencesContext'
import { PriceCard } from '../components/PriceCard'
import { PriceCardSkeleton } from '../components/PriceCardSkeleton'
import { PriceTableView } from '../components/PriceTableView'
import { AlertModal } from '../components/AlertModal'
import { AlertBadge } from '../components/AlertBadge'
import { ConnectionBadge } from '../components/ConnectionBadge'
import { NetworkStatusBanner } from '../components/NetworkStatusBanner'
import { FilterBar } from '../components/FilterBar'
import type { AlertFormData } from '../types'

const ROW_HEIGHT = 200
const SKELETON_COUNT = 8

function mergePrices(
  restPrices: { assetPair: string; price: number; timestamp: number; confidence: number; sources: string[] }[],
  livePrices: Map<string, { assetPair: string; price: number; timestamp: number; confidence: number; sources: string[] }>,
) {
  return restPrices.map((p) => {
    const live = livePrices.get(p.assetPair)
    if (live && live.timestamp >= p.timestamp) {
      return { ...p, ...live }
    }
    return p
  })
}

export function Dashboard() {
  const { prices, pricesLoading, pricesError, pricesValidating, livePrices, wsStatus } = usePriceContext()
  const navigate = useNavigate()
  const { alerts, addAlert, removeAlert, hasAlertsForPair, activeCount } = useAlerts()
  const [searchParams] = useSearchParams()
  const { preferences, updatePreference } = usePreferences()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalPair, setModalPair] = useState('')

  const search = searchParams.get('search') || ''
  const confidence = searchParams.get('confidence') || 'all'
  const source = searchParams.get('source') || 'all'
  const sort = searchParams.get('sort') || ''

  const containerRef = useRef<HTMLDivElement>(null)
  const columns = useColumnCount(containerRef)

  const merged = mergePrices(prices, livePrices)

  // Apply saved card order (card view only)
  const orderedMerged = useMemo(() => {
    const order = preferences.cardOrder
    if (!order || order.length === 0) return merged
    const orderMap = new Map(order.map((pair, i) => [pair, i]))
    return [...merged].sort((a, b) => {
      const ia = orderMap.get(a.assetPair) ?? Number.MAX_SAFE_INTEGER
      const ib = orderMap.get(b.assetPair) ?? Number.MAX_SAFE_INTEGER
      return ia - ib
    })
  }, [merged, preferences.cardOrder])

  const filtered = useMemo(() => {
    let result = orderedMerged

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
  }, [orderedMerged, search, confidence, source, sort])

  // Drag-and-drop for card order
  const filteredPairs = useMemo(() => filtered.map((p) => p.assetPair), [filtered])
  const handleOrderChange = useCallback(
    (newPairs: string[]) => {
      // Rebuild full order: new filtered order + unchanged unfiltered pairs appended
      const filteredSet = new Set(newPairs)
      const unfiltered = (preferences.cardOrder.length > 0 ? preferences.cardOrder : orderedMerged.map((p) => p.assetPair)).filter(
        (pair) => !filteredSet.has(pair),
      )
      updatePreference('cardOrder', [...newPairs, ...unfiltered])
    },
    [preferences.cardOrder, orderedMerged, updatePreference],
  )

  const { getHandleProps, dragOverIndex } = useDragOrder(filteredPairs, handleOrderChange)

  const rowCount = Math.ceil(filtered.length / columns)
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: useCallback(() => document.documentElement, []),
    estimateSize: useCallback(() => ROW_HEIGHT, []),
    overscan: 5,
  })

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

  const dashboardView = preferences.dashboardView ?? 'card'

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
            <div className="flex items-center rounded-lg border border-gray-700 overflow-hidden" role="group" aria-label="View toggle">
              <button
                type="button"
                onClick={() => updatePreference('dashboardView', 'card')}
                className={`px-3 py-1.5 text-sm transition-colors ${dashboardView === 'card' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                aria-pressed={dashboardView === 'card'}
                aria-label="Card view"
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <rect x="1" y="1" width="6" height="6" rx="1" />
                  <rect x="9" y="1" width="6" height="6" rx="1" />
                  <rect x="1" y="9" width="6" height="6" rx="1" />
                  <rect x="9" y="9" width="6" height="6" rx="1" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => updatePreference('dashboardView', 'table')}
                className={`px-3 py-1.5 text-sm transition-colors ${dashboardView === 'table' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                aria-pressed={dashboardView === 'table'}
                aria-label="Table view"
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <rect x="1" y="1" width="14" height="3" rx="0.5" />
                  <rect x="1" y="6" width="14" height="3" rx="0.5" />
                  <rect x="1" y="11" width="14" height="3" rx="0.5" />
                </svg>
              </button>
            </div>
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
      ) : dashboardView === 'table' ? (
        <PriceTableView
          items={filtered}
          livePairs={new Set(livePrices.keys())}
          isStale={pricesValidating}
          onRowClick={handleCardClick}
          onAlertClick={handleAlertClick}
          hasAlertFn={hasAlertsForPair}
        />
      ) : (
        <div
          ref={containerRef}
          style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
          aria-label="Price feeds"
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const startIdx = virtualRow.index * columns
            const rowItems = filtered.slice(startIdx, startIdx + columns)
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
                    const globalIdx = startIdx + colIdx
                    return (
                      <PriceCard
                        key={p.assetPair}
                        price={p}
                        isLive={livePrices.has(p.assetPair)}
                        isStale={pricesValidating}
                        hasAlert={hasAlertsForPair(p.assetPair)}
                        onClick={() => handleCardClick(p.assetPair)}
                        onAlertClick={(e) => handleAlertClick(e, p.assetPair)}
                        dragHandleProps={getHandleProps(globalIdx)}
                        isDragOver={dragOverIndex === globalIdx}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
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
