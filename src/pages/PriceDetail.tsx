import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchPrice } from '../api/rest'
import { usePriceHistory } from '../hooks/usePriceHistory'
import { PriceChart } from '../components/PriceChart'
import { formatPrice, timeAgo, formatTimestamp } from '../utils/format'
import type { PriceData } from '../types'

const SOURCE_COLORS: Record<string, string> = {
  chainlink: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
  redstone: 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30',
  band: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30',
  reflector: 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
}

export function PriceDetail() {
  const { pair } = useParams<{ pair: string }>()
  const navigate = useNavigate()
  const decodedPair = pair ? decodeURIComponent(pair) : ''

  const [priceData, setPriceData] = useState<PriceData | null>(null)
  const [priceLoading, setPriceLoading] = useState(true)
  const [priceError, setPriceError] = useState<string | null>(null)

  const { history, loading: historyLoading, error: historyError } = usePriceHistory(decodedPair || null)

  useEffect(() => {
    if (!decodedPair) return
    let cancelled = false
    setPriceLoading(true)
    setPriceError(null)

    fetchPrice(decodedPair)
      .then((data) => {
        if (!cancelled) {
          setPriceData(data)
          setPriceLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setPriceError(e instanceof Error ? e.message : 'Failed to load price data')
          setPriceLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [decodedPair])

  if (!decodedPair) {
    return (
      <div className="text-center py-32 text-gray-500">
        <p className="text-lg mb-2">No pair specified</p>
      </div>
    )
  }

  const loading = priceLoading || (decodedPair !== null && !priceData && !priceError)
  const error = priceError || historyError

  return (
    <div className="max-w-5xl mx-auto">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>

      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-xl text-sm text-red-400" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="h-8 w-64 bg-gray-800 rounded animate-pulse" />
          <div className="h-16 w-48 bg-gray-800 rounded animate-pulse" />
          <div className="h-80 bg-gray-800 rounded-xl animate-pulse" />
        </div>
      ) : priceData ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-100">{priceData.assetPair}</h1>
              <p className="text-sm text-gray-500 mt-1">
                Updated {timeAgo(priceData.timestamp)}
                <span className="ml-2 text-gray-600">({formatTimestamp(priceData.timestamp)})</span>
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-gray-100 font-mono tracking-tight">
                ${formatPrice(priceData.price)}
              </div>
              <div className="text-sm text-cyan-400 mt-1">
                {(priceData.confidence * 100).toFixed(1)}% confidence
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            {priceData.sources.map((src) => (
              <span
                key={src}
                className={`px-3 py-1 rounded-lg text-sm font-medium border ${SOURCE_COLORS[src] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'}`}
              >
                {src}
              </span>
            ))}
          </div>

          <div className="mb-8">
            <PriceChart
              data={history}
              pair={priceData.assetPair}
              loading={historyLoading}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
