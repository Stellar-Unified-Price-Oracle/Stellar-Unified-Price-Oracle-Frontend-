import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { usePriceContext } from '../context/PriceContext'
import { useAlerts } from '../hooks/useAlerts'
import { useExport } from '../hooks/useExport'
import { PriceCard } from '../components/PriceCard'
import { PriceCardSkeleton } from '../components/PriceCardSkeleton'
import { PriceTableView } from '../components/PriceTableView'
import { AlertModal } from '../components/AlertModal'
import { AlertBadge } from '../components/AlertBadge'
import { ConnectionBadge } from '../components/ConnectionBadge'
import { NotificationChannelsModal } from '../components/NotificationChannelsModal'
import { FilterPanel, readFilterState, countActiveFilters } from '../components/FilterPanel'
import { sanitizeSearchInput } from '../utils/sanitize'
import type { AlertFormData, LivePriceEntry, PriceData } from '../types'

const SKELETON_COUNT = 8

function mergePrices(
  restPrices: PriceData[],
  livePrices: Map<string, LivePriceEntry>,
): PriceData[] {
  return restPrices.map((p) => {
    const live = livePrices.get(p.assetPair)
    if (live && live.data.timestamp >= p.timestamp) {
      return { ...p, ...live.data }
    }
    return p
  })
}

