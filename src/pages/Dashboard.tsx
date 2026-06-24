import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { usePriceContext } from '../context/PriceContext'
import { useAlerts } from '../hooks/useAlerts'
import { useExport } from '../hooks/useExport'
import { useColumnCount } from '../hooks/useColumnCount'
import { useDragOrder } from '../hooks/useDragOrder'
import { usePreferences } from '../preferences/PreferencesContext'
import { useCopyShareLink } from '../hooks/useCopyShareLink'
import { PriceCard } from '../components/PriceCard'
import { PriceCardSkeleton } from '../components/PriceCardSkeleton'
import { PriceTableView } from '../components/PriceTableView'
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
) {
  return restPrices.map((p) => {
    const live = livePrices.get(p.assetPair)?.data
    if (live && live.timestamp >= p.timestamp) {
      return { ...p, ...live }
    }
    return p
  })
}

function exportCSV(items: PriceData[]) {
  const header = 'Asset Pair,Price,Confidence,Sources,Updated'
  const rows = items.map((p) =>
    [
      p.assetPair,
      p.price,
      (p.confidence * 100).toFixed(2) + '%',
      p.sources.join(';'),
      new Date(p.timestamp).toISOString(),
    ].join(',')
  )
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `oracle-prices-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function Dashboard() {
  const { prices, pricesLoading, pricesError, pricesValidating, livePrices, wsStatus } = usePriceContext()
  const navigate = useNavigate()
  const { alerts, addAlert, removeAlert, hasAlertsForPair, activeCount } = useAlerts()
  const { exporting, exportPrices } = useExport()
  const [searchParams] = useSearchParams()
  const { preferences, updatePreference } = usePreferences()
  const { copy: copyShareLink, copied: linkCopied } = useCopyShareLink()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalPair, setModalPair] = useState('')

  // #49 — bulk selection state
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const search = searchParams.get('search') || ''
  const confidence = searchParams.get('confidence') || 'all'
  const source = searchParams.get('source') || 'all'
  const sort = searchParams.get('sort') || ''

  const containerRef = useRef<HTMLDivElement>(null)
  const columns = useColumnCount(containerRef)

  const merged = mergePrices(prices, livePrices)

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
    if (search) result = result.filter((p) => p.assetPair.toLowerCase().includes(search.toLowerCase()))
    if (confidence === 'high') result = result.filter((p) => p.confidence > 80)
    else if (confidence === 'medium') result = result.filter((p) => p.confidence > 50)
    if (source !== 'all') result = result.filter((p) => p.sources.some((s) => s.toLowerCase() === source.toLowerCase()))
    if (sort === 'price-high') result = [...result].sort((a, b) => b.price - a.price)
    else if (sort === 'price-low') result = [...result].sort((a, b) => a.price - b.price)
    else if (sort === 'confidence') result = [...result].sort((a, b) => b.confidence - a.confidence)
    else if (sort === 'recent') result = [...result].sort((a, b) => b.timestamp - a.timestamp)
    return result
  }, [orderedMerged, search, confidence, source, sort])

  const filteredPairs = useMemo(() => filtered.map((p) => p.assetPair), [filtered])

  const handleOrderChange = useCallback(
    (newPairs: string[]) => {
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
    (pair: string) => {
      if (selectMode) {
        setSelected((prev) => {
          const next = new Set(prev)
          if (next.has(pair)) { next.delete(pair) } else { next.add(pair) }
          return next
        })
      } else {
        navigate(`/price/${encodeURIComponent(pair)}`)
      }
    },
    [navigate, selectMode],
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

  // #49 — bulk action handlers
  const toggleSelectMode = useCallback(() => {
    setSelectMode((m) => !m)
    setSelected(new Set())
  }, [])

  const selectAll = useCallback(() => setSelected(new Set(filteredPairs)), [filteredPairs])
  const deselectAll = useCallback(() => setSelected(new Set()), [])

  const handleBulkExportCSV = useCallback(() => {
    const items = filtered.filter((p) => selected.has(p.assetPair))
    exportCSV(items)
  }, [filtered, selected])

  const handleBulkCreateAlerts = useCallback(() => {
    for (const pair of selected) {
      if (!hasAlertsForPair(pair)) {
        setModalPair(pair)
        setModalOpen(true)
        break // open modal for first un-alerted pair
      }
    }
  }, [selected, hasAlertsForPair])

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
          {/* #50 — Share link button */}
          <button
            type="button"
            onClick={copyShareLink}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
            aria-label="Copy shareable link"
          >
            {linkCopied ? (
              <>
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-green-400">Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Share
              </>
            )}
          </button>

          {/* #49 — Select mode toggle */}
          {!pricesLoading && prices.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                selectMode
                  ? 'bg-cyan-600 border-cyan-500 text-white'
                  : 'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
              }`}
              aria-pressed={selectMode}
              aria-label="Toggle selection mode"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {selectMode ? `Select (${selected.size})` : 'Select'}
            </button>
          )}

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

      {/* #49 — Bulk action bar */}
      {selectMode && (
        <div className="mb-4 p-3 bg-gray-900 border border-cyan-800 rounded-xl flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-300 font-medium">
            {selected.size} selected
          </span>
          <button
            type="button"
            onClick={selectAll}
            className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={deselectAll}
            className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            Deselect all
          </button>
          <div className="flex-1" />
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={handleBulkExportCSV}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-gray-700"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={handleBulkCreateAlerts}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-900/40 text-amber-400 hover:bg-amber-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-amber-800/50"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Set Alerts
          </button>
        </div>
      )}

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
          selectMode={selectMode}
          selected={selected}
          onToggleSelect={(pair) => {
            setSelected((prev) => {
              const next = new Set(prev)
              if (next.has(pair)) { next.delete(pair) } else { next.add(pair) }
              return next
            })
          }}
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
                        dragHandleProps={selectMode ? undefined : getHandleProps(globalIdx)}
                        isDragOver={!selectMode && dragOverIndex === globalIdx}
                        selectMode={selectMode}
                        isSelected={selected.has(p.assetPair)}
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
