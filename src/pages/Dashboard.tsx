import {
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
  useTransition,
  useOptimistic,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePriceContext } from '../context/PriceContext'
import { useAlerts } from '../hooks/useAlerts'
import { useExport } from '../hooks/useExport'
import { useExportQueue } from '../hooks/useExportQueue'
import { useColumnSelection } from '../hooks/useColumnSelection'
import { useScheduledExports } from '../hooks/useScheduledExports'
import { usePreferences } from '../preferences/PreferencesContext'
import { ColumnSelectorModal } from '../components/ColumnSelectorModal'
import { ExportProgressPanel } from '../components/ExportProgressPanel'
import { ScheduledExportsPanel } from '../components/ScheduledExportsPanel'
import { useSwipeGesture } from '../hooks/useSwipeGesture'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { PriceCardSkeleton } from '../components/PriceCardSkeleton'
import { DraggablePriceGrid } from '../components/DraggablePriceGrid'
import { AlertModal } from '../components/AlertModal'
import { AlertBadge } from '../components/AlertBadge'
import { ConnectionBadge } from '../components/ConnectionBadge'
import { NotificationChannelsModal } from '../components/NotificationChannelsModal'
import { FilterPanel, readFilterState, countActiveFilters } from '../components/FilterPanel'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { PairSearchBar } from '../components/PairSearchBar'
import { LazyPriceTable, preloadPriceTable } from '../utils/chunks'
import { StaleDataWarningBanner } from '../components/StaleDataWarningBanner'
import type { AlertFormData, LivePriceEntry, PriceData } from '../types'
import { buildConditionGroupFromFormData } from '../utils/alertEvaluator'

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
  const {
    prices,
    pricesLoading,
    pricesError,
    pricesValidating,
    livePrices,
    wsStatus,
    diagnostics,
    rateLimitStatus,
    rateLimitRetryAfterMs,
    refetchPrices,
    isOfflineSnapshot,
    offlineSnapshotSavedAt,
  } = usePriceContext()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { alerts, addAlert, removeAlert, hasAlertsForPair, activeCount, reEnableAlert, alertCreateAllowed, alertCreateCooldownSec } = useAlerts()
  const { exportAllowed, exportCooldownSec } = useExport()
  const { tasks: exportTasks, enqueue: enqueueExport, cancel: cancelExport, dismiss: dismissExport } = useExportQueue()
  const { columns: exportColumns, setColumns: setExportColumns, applyPreset: applyColumnPreset } = useColumnSelection('csv')
  const { preferences, updatePreference } = usePreferences()
  const [searchParams] = useSearchParams()

  const [columnModalOpen, setColumnModalOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalPair, setModalPair] = useState('')
  const [dashboardView, setDashboardView] = useState<'card' | 'table'>('card')
  const [notifModalOpen, setNotifModalOpen] = useState(false)
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [, startTransition] = useTransition()

  // Pull-to-refresh: allow the user to drag the page down to force a refetch
  const mainRef = useRef<HTMLDivElement>(null)
  const { state: pullState, handlers: pullHandlers } = usePullToRefresh(mainRef, {
    onRefresh: refetchPrices,
    disabled: pricesLoading || preferences.reducedMotion,
  })

  // Swipe left/right on the dashboard to switch between card/table views
  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: () => {
      void preloadPriceTable()
      startTransition(() => setDashboardView('table'))
    },
    onSwipeRight: () => startTransition(() => setDashboardView('card')),
    disabled: preferences.reducedMotion,
  })

  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Optimistic alerts: show immediately, revert if needed
  const [optimisticAlerts, addOptimisticAlert] = useOptimistic(
    [] as Array<{ assetPair: string; upperThreshold: number | null; lowerThreshold: number | null; triggerOnce: boolean }>,
    (state, newAlert: { assetPair: string; upperThreshold: number | null; lowerThreshold: number | null; triggerOnce: boolean }) => [
      ...state,
      newAlert,
    ],
  )
  void optimisticAlerts

  const search = searchParams.get('search') || ''
  const filterState = readFilterState(searchParams)
  const activeFilterCount = countActiveFilters(filterState)
  const { sources, minConf, maxConf, minPrice, maxPrice, updatedWithin, sort, sortDir } = filterState

  // Legacy params kept for backward compatibility
  const legacyConfidence = searchParams.get('confidence') || 'all'
  const legacySource = searchParams.get('source') || 'all'

  const merged = mergePrices(prices, livePrices)
  const scheduledExports = useScheduledExports(merged)
  const [scheduledExportsOpen, setScheduledExportsOpen] = useState(false)

  const filtered = useMemo(() => {
    let result = merged
    if (search) result = result.filter((p) => p.assetPair.toLowerCase().includes(search.toLowerCase()))

    if (sources.length > 0) {
      result = result.filter((p) => p.sources.some((s) => sources.includes(s)))
    } else if (legacySource !== 'all') {
      result = result.filter((p) => p.sources.some((s) => s.toLowerCase() === legacySource.toLowerCase()))
    }

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
      const upperThreshold = data.upperThreshold ? Number.parseFloat(data.upperThreshold) : null
      const lowerThreshold = data.lowerThreshold ? Number.parseFloat(data.lowerThreshold) : null
      addOptimisticAlert({
        assetPair: data.assetPair,
        upperThreshold,
        lowerThreshold,
        triggerOnce: data.triggerOnce,
      })
      addAlert({
        assetPair: data.assetPair,
        upperThreshold,
        lowerThreshold,
        triggerOnce: data.triggerOnce,
        active: true,
        percentageMode: data.percentageMode,
        percentageThreshold: data.percentageThreshold ? Number.parseFloat(data.percentageThreshold) : null,
        percentageWindow: data.percentageMode ? data.percentageWindow : null,
        percentageDirection: data.percentageMode ? data.percentageDirection : null,
        percentageRelativeTo: data.percentageMode ? data.percentageRelativeTo : null,
        cooldownMinutes: data.cooldownMinutes ? Number.parseInt(data.cooldownMinutes, 10) : 5,
        // #485 – compound AND/OR condition group built from the primary
        // threshold/percentage field(s) plus any extra conditions the user added.
        conditionGroup: buildConditionGroupFromFormData(data),
        // #487 – multi-tier escalation schedule, when the user enabled one.
        escalationPolicy: data.escalationEnabled ? { enabled: true, steps: data.escalationSteps } : null,
        // #492 – per-alert channel routing override; empty array means "use global defaults" and is stored as null.
        channels: data.channels.length > 0 ? data.channels : null,
        // #491 – retest alert mode.
        retestMode: data.retestMode,
      })
      setModalOpen(false)
    },
    [addAlert, addOptimisticAlert],
  )

  const toggleSelectMode = useCallback(() => {
    setSelectMode((m) => !m)
    setSelected(new Set())
  }, [])

  const selectAll = useCallback(() => setSelected(new Set(filtered.map((p) => p.assetPair))), [filtered])
  const deselectAll = useCallback(() => setSelected(new Set()), [])
  const onToggleSelect = useCallback((pair: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(pair)) { next.delete(pair) } else { next.add(pair) }
      return next
    })
  }, [])

  return (
    <div
      ref={mainRef}
      {...pullHandlers}
      {...swipeHandlers}
    >
      {/* Pull-to-refresh indicator */}
      {(pullState.pullDistance > 0 || pullState.refreshing) && (
        <div
          className="flex items-center justify-center gap-2 text-xs text-cyan-400 mb-2 transition-all"
          style={{ height: `${Math.max(pullState.pullDistance, pullState.refreshing ? 32 : 0)}px` }}
          aria-live="polite"
          aria-atomic="true"
        >
          {pullState.refreshing ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t('dashboard.pullToRefresh.refreshing')}
            </>
          ) : pullState.readyToRefresh ? (
            t('dashboard.pullToRefresh.release')
          ) : (
            t('dashboard.pullToRefresh.pull')
          )}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            {t('dashboard.title')}
          </h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PairSearchBar
            pairs={prices.map((p) => p.assetPair)}
            allSources={[...new Set(prices.flatMap((p) => p.sources))]}
            value={search}
            onChange={(value) => {
              const params = new URLSearchParams(searchParams)
              if (value) params.set('search', value)
              else params.delete('search')
              navigate({ search: params.toString() }, { replace: true })
            }}
            className="w-full sm:w-48"
          />

          <button
            type="button"
            onClick={() => setFilterPanelOpen((o) => !o)}
            className={`relative min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              filterPanelOpen
                ? 'bg-cyan-600 border-cyan-500 text-white'
                : 'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
            }`}
            aria-pressed={filterPanelOpen}
            aria-label={t('dashboard.filter.ariaLabel')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            {t('dashboard.filter.toggle')}
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
              className={`min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                selectMode
                  ? 'bg-cyan-600 border-cyan-500 text-white'
                  : 'border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
              }`}
              aria-pressed={selectMode}
              aria-label={t('dashboard.select.ariaLabel')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="hidden sm:inline">
                {selectMode
                  ? t('dashboard.select.buttonWithCount', { count: selected.size })
                  : t('dashboard.select.button')}
              </span>
              <span className="sm:hidden">
                {selectMode ? `${selected.size}` : t('dashboard.select.buttonShort')}
              </span>
            </button>
          )}

          {!pricesLoading && prices.length > 0 && (
            <div className="flex items-center rounded-lg border border-gray-700 overflow-hidden" role="group" aria-label={t('dashboard.viewToggle.ariaLabel')}>
              <button
                type="button"
                onClick={() => startTransition(() => setDashboardView('card'))}
                className={`min-h-[44px] min-w-[44px] flex items-center justify-center px-3 py-1.5 text-sm transition-colors ${dashboardView === 'card' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                aria-pressed={dashboardView === 'card'}
                aria-label={t('dashboard.viewToggle.card')}
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
                onClick={() => {
                  void preloadPriceTable()
                  startTransition(() => setDashboardView('table'))
                }}
                onMouseEnter={preloadPriceTable}
                onFocus={preloadPriceTable}
                className={`min-h-[44px] min-w-[44px] flex items-center justify-center px-3 py-1.5 text-sm transition-colors ${dashboardView === 'table' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                aria-pressed={dashboardView === 'table'}
                aria-label={t('dashboard.viewToggle.table')}
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
            className="min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
            aria-label={t('dashboard.alerts.ariaLabel')}
            title={t('dashboard.alerts.title')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="hidden sm:inline">{t('dashboard.alerts.title')}</span>
          </button>
          <button
            type="button"
            onClick={() => setScheduledExportsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
            aria-label={t('scheduledExports.title', { defaultValue: 'Scheduled exports' }) as string}
            title={t('scheduledExports.title', { defaultValue: 'Scheduled exports' }) as string}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {t('scheduledExports.button', { defaultValue: 'Schedule' })}
          </button>
          <ConnectionBadge
            status={wsStatus}
            rateLimitStatus={rateLimitStatus}
            retryAfterMs={rateLimitRetryAfterMs}
            diagnostics={diagnostics}
          />
        </div>
      </div>

      {filterPanelOpen && (
        <ErrorBoundary boundaryId="filter-panel" featureLabel="Filter Panel">
          <FilterPanel availableSources={[...new Set(prices.flatMap((p) => p.sources))].length > 0
            ? [...new Set(prices.flatMap((p) => p.sources))]
            : undefined}
          />
        </ErrorBoundary>
      )}

      {selectMode && (
        <div className="mb-4 p-3 bg-gray-900 border border-cyan-800 rounded-xl flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-300 font-medium">
            {t('dashboard.selection.count', { count: selected.size })}
          </span>
          <button
            type="button"
            onClick={selectAll}
            className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            {t('dashboard.selection.selectAll')}
          </button>
          <button
            type="button"
            onClick={deselectAll}
            className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            {t('dashboard.selection.deselectAll')}
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setColumnModalOpen(true)}
            title={t('export.columns.title', { defaultValue: 'Select export columns' }) as string}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors border border-gray-700"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {t('export.columns.button', { defaultValue: 'Columns' })}
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || !exportAllowed}
            title={!exportAllowed ? `Too many exports — try again in ${exportCooldownSec}s` : undefined}
            onClick={() => {
              const items = filtered.filter((p) => selected.has(p.assetPair))
              enqueueExport('csv', items, exportColumns)
            }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-gray-700"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {!exportAllowed
              ? `${exportCooldownSec}s`
              : t('dashboard.selection.exportCsv')}
          </button>
        </div>
      )}

      {columnModalOpen && (
        <ColumnSelectorModal
          format="csv"
          columns={exportColumns}
          onChange={setExportColumns}
          onApplyPreset={applyColumnPreset}
          onClose={() => setColumnModalOpen(false)}
        />
      )}

      {pricesError && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-xl text-sm text-red-400" role="alert">
          {pricesError.message}
        </div>
      )}

      {/* Offline-first (#470): rendering the last persisted snapshot instead of a blank dashboard. */}
      {isOfflineSnapshot && offlineSnapshotSavedAt != null && (
        <StaleDataWarningBanner
          thresholdMinutes={Math.max(1, Math.round((Date.now() - offlineSnapshotSavedAt) / 60_000))}
        />
      )}

      {pricesLoading && prices.length === 0 ? (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" aria-label={t('dashboard.loadingAriaLabel')}>
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <PriceCardSkeleton key={i} />
          ))}
        </section>
      ) : dashboardView === 'table' ? (
        <ErrorBoundary boundaryId="price-table-view" featureLabel="Price Table">
          <Suspense
            fallback={
              <div
                className="h-64 rounded-xl border border-gray-800 bg-gray-900/60 animate-pulse"
                role="status"
                aria-label="Loading price table"
              />
            }
          >
            <LazyPriceTable
              items={filtered}
              livePairs={new Set(livePrices.keys())}
              isStale={pricesValidating}
              onRowClick={handleCardClick}
              onAlertClick={handleAlertClick}
              hasAlertFn={hasAlertsForPair}
              selectMode={selectMode}
              selected={selected}
              onToggleSelect={onToggleSelect}
            />
          </Suspense>
        </ErrorBoundary>
      ) : (
        <ErrorBoundary boundaryId="price-card-grid" featureLabel="Price Cards">
          <DraggablePriceGrid
            items={filtered}
            livePairs={new Set(livePrices.keys())}
            isStale={pricesValidating}
            hasAlertFn={hasAlertsForPair}
            onCardClick={handleCardClick}
            onAlertClick={handleAlertClick}
            selectMode={selectMode}
            selected={selected}
            onReorder={(orderedPairs) => updatePreference('cardOrder', orderedPairs)}
          />
        </ErrorBoundary>
      )}

      {!pricesLoading && merged.length === 0 && (
        <div className="text-center py-32 text-gray-500">
          <p className="text-lg mb-2">{t('dashboard.emptyState.noFeeds')}</p>
          <p className="text-sm">{t('dashboard.emptyState.noFeedsDetail')}</p>
        </div>
      )}

      {!pricesLoading && merged.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">
            {search
              ? t('dashboard.emptyState.noResultsSearch', { search })
              : t('dashboard.emptyState.noResults')}
          </p>
          <p className="text-sm">
            {activeFilterCount > 0
              ? t('dashboard.emptyState.noResultsFilterHint')
              : t('dashboard.emptyState.noResultsSearchHint')}
          </p>
        </div>
      )}

      <AlertModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        alert={alerts.find((a) => a.assetPair === modalPair) ?? null}
        defaultAssetPair={modalPair}
        rateLimited={!alertCreateAllowed}
        cooldownSec={alertCreateCooldownSec}
        onDelete={
          alerts.find((a) => a.assetPair === modalPair)
            ? () => {
                const existing = alerts.find((a) => a.assetPair === modalPair)
                if (existing) removeAlert(existing.id)
                setModalOpen(false)
              }
            : undefined
        }
        onReEnable={
          alerts.find((a) => a.assetPair === modalPair)
            ? () => {
                const existing = alerts.find((a) => a.assetPair === modalPair)
                if (existing) reEnableAlert(existing.id)
                setModalOpen(false)
              }
            : undefined
        }
      />

      <NotificationChannelsModal isOpen={notifModalOpen} onClose={() => setNotifModalOpen(false)} />

      <ExportProgressPanel tasks={exportTasks} onCancel={cancelExport} onDismiss={dismissExport} />

      <ScheduledExportsPanel
        isOpen={scheduledExportsOpen}
        onClose={() => setScheduledExportsOpen(false)}
        availablePairs={prices.map((p) => p.assetPair)}
        {...scheduledExports}
      />
    </div>
  )
}