export function Dashboard() {
  const { prices, pricesLoading, pricesError, pricesValidating, livePrices, wsStatus } = usePriceContext()
  const navigate = useNavigate()
  const { alerts, addAlert, removeAlert, hasAlertsForPair, activeCount } = useAlerts()
  const { exportCSV } = useExport()
  const [searchParams] = useSearchParams()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalPair, setModalPair] = useState('')
  const [dashboardView, setDashboardView] = useState<'card' | 'table'>('card')
  const [notifModalOpen, setNotifModalOpen] = useState(false)
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)

  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const search = searchParams.get('search') || ''
  const filterState = readFilterState(searchParams)
  const activeFilterCount = countActiveFilters(filterState)
  const { sources, minConf, maxConf, minPrice, maxPrice, updatedWithin, sort, sortDir } = filterState

  // Legacy params kept for backward compatibility
  const legacyConfidence = searchParams.get('confidence') || 'all'
  const legacySource = searchParams.get('source') || 'all'

  const merged = mergePrices(prices, livePrices)

  const filtered = useMemo(() => {
    let result = merged
    if (search) result = result.filter((p) => p.assetPair.toLowerCase().includes(search.toLowerCase()))

    // Source filter: new 'sources' param takes precedence over legacy 'source'
    if (sources.length > 0) {
      result = result.filter((p) => p.sources.some((s) => sources.includes(s)))
    } else if (legacySource !== 'all') {
      result = result.filter((p) => p.sources.some((s) => s.toLowerCase() === legacySource.toLowerCase()))
    }

    // Confidence filter: new minConf/maxConf take precedence over legacy 'confidence'
    if (minConf > 0 || maxConf < 100) {
      if (minConf > 0) result = result.filter((p) => p.confidence * 100 >= minConf)
      if (maxConf < 100) result = result.filter((p) => p.confidence * 100 <= maxConf)
    } else if (legacyConfidence === 'high') {
      result = result.filter((p) => p.confidence > 0.8)
    } else if (legacyConfidence === 'medium') {
      result = result.filter((p) => p.confidence > 0.5)
    }

    if (minPrice) result = result.filter((p) => p.price >= Number(minPrice))
    if (maxPrice) result = result.filter((p) => p.price <= Number(maxPrice))
    if (updatedWithin !== 'all') {
      const ms = updatedWithin === '1h' ? 3_600_000 : updatedWithin === '6h' ? 21_600_000 : updatedWithin === '24h' ? 86_400_000 : 604_800_000
      const cutoff = Date.now() - ms
      result = result.filter((p) => p.timestamp >= cutoff)
    }
    const desc = sortDir === 'desc'
    if (sort === 'price-high') result = [...result].sort((a, b) => b.price - a.price)
    else if (sort === 'price-low') result = [...result].sort((a, b) => a.price - b.price)
    else if (sort === 'confidence') result = [...result].sort((a, b) => desc ? b.confidence - a.confidence : a.confidence - b.confidence)
    else if (sort === 'recent') result = [...result].sort((a, b) => desc ? b.timestamp - a.timestamp : a.timestamp - b.timestamp)
    else if (sort === 'pair') result = [...result].sort((a, b) => desc ? b.assetPair.localeCompare(a.assetPair) : a.assetPair.localeCompare(b.assetPair))
    return result
  }, [merged, search, sources, minConf, maxConf, minPrice, maxPrice, updatedWithin, sort, sortDir, legacyConfidence, legacySource])

  const handleCardClick = useCallback(
    (pair: string) => {
      if (selectMode) {
        setSelected((prev) => {
          const next = new Set(prev)
          if (next.has(pair)) { next.delete(pair) } else { next.add(pair) }
          return next
        })
      } else {
        navigate(`/prices/${encodeURIComponent(pair)}`)
      }
    },
    [selectMode, navigate],
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

  const toggleSelectMode = useCallback(() => {
    setSelectMode((m) => !m)
    setSelected(new Set())
  }, [])

  const selectAll = useCallback(() => setSelected(new Set(filtered.map((p) => p.assetPair))), [filtered])
  const deselectAll = useCallback(() => setSelected(new Set()), [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Price Oracle Dashboard</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Aggregated from Chainlink, Redstone, Band &amp; Reflector
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search by asset pair..."
            value={search}
            onChange={(e) => {
              const value = sanitizeSearchInput(e.target.value)
              const params = new URLSearchParams(searchParams)
              if (value) params.set('search', value)
              else params.delete('search')
              navigate({ search: params.toString() }, { replace: true })
            }}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-700 bg-gray-800 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 w-48"
            aria-label="Search by asset pair"
          />

          <button
            type="button"
            onClick={() => setFilterPanelOpen((o) => !o)}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              filterPanelOpen
                ? 'bg-cyan-600 border-cyan-500 text-white'
                : 'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
            }`}
            aria-pressed={filterPanelOpen}
            aria-label="Toggle filter panel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            Filter
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-cyan-500 text-gray-900 rounded-full px-1">
                {activeFilterCount}
              </span>
            )}
          </button>

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
                onClick={() => setDashboardView('card')}
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
                onClick={() => setDashboardView('table')}
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
          <button
            type="button"
            onClick={() => setNotifModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
            aria-label="Configure notification channels"
            title="Notification channels"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Alerts
          </button>
          <ConnectionBadge status={wsStatus} />
        </div>
      </div>

      {filterPanelOpen && (
        <FilterPanel availableSources={[...new Set(prices.flatMap((p) => p.sources))].length > 0
          ? [...new Set(prices.flatMap((p) => p.sources))]
          : undefined}
        />
      )}

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
            onClick={() => {
              const items = filtered.filter((p) => selected.has(p.assetPair))
              exportCSV(items)
            }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-gray-700"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>
      )}

      {pricesError && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-xl text-sm text-red-400" role="alert">
          {pricesError}
        </div>
      )}

      {pricesLoading && prices.length === 0 ? (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" aria-label="Loading price cards">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <PriceCardSkeleton key={i} />
          ))}
        </section>
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
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" aria-label="Price feeds">
          {filtered.map((p) => (
            <PriceCard
              key={p.assetPair}
              price={p}
              isLive={livePrices.has(p.assetPair)}
              isStale={pricesValidating}
              hasAlert={hasAlertsForPair(p.assetPair)}
              onClick={() => handleCardClick(p.assetPair)}
              onAlertClick={(e) => handleAlertClick(e, p.assetPair)}
              selectMode={selectMode}
              isSelected={selected.has(p.assetPair)}
            />
          ))}
        </section>
      )}

      {!pricesLoading && merged.length === 0 && (
        <div className="text-center py-32 text-gray-500">
          <p className="text-lg mb-2">No price feeds available</p>
          <p className="text-sm">Connect to the aggregator API to see price data.</p>
        </div>
      )}

      {!pricesLoading && merged.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No results{search ? ` for "${search}"` : ''}</p>
          <p className="text-sm">
            {activeFilterCount > 0 ? 'Try adjusting your filters.' : 'Try a different search term.'}
          </p>
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

      <NotificationChannelsModal isOpen={notifModalOpen} onClose={() => setNotifModalOpen(false)} />
    </div>
  )
}
