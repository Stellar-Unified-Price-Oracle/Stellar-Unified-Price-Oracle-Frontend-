import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePriceContext } from '../context/PriceContext'
import { useAlerts } from '../hooks/useAlerts'
import { AlertModal } from '../components/AlertModal'
import type { AlertFormData } from '../types'

export function PriceDetail() {
  const { pair } = useParams<{ pair: string }>()
  const navigate = useNavigate()
  const decodedPair = pair ? decodeURIComponent(pair) : ''
  const { prices, livePrices } = usePriceContext()
  const { alerts, addAlert, removeAlert } = useAlerts()

  const [modalOpen, setModalOpen] = useState(false)

  const price = prices.find((p) => p.assetPair === decodedPair)
  const live = decodedPair ? livePrices.get(decodedPair) : undefined
  const displayData = live ? live.data : price

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

  if (!displayData) {
    return (
      <div className="text-center py-32 text-gray-500">
        <p className="text-lg mb-2">Price feed not found</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-500/20 transition-colors cursor-pointer"
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => navigate('/')}
        className="mb-6 flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        aria-label="Back to Dashboard"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{decodedPair}</h1>
            <p className="text-sm text-gray-400 mt-1">
              Updated {new Date(displayData.timestamp).toLocaleString()}
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-900/40 text-amber-400 border border-amber-800/50 rounded-lg text-sm font-medium hover:bg-amber-900/60 transition-colors cursor-pointer"
            aria-label="Set price alert"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Set price alert
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Price</p>
            <p className="text-2xl font-bold text-white">
              ${displayData.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Confidence</p>
            <p className="text-2xl font-bold text-cyan-400">
              {(displayData.confidence * 100).toFixed(1)}% confidence
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Sources</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {displayData.sources.map((source) => (
                <span key={source} className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
                  {source}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AlertModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        alert={alerts.find((a) => a.assetPair === decodedPair) ?? null}
        defaultAssetPair={decodedPair}
        onDelete={
          alerts.find((a) => a.assetPair === decodedPair)
            ? () => {
                const existing = alerts.find((a) => a.assetPair === decodedPair)
                if (existing) removeAlert(existing.id)
                setModalOpen(false)
              }
            : undefined
        }
      />
    </div>
  )
}
