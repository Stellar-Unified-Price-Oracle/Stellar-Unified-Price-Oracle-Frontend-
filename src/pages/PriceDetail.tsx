import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { usePriceHistory } from '../hooks/usePriceHistory'
import { usePriceContext } from '../context/PriceContext'
import { useAlerts } from '../hooks/useAlerts'
import { useExport } from '../hooks/useExport'
import { PriceChart } from '../components/PriceChart'
import { SourceHealthBadge } from '../components/SourceHealthBadge'
import { ConnectionBadge } from '../components/ConnectionBadge'
import { AlertBadge } from '../components/AlertBadge'
import { AlertModal } from '../components/AlertModal'
import { DateRangePicker, dateRangeToParams, type DateRange } from '../components/DateRangePicker'
import { formatPrice, formatTimestamp } from '../utils/format'
import type { Alert, AlertFormData } from '../types'

function parseDateRange(searchParams: URLSearchParams): DateRange {
  const preset = searchParams.get('preset')
  const startDate = searchParams.get('startDate') ?? ''
  const endDate = searchParams.get('endDate') ?? ''

  const validPresets = ['1h', '24h', '7d', '30d', '1y', 'all', 'custom']
  if (preset && validPresets.includes(preset)) {
    return { preset: preset as DateRange['preset'], startDate, endDate }
  }
  return { preset: '24h', startDate: '', endDate: '' }
}

export function PriceDetail() {
  const { pair } = useParams<{ pair: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const decodedPair = pair ? decodeURIComponent(pair) : null

  // Date range state — persisted in URL
  const [dateRange, setDateRange] = useState<DateRange>(() => parseDateRange(searchParams))

  const historyParams = useMemo(() => dateRangeToParams(dateRange), [dateRange])

  const { history, loading: historyLoading } = usePriceHistory(decodedPair, historyParams)
  const { prices, livePrices, wsStatus, subscribe, unsubscribe } = usePriceContext()
  const { alerts, addAlert, updateAlert, removeAlert, getAlertsForPair, hasAlertsForPair } =
    useAlerts()

  const { exporting, exportHistory } = useExport()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null)

  // Sync date range to URL
  const handleDateRangeChange = useCallback(
    (range: DateRange) => {
      setDateRange(range)
      const params = new URLSearchParams(searchParams)
      params.set('preset', range.preset)
      if (range.startDate) params.set('startDate', range.startDate)
      else params.delete('startDate')
      if (range.endDate) params.set('endDate', range.endDate)
      else params.delete('endDate')
      setSearchParams(params, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  useEffect(() => {
    if (decodedPair) subscribe([decodedPair])
    return () => {
      if (decodedPair) unsubscribe([decodedPair])
    }
  }, [decodedPair, subscribe, unsubscribe])

  const priceData =
    livePrices.get(decodedPair ?? '') ?? prices.find((p) => p.assetPair === decodedPair)

  const handleOpenModal = useCallback(() => {
    const existing = alerts.find((a) => a.assetPair === decodedPair && a.active)
    setEditingAlert(existing ?? null)
    setModalOpen(true)
  }, [alerts, decodedPair])

  const handleSave = useCallback(
    (data: AlertFormData) => {
      if (editingAlert) {
        updateAlert(editingAlert.id, {
          upperThreshold: data.upperThreshold ? Number.parseFloat(data.upperThreshold) : null,
          lowerThreshold: data.lowerThreshold ? Number.parseFloat(data.lowerThreshold) : null,
          triggerOnce: data.triggerOnce,
        })
      } else {
        addAlert({
          assetPair: data.assetPair,
          upperThreshold: data.upperThreshold ? Number.parseFloat(data.upperThreshold) : null,
          lowerThreshold: data.lowerThreshold ? Number.parseFloat(data.lowerThreshold) : null,
          triggerOnce: data.triggerOnce,
          active: true,
        })
      }
      setModalOpen(false)
      setEditingAlert(null)
    },
    [editingAlert, addAlert, updateAlert],
  )

  const handleDelete = useCallback(() => {
    if (editingAlert) {
      removeAlert(editingAlert.id)
      setModalOpen(false)
      setEditingAlert(null)
    }
  }, [editingAlert, removeAlert])

  if (!decodedPair) {
    navigate('/')
    return null
  }

  const pairAlerts = getAlertsForPair(decodedPair)

  return (
    <div>
      <button
        onClick={() => navigate('/')}
        className="mb-6 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex items-center gap-1 cursor-pointer"
        type="button"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>

      {priceData && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-white">{decodedPair}</h1>
                {hasAlertsForPair(decodedPair) && (
                  <span className="w-2 h-2 rounded-full bg-amber-400" role="status" aria-label="Active alert" />
                )}
                {liveEntry && (
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                )}
                {liveEntry?.syncState === 'optimistic' && (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                    Optimistic update
                  </span>
                )}
                {liveEntry?.syncState === 'rollback' && (
                  <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-300">
                    REST corrected
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Last updated: {formatTimestamp(priceData.timestamp)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ExportButton
                onExport={(fmt) => exportHistory(decodedPair, history, fmt)}
                exporting={exporting}
                disabled={history.length === 0}
              />
              <AlertBadge count={pairAlerts.length} alerts={pairAlerts} onClick={handleOpenModal} />
              <span className="text-sm text-cyan-400">
                {(priceData.confidence * 100).toFixed(1)}% confidence
              </span>
              <ConnectionBadge status={wsStatus} />
            </div>
          </div>

          <div
            className={`text-5xl font-bold text-gray-900 dark:text-white mb-4 font-mono tracking-tight transition-colors duration-700 ${
              liveEntry?.syncState === 'confirmed'
                ? 'text-emerald-300'
                : liveEntry?.syncState === 'rollback'
                  ? 'text-rose-300'
                  : ''
            }`}
          >
            ${formatPrice(priceData.price)}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-2">Oracle Sources</p>
              <SourceHealthBadge sources={priceData.sources} />
            </div>
            <button
              type="button"
              onClick={handleOpenModal}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-colors ${hasAlertsForPair(decodedPair) ? 'text-amber-400 bg-amber-400/10 border border-amber-400/20 hover:bg-amber-400/20' : 'text-gray-400 bg-gray-800 border border-gray-700 hover:bg-gray-700 hover:text-gray-300'}`}
              aria-label={hasAlertsForPair(decodedPair) ? 'Manage alerts' : 'Set price alert'}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"
                />
              </svg>
              {hasAlertsForPair(decodedPair) ? 'Manage Alert' : 'Set Alert'}
            </button>
          </div>
        </div>
      )}

      {!priceData && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8 flex items-center justify-between text-gray-500">
          <p>{historyLoading ? 'Loading...' : `No price data for ${decodedPair}`}</p>
          <button
            type="button"
            onClick={handleOpenModal}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 hover:text-gray-300 transition-colors"
            aria-label="Set price alert"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"
              />
            </svg>
            Set Alert
          </button>
        </div>
      )}

      {/* Date range picker */}
      <div className="mb-4">
        <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
      </div>

      <PriceChart data={history} pair={decodedPair} loading={historyLoading} />

      <AlertModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingAlert(null)
        }}
        onSave={handleSave}
        onDelete={editingAlert ? handleDelete : undefined}
        alert={editingAlert}
        currentPrice={priceData?.price}
      />
    </div>
  )
}
