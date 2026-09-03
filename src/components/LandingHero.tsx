import { memo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { PriceData } from '../types'
import { formatPrice } from '../utils/format'

interface MarketStatProps {
  label: string
  value: string
  subValue?: string
  highlight?: boolean
}

const MarketStat = memo(function MarketStat({ label, value, subValue, highlight }: MarketStatProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
      <span className={`text-2xl font-bold font-mono ${highlight ? 'text-cyan-400' : 'text-white'}`}>
        {value}
      </span>
      {subValue && <span className="text-xs text-gray-500">{subValue}</span>}
    </div>
  )
})

interface TopPairCardProps {
  price: PriceData
}

const TopPairCard = memo(function TopPairCard({ price }: TopPairCardProps) {
  const { t } = useTranslation()
  return (
    <Link
      to={`/prices/${encodeURIComponent(price.assetPair)}`}
      className="flex items-center justify-between px-4 py-3 bg-gray-800/60 border border-gray-700 rounded-xl hover:border-cyan-500/50 hover:bg-gray-800 transition-all"
      aria-label={t('landing.topPairs.pairAriaLabel', { pair: price.assetPair })}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center">
          <span className="text-[10px] font-bold text-cyan-400">{price.assetPair.split('/')[0].slice(0, 3)}</span>
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-100">{price.assetPair}</div>
          <div className="text-xs text-gray-500">{price.sources.length} {t('landing.topPairs.sources')}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold font-mono text-white">${formatPrice(price.price)}</div>
        <div className="text-xs text-cyan-400">{(price.confidence * 100).toFixed(0)}% {t('landing.topPairs.confidence')}</div>
      </div>
    </Link>
  )
})

interface LandingHeroProps {
  prices: PriceData[]
  loading?: boolean
  onEnterDashboard?: () => void
}

export const LandingHero = memo(function LandingHero({ prices, loading = false, onEnterDashboard }: LandingHeroProps) {
  const { t } = useTranslation()

  const totalPairs = prices.length
  const activeSources = [...new Set(prices.flatMap((p) => p.sources))].length
  const avgConfidence = prices.length > 0
    ? (prices.reduce((sum, p) => sum + p.confidence, 0) / prices.length * 100).toFixed(1)
    : '—'
  const highConfCount = prices.filter((p) => p.confidence > 0.9).length

  // Top 4 pairs sorted by confidence desc
  const topPairs = [...prices]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 4)

  return (
    <section
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 border border-gray-800 mb-8 print:hidden"
      aria-label={t('landing.hero.ariaLabel')}
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative px-6 py-8 sm:px-10 sm:py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-8">
          <div className="max-w-lg">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" aria-hidden="true" />
              <span className="text-xs text-cyan-400 font-medium uppercase tracking-wider">
                {t('landing.hero.liveStatus')}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight">
              {t('landing.hero.title')}
            </h1>
            <p className="text-gray-400 text-base leading-relaxed">
              {t('landing.hero.subtitle')}
            </p>
          </div>

          <div className="flex flex-col gap-3 shrink-0">
            <Link
              to="/dashboard"
              onClick={onEnterDashboard}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-cyan-900/30"
              aria-label={t('landing.hero.ctaAriaLabel')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {t('landing.hero.cta')}
            </Link>
            <Link
              to="/api-docs"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-600 font-medium rounded-xl transition-colors"
            >
              {t('landing.hero.apiDocs')}
            </Link>
          </div>
        </div>

        {/* Market stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-8 p-4 bg-gray-900/60 rounded-xl border border-gray-800">
          <MarketStat
            label={t('landing.stats.totalPairs')}
            value={loading ? '…' : String(totalPairs)}
            subValue={t('landing.stats.totalPairsDetail')}
            highlight
          />
          <MarketStat
            label={t('landing.stats.activeSources')}
            value={loading ? '…' : String(activeSources)}
            subValue={t('landing.stats.activeSourcesDetail')}
          />
          <MarketStat
            label={t('landing.stats.avgConfidence')}
            value={loading ? '…' : `${avgConfidence}%`}
            subValue={t('landing.stats.avgConfidenceDetail')}
          />
          <MarketStat
            label={t('landing.stats.highConfidence')}
            value={loading ? '…' : String(highConfCount)}
            subValue={t('landing.stats.highConfidenceDetail')}
            highlight
          />
        </div>

        {/* Top pairs */}
        {(loading || topPairs.length > 0) && (
          <div>
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
              {t('landing.topPairs.title')}
            </h2>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 4 }, (_, i) => (
                  <div
                    key={i}
                    className="h-[60px] bg-gray-800/40 border border-gray-700 rounded-xl animate-pulse"
                    aria-hidden="true"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {topPairs.map((p) => (
                  <TopPairCard key={p.assetPair} price={p} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Oracle source badges */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-6 border-t border-gray-800">
          <span className="text-xs text-gray-500">{t('landing.powered.label')}</span>
          {['Chainlink', 'Redstone', 'Band', 'Reflector'].map((src) => (
            <span
              key={src}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-800 border border-gray-700 text-gray-300"
            >
              {src}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
})
