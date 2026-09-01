import { Suspense, useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSwr } from '../hooks/useSwr'
import { usePriceHistory } from '../hooks/usePriceHistory'
import { fetchPrice } from '../api/rest'
import { PriceDetailSkeleton } from '../components/PriceDetailSkeleton'
import { CsvImportZone } from '../components/CsvImportZone'
import { OnChainComparisonPanel } from '../components/OnChainComparisonPanel'
import { BacktestTool } from '../components/BacktestTool'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { VisibleSuspense } from '../components/VisibleSuspense'
import { MultiPairOverlayChart } from '../components/MultiPairOverlayChart'
import { MoveAttributionPanel } from '../components/MoveAttributionPanel'
import { formatPrice, timeAgo, formatTimestamp } from '../utils/format'
import { SOURCE_COLORS, getConfidenceColor } from '../utils/sourceColors'
import { LazyPriceChart, LazyPriceHistoryTable, LazyPriceProofPanel } from '../utils/chunks'
import { isValidAssetPair, VALID_PAIRS } from '../types'
import { usePreferences } from '../preferences/PreferencesContext'
import { usePriceContext } from '../context/PriceContext'
import { getStellarAssetForPair, shortenAccount } from '../lib/stellarAssets'
import { computeAggregationBreakdown } from '../mocks/data'
import type { CsvRow } from '../components/CsvImportZone'
import type { ExportRow } from '../components/MultiPairOverlayChart'
import type { AggregationMode } from '../types/price'

type DetailTab = 'overview' | 'proof'

/** Canonical on-chain Stellar asset for the feed, resolved via @stellar/stellar-sdk. */
function StellarAssetPanel({ pair }: { pair: string }) {
  const asset = getStellarAssetForPair(pair)

  if (!asset) {
    return (
      <p className="text-sm text-gray-400">
        This feed aggregates an off-chain asset with no canonical on-chain Stellar representation — the Soroban oracle
        roadmap documents how feeds like this get on-chain.
      </p>
    )
  }

  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
        <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
          <path strokeLinecap="round" strokeWidth="1.5" d="M12 7v10M7 12h10" />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-100 flex items-center gap-2">
          {asset.label}
          {asset.isNative && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-semibold uppercase tracking-wide">
              Native
            </span>
          )}
        </p>
        <p className="text-xs text-gray-500 font-mono mt-0.5">{asset.canonical}</p>
        {asset.issuer && (
          <p className="text-xs text-gray-500 mt-0.5">
            Issued by{' '}
            <span className="font-mono text-gray-400" title={asset.issuer}>
              {shortenAccount(asset.issuer)}
            </span>
          </p>
        )}
        <p className="text-[11px] text-gray-600 mt-1">
          This feed is denominated in a Stellar asset — readable on-chain with the Stellar SDK.
        </p>
      </div>
    </div>
  )
}

