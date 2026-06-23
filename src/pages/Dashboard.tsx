import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { usePriceContext } from '../context/PriceContext'
import { useAlerts } from '../hooks/useAlerts'
import { useColumnCount } from '../hooks/useColumnCount'
import { PriceCard } from '../components/PriceCard'
import { PriceCardSkeleton } from '../components/PriceCardSkeleton'
import { AlertModal } from '../components/AlertModal'
import { AlertBadge } from '../components/AlertBadge'
import { ConnectionBadge } from '../components/ConnectionBadge'
import { NetworkStatusBanner } from '../components/NetworkStatusBanner'
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

  const [modalOpen, setModalOpen] = useState(false)
  const [modalPair, setModalPair] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const containerRef = useRef<HTMLDivElement>(null)
  const columns = useColumnCount(containerRef)

  const merged = mergePrices(prices, livePrices)
  const filtered = useMemo(
    () =>
      searchQuery
        ? merged.filter((p) => p.assetPair.toLowerCase().includes(searchQuery.toLowerCase()))
        : merged,
    [merged, searchQuery],
  )

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
          <AlertBadge count={activeCount} alerts={alerts} />
          <ConnectionBadge status={wsStatus} />
        </div>
      </div>

      {pricesError && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-xl text-sm text-red-400" role="alert">
          {pricesError}
        </div>
      )}

      {!pricesLoading && prices.length > 0 && (
        <div className="mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by asset pair..."
            aria-label="Search price feeds"
            className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
          />
        </div>
      )}

      {pricesLoading && prices.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" aria-label="Loading price cards">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <PriceCardSkeleton key={i} />
          ))}
        </div>
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
                  {rowItems.map((p) => (
                    <PriceCard
                      key={p.assetPair}
                      price={p}
                      isLive={livePrices.has(p.assetPair)}
                      isStale={pricesValidating}
                      hasAlert={hasAlertsForPair(p.assetPair)}
                      onClick={() => handleCardClick(p.assetPair)}
                      onAlertClick={(e) => handleAlertClick(e, p.assetPair)}
                    />
                  ))}
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
          <p className="text-lg mb-2">No results for "{searchQuery}"</p>
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
