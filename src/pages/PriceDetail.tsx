import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSwr } from '../hooks/useSwr'
import { fetchPrice, fetchPriceHistory } from '../api/rest'
import { PriceDetailSkeleton } from '../components/PriceDetailSkeleton'
import { CsvImportZone } from '../components/CsvImportZone'
import { CanvasChart } from '../chart/CanvasChart'
import { formatPrice, timeAgo, formatTimestamp, formatChartTime } from '../utils/format'
import type { ChartSeries } from '../chart/ChartEngine'
import type { CsvRow } from '../components/CsvImportZone'

const SOURCE_COLORS: Record<string, string> = {
  chainlink: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  redstone: 'bg-red-500/20 text-red-400 border-red-500/30',
  band: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  reflector: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
}

export function PriceDetail() {
  const { pair } = useParams<{ pair: string }>()
  const navigate = useNavigate()
  const [importedData, setImportedData] = useState<CsvRow[] | null>(null)

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

  const chartSeries = useMemo<ChartSeries[]>(() => {
    const series: ChartSeries[] = []
    if (historyResponse && historyResponse.history.length >= 2) {
      series.push({
        id: 'oracle',
        label: decodedPair,
        points: historyResponse.history.map((h) => ({ x: h.timestamp, y: h.price })),
        color: '#06b6d4',
        style: 'area',
      })
    }
    if (importedData && importedData.length >= 2) {
      series.push({
        id: 'imported',
        label: 'Imported CSV',
        points: importedData.map((r) => ({ x: r.timestamp, y: r.price })),
        color: '#f59e0b',
        style: 'dashed-line',
      })
    }
    return series
  }, [historyResponse, importedData, decodedPair])

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
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Price History</p>
            {chartSeries.length > 0 ? (
              <CanvasChart
                series={chartSeries}
                className="w-full h-48"
                formatX={formatChartTime}
                formatY={formatPrice}
              />
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
                No history available
              </div>
            )}
          </div>

          {/* CSV import */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Import Price Data</p>
            <CsvImportZone
              hasImport={importedData !== null}
              onImport={setImportedData}
              onClear={() => setImportedData(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