export function PriceDetail() {
  const { pair } = useParams<{ pair: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { preferences } = usePreferences()
  const { attributionHistory } = usePriceContext()
  const [importedData, setImportedData] = useState<CsvRow[] | null>(null)
  const [activeTab, _setActiveTab] = useState<DetailTab>('overview')
  const [aggregationMode, setAggregationMode] = useState<AggregationMode>('weighted_mean')

  // Benchmark state — persisted to localStorage
  const [benchmarkPair, setBenchmarkPair] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem('supo:benchmarkPair') ?? null
    } catch {
      return null
    }
  })
  const [normalizedMode, setNormalizedMode] = useState(false)

  // Persist benchmarkPair to localStorage whenever it changes
  useEffect(() => {
    try {
      if (benchmarkPair === null) {
        window.localStorage.removeItem('supo:benchmarkPair')
      } else {
        window.localStorage.setItem('supo:benchmarkPair', benchmarkPair)
      }
    } catch {
      // localStorage unavailable — continue silently
    }
  }, [benchmarkPair])

  const decodedPair = pair ? decodeURIComponent(pair) : ''

  // Validate the pair param against the known asset list before fetching
  const isInvalidPair = decodedPair !== '' && !isValidAssetPair(decodedPair)

  // Always call hooks at the top level (Rules of Hooks), but use `enabled`
  // and `null` pair to prevent network requests for invalid input.
  const {
    data: price,
    loading: priceLoading,
    error: priceError,
  } = useSwr(`price:${decodedPair}`, () => fetchPrice(decodedPair), {
    staleTime: 5000,
    retryCount: 2,
    enabled: !isInvalidPair && decodedPair !== '',
  })

  const {
    history,
    loading: historyLoading,
    loadingMore,
    hasMore,
    error: historyError,
    loadMore,
  } = usePriceHistory(isInvalidPair || !decodedPair ? null : decodedPair, { pageSize: 100 })

  // Benchmark pair history — fetched only when a benchmark pair is selected
  const {
    history: benchmarkHistory,
    loading: benchmarkHistoryLoading,
  } = usePriceHistory(benchmarkPair, { pageSize: 100 })

  const loading = priceLoading || (historyLoading && history.length === 0)
  const showEmptyState = !loading && !priceError && !price

  // Compute the aggregation breakdown whenever the price snapshot or mode changes (#459)
  const aggregationBreakdown = useMemo(
    () => (price ? computeAggregationBreakdown(price, aggregationMode) : null),
    [price, aggregationMode],
  )

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 mb-6 transition-colors"
        aria-label={t('priceDetail.backAriaLabel')}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t('priceDetail.back')}
      </button>

      {isInvalidPair ? (
        <div className="p-4 bg-red-900/30 border border-red-800 rounded-xl text-sm text-red-400" role="alert">
          Unknown asset pair: <span className="font-mono text-red-300">{decodedPair}</span>
        </div>
      ) : loading ? (
        <PriceDetailSkeleton />
      ) : priceError ? (
        <div className="p-4 bg-red-900/30 border border-red-800 rounded-xl text-sm text-red-400" role="alert">
          {priceError.message}
        </div>
      ) : price ? (
        <div>
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-2xl font-bold text-gray-100">{price.assetPair}</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-medium">
              {t('priceDetail.live')}
            </span>
          </div>

          {/* Price block */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              {t('priceDetail.sections.currentPrice')}
            </p>
            <p className="text-5xl font-bold font-mono text-gray-100 mb-4">
              ${formatPrice(price.price)}
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">
                {t('priceDetail.updated', { time: timeAgo(price.timestamp) })}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getConfidenceColor(price.confidence)}`}>
                {t('priceDetail.confidence', { value: (price.confidence * 100).toFixed(1) })}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">{formatTimestamp(price.timestamp)}</p>
          </div>

          {/* Sources */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
              {t('priceDetail.sections.oracleSources')}
            </p>
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

          {/* Move attribution — rendered whenever WS attribution data is available */}
          {(() => {
            const pairHistory = attributionHistory.get(decodedPair) ?? []
            const latest = pairHistory[pairHistory.length - 1]
            return latest ? (
              <MoveAttributionPanel latest={latest} history={pairHistory} />
            ) : null
          })()}

          {/* Stellar asset — resolved on-chain via @stellar/stellar-sdk */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Stellar Asset</p>
            <StellarAssetPanel pair={price.assetPair} />
          </div>

          {/* Benchmark comparison section */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Benchmark comparison</p>
            <div className="flex flex-wrap items-center gap-4 mb-4">
              {/* Benchmark pair picker */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="benchmark-pair-select"
                  className="text-sm text-gray-400 whitespace-nowrap"
                >
                  Compare with
                </label>
                <select
                  id="benchmark-pair-select"
                  value={benchmarkPair ?? ''}
                  onChange={(e) => setBenchmarkPair(e.target.value === '' ? null : e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 cursor-pointer"
                  aria-label="Select benchmark pair"
                >
                  <option value="">— None —</option>
                  {VALID_PAIRS.filter((p) => p !== decodedPair).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Normalized view toggle — only relevant when a benchmark is active */}
              {benchmarkPair !== null && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={normalizedMode}
                    onChange={(e) => setNormalizedMode(e.target.checked)}
                    className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-cyan-500 focus:ring-cyan-500/50 cursor-pointer"
                    aria-label="Normalized view (% change)"
                  />
                  <span className="text-sm text-gray-400">Normalized view (% change)</span>
                </label>
              )}
            </div>

            {/* Multi-pair overlay chart shown when a benchmark is selected */}
            {benchmarkPair !== null && (
              benchmarkHistoryLoading && benchmarkHistory.length === 0 ? (
                <div
                  className="h-80 rounded-lg bg-gray-800/60 animate-pulse"
                  role="status"
                  aria-label="Loading benchmark chart"
                />
              ) : (
                <MultiPairOverlayChart
                  pairs={[decodedPair, benchmarkPair]}
                  history={{
                    [decodedPair]: history,
                    [benchmarkPair]: benchmarkHistory,
                  }}
                  benchmarkPair={benchmarkPair}
                  normalizedMode={normalizedMode}
                  onExport={(rows: ExportRow[]) => {
                    // Build CSV and trigger download
                    if (rows.length === 0) return
                    const pairsInExport = Object.keys(rows[0]).filter((k) => k !== 'timestamp')
                    const header = ['timestamp', ...pairsInExport].join(',')
                    const lines = rows.map((row) =>
                      [row.timestamp, ...pairsInExport.map((p) => row[p] ?? '')].join(','),
                    )
                    const csv = [header, ...lines].join('\n')
                    const blob = new Blob([csv], { type: 'text/csv' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `benchmark_${decodedPair.replace('/', '-')}_vs_${benchmarkPair.replace('/', '-')}.csv`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                />
              )
            )}

            {benchmarkPair === null && (
              <p className="text-sm text-gray-500">
                Select a pair above to compare it against {decodedPair} on the same chart.
              </p>
            )}
          </div>

          {/* Off-chain vs on-chain price comparison */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">On-Chain Comparison</p>
            <OnChainComparisonPanel
              pair={price.assetPair}
              offChainPrice={price.price}
              thresholdPercent={preferences.onChainDivergenceThresholdPercent}
            />
          </div>

          {/* Paginated History chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">
              {t('priceDetail.sections.priceHistory')}
            </p>
            {historyError ? (
              <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-400" role="alert">
                {t('priceDetail.historyError', { message: historyError.message })}
              </div>
            ) : (
              <ErrorBoundary boundaryId="price-chart" featureLabel="Price Chart">
                <VisibleSuspense
                  fallback={
                    <div
                      className="h-80 rounded-lg bg-gray-800/60 animate-pulse"
                      role="status"
                      aria-label="Loading price chart"
                    />
                  }
                >
                  <LazyPriceChart
                    data={history}
                    pair={decodedPair}
                    loading={historyLoading && history.length === 0}
                    loadingMore={loadingMore}
                    hasMore={hasMore}
                    onLoadMore={loadMore}
                    timezone={preferences.chartTimezone}
                  />
                </VisibleSuspense>
              </ErrorBoundary>
            )}
          </div>

          {activeTab === 'proof' ? (
            <ErrorBoundary boundaryId="price-proof" featureLabel="Price Proof">
              <Suspense
                fallback={
                  <div
                    className="h-40 rounded-lg bg-gray-800/60 animate-pulse"
                    role="status"
                    aria-label={t('priceDetail.proof.loadingLabel')}
                  />
                }
              >
                <LazyPriceProofPanel
                  pair={price.assetPair}
                  latestTimestamp={price.timestamp}
                  historyTimestamps={history.map((h) => h.timestamp)}
                />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <>
              {/* Price block */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                  {t('priceDetail.sections.currentPrice')}
                </p>
                <p className="text-5xl font-bold font-mono text-gray-100 mb-4">${formatPrice(price.price)}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{t('priceDetail.updated', { time: timeAgo(price.timestamp) })}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium border ${getConfidenceColor(price.confidence)}`}
                  >
                    {t('priceDetail.confidence', { value: (price.confidence * 100).toFixed(1) })}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{formatTimestamp(price.timestamp)}</p>
              </div>

              {/* Sources */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                  {t('priceDetail.sections.oracleSources')}
                </p>
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

              {/* Move attribution — rendered whenever WS attribution data is available */}
              {(() => {
                const pairHistory = attributionHistory.get(decodedPair) ?? []
                const latest = pairHistory[pairHistory.length - 1]
                return latest ? (
                  <MoveAttributionPanel latest={latest} history={pairHistory} />
                ) : null
              })()}

              {/* Stellar asset — resolved on-chain via @stellar/stellar-sdk */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Stellar Asset</p>
                <StellarAssetPanel pair={price.assetPair} />
              </div>

              {/* Benchmark comparison section */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Benchmark comparison</p>
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="benchmark-pair-select-tab"
                      className="text-sm text-gray-400 whitespace-nowrap"
                    >
                      Compare with
                    </label>
                    <select
                      id="benchmark-pair-select-tab"
                      value={benchmarkPair ?? ''}
                      onChange={(e) => setBenchmarkPair(e.target.value === '' ? null : e.target.value)}
                      className="bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 cursor-pointer"
                      aria-label="Select benchmark pair"
                    >
                      <option value="">— None —</option>
                      {VALID_PAIRS.filter((p) => p !== decodedPair).map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  {benchmarkPair !== null && (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={normalizedMode}
                        onChange={(e) => setNormalizedMode(e.target.checked)}
                        className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-cyan-500 focus:ring-cyan-500/50 cursor-pointer"
                        aria-label="Normalized view (% change)"
                      />
                      <span className="text-sm text-gray-400">Normalized view (% change)</span>
                    </label>
                  )}
                </div>
                {benchmarkPair !== null && (
                  benchmarkHistoryLoading && benchmarkHistory.length === 0 ? (
                    <div
                      className="h-80 rounded-lg bg-gray-800/60 animate-pulse"
                      role="status"
                      aria-label="Loading benchmark chart"
                    />
                  ) : (
                    <MultiPairOverlayChart
                      pairs={[decodedPair, benchmarkPair]}
                      history={{
                        [decodedPair]: history,
                        [benchmarkPair]: benchmarkHistory,
                      }}
                      benchmarkPair={benchmarkPair}
                      normalizedMode={normalizedMode}
                      onExport={(rows: ExportRow[]) => {
                        if (rows.length === 0) return
                        const pairsInExport = Object.keys(rows[0]).filter((k) => k !== 'timestamp')
                        const header = ['timestamp', ...pairsInExport].join(',')
                        const lines = rows.map((row) =>
                          [row.timestamp, ...pairsInExport.map((p) => row[p] ?? '')].join(','),
                        )
                        const csv = [header, ...lines].join('\n')
                        const blob = new Blob([csv], { type: 'text/csv' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `benchmark_${decodedPair.replace('/', '-')}_vs_${benchmarkPair.replace('/', '-')}.csv`
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                    />
                  )
                )}
                {benchmarkPair === null && (
                  <p className="text-sm text-gray-500">
                    Select a pair above to compare it against {decodedPair} on the same chart.
                  </p>
                )}
              </div>

              {/* Paginated History chart */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">
                  {t('priceDetail.sections.priceHistory')}
                </p>
                {historyError ? (
                  <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-400" role="alert">
                    {t('priceDetail.historyError', { message: historyError.message })}
                  </div>
                ) : (
                  <ErrorBoundary
                    boundaryId="price-chart"
                    featureLabel="Price Chart"
                    fallback={
                      <div
                        role="alert"
                        aria-label="Chart rendering failed"
                        className="flex flex-col items-center justify-center h-80 rounded-lg border border-red-800 bg-red-900/20 text-center gap-2 p-6"
                      >
                        <p className="text-base font-semibold text-gray-100">Chart failed to load</p>
                        <p className="text-sm text-gray-400">
                          The price history chart encountered an error. Price data is still available above.
                        </p>
                      </div>
                    }
                  >
                    <VisibleSuspense
                      fallback={
                        <div
                          className="h-80 rounded-lg bg-gray-800/60 animate-pulse"
                          role="status"
                          aria-label="Loading price chart"
                        />
                      }
                    >
                      <LazyPriceChart
                        data={history}
                        pair={decodedPair}
                        loading={historyLoading && history.length === 0}
                        loadingMore={loadingMore}
                        hasMore={hasMore}
                        onLoadMore={loadMore}
                        timezone={preferences.chartTimezone}
                      />
                    </VisibleSuspense>
                  </ErrorBoundary>
                )}
              </div>

              {/* Price history table */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Price History (Table)</p>
                {historyError ? (
                  <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-400" role="alert">
                    Failed to load price history: {historyError.message}
                  </div>
                ) : (
                  <VisibleSuspense
                    fallback={
                      <div
                        className="h-48 rounded-lg bg-gray-800/60 animate-pulse"
                        role="status"
                        aria-label="Loading price history table"
                      />
                    }
                  >
                    <LazyPriceHistoryTable data={history} />
                  </VisibleSuspense>
                )}
              </div>

              {/* Backtesting Tool */}
              <div className="mb-6">
                <ErrorBoundary boundaryId="backtest-tool" featureLabel="Backtest Tool">
                  <BacktestTool pair={decodedPair} history={history} />
                </ErrorBoundary>
              </div>

              {/* CSV import */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">
                  {t('priceDetail.sections.importData')}
                </p>
                <CsvImportZone
                  hasImport={importedData !== null}
                  onImport={setImportedData}
                  onClear={() => setImportedData(null)}
                />
              </div>
            </>
          )}
        </div>
      ) : showEmptyState ? (
        <div className="p-8 border border-gray-800 bg-gray-900/70 rounded-xl text-center" role="status">
          <h2 className="text-xl font-semibold text-gray-100 mb-2">{t('priceDetail.emptyState.title')}</h2>
          <p className="text-sm text-gray-400">{t('priceDetail.emptyState.detail')}</p>
        </div>
      ) : null}
    </div>
  )
}
