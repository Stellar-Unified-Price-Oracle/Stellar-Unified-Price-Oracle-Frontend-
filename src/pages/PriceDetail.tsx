import { useNavigate, useParams } from 'react-router-dom'
import { useSwr } from '../hooks/useSwr'
import { fetchPrice, fetchPriceHistory } from '../api/rest'
import { PriceDetailSkeleton } from '../components/PriceDetailSkeleton'
import { formatPrice, timeAgo, formatTimestamp } from '../utils/format'
import type { PriceHistoryEntry } from '../types'

const SOURCE_COLORS: Record<string, string> = {
  chainlink: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  redstone: 'bg-red-500/20 text-red-400 border-red-500/30',
  band: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  reflector: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
}

function MiniChart({ data }: { data: PriceHistoryEntry[] }) {
  if (data.length < 2) return null

  const W = 600
  const H = 160
  const PAD = 8

  const prices = data.map((d) => d.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1

  const pts = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((d.price - min) / range) * (H - PAD * 2)
    return `${x},${y}`
  })

  const areaPath = `M${pts[0]} L${pts.join(' L')} L${W - PAD},${H - PAD} L${PAD},${H - PAD} Z`
  const linePath = `M${pts[0]} L${pts.join(' L')}`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-48"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#chartGrad)" />
      <path d={linePath} fill="none" stroke="#06b6d4" strokeWidth="2" />
    </svg>
  )
}

export function PriceDetail() {
  const { pair } = useParams<{ pair: string }>()
  const navigate = useNavigate()

  const decodedPair = pair ? decodeURIComponent(pair) : ''

  const { data: price, loading: priceLoading, error: priceError } = useSwr(
    `price:${decodedPair}`,
    () => fetchPrice(decodedPair),
    { staleTime: 5000, retryCount: 2 },
  )

  const { data: historyResponse, loading: historyLoading } = useSwr(
    `history:${decodedPair}`,
    () => fetchPriceHistory(decodedPair, 100),
    { staleTime: 30000, retryCount: 2 },
  )

  const loading = priceLoading || historyLoading

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 mb-6 transition-colors"
        aria-label="Go back"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {loading ? (
        <PriceDetailSkeleton />
      ) : priceError ? (
        <div className="p-4 bg-red-900/30 border border-red-800 rounded-xl text-sm text-red-400" role="alert">
          {priceError}
        </div>
      ) : price ? (
        <div>
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-2xl font-bold text-gray-100">{price.assetPair}</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-medium">
              LIVE
            </span>
          </div>

          {/* Price block */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Current Price</p>
            <p className="text-5xl font-bold font-mono text-gray-100 mb-4">
              ${formatPrice(price.price)}
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Updated {timeAgo(price.timestamp)}</span>
              <span className="text-cyan-400">{(price.confidence * 100).toFixed(1)}% confidence</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">{formatTimestamp(price.timestamp)}</p>
          </div>

          {/* Sources */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Oracle Sources</p>
            <div className="flex flex-wrap gap-2">
              {price.sources.map((src) => (
                <span
                  key={src}
                  className={`px-3 py-1 rounded text-sm font-medium border ${SOURCE_COLORS[src] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}
                >
                  {src}
                </span>
              ))}
            </div>
          </div>

          {/* History chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Price History</p>
            {historyResponse && historyResponse.history.length > 1 ? (
              <MiniChart data={historyResponse.history} />
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
                No history available
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
