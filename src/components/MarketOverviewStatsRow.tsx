import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import type { MarketOverviewStats, OverviewFilterKey } from '../hooks/useMarketOverviewStats'
import { SkeletonBone } from './Skeletons/SkeletonBone'

const TILE_COUNT = 5

export function formatChangePct(pct: number | null): string {
  if (pct === null) return '—'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

export function formatConfidencePct(confidence: number | null): string {
  if (confidence === null) return '—'
  return `${(confidence * 100).toFixed(1)}%`
}

export function formatFreshness(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return '<1s'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  return `${hours}h`
}

export function formatPrice(price: number | null): string {
  if (price === null || !Number.isFinite(price)) return '—'
  return price < 1
    ? `$${price.toFixed(4)}`
    : `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

interface TileDef {
  key: OverviewFilterKey
  label: string
  value: string
  sublabel: string
  tone: 'up' | 'down' | 'neutral'
}

interface Props {
  stats: MarketOverviewStats
  loading: boolean
  activeFilter: OverviewFilterKey | null
  onToggleFilter: (key: OverviewFilterKey) => void
}

const toneClass: Record<TileDef['tone'], string> = {
  up: 'text-green-400',
  down: 'text-red-400',
  neutral: 'text-gray-100 dark:text-white',
}

/**
 * Compact, clickable market-level summary rendered above the price grid (#476).
 *
 * Each tile is a toggle button: activating one filters the grid down to the
 * pairs it represents (e.g. clicking "Avg Confidence" isolates the lowest
 * confidence pairs). Values are derived from {@link useMarketOverviewStats}
 * and therefore recompute on every WebSocket tick.
 */
export function MarketOverviewStatsRow({ stats, loading, activeFilter, onToggleFilter }: Props): ReactElement {
  const { t } = useTranslation()
  const [announcement, setAnnouncement] = useState('')
  const lastAnnouncedRef = useRef('')

  const tiles: TileDef[] = [
    {
      key: 'movers',
      label: t('dashboard.overview.change.label', { defaultValue: '24h Change' }),
      value: formatChangePct(stats.changePct),
      sublabel: stats.changeSinceSessionOnly
        ? t('dashboard.overview.change.sessionHint', { defaultValue: 'since tracking started' })
        : t('dashboard.overview.change.hint', { defaultValue: 'avg across pairs' }),
      tone: stats.changePct === null || stats.changePct === 0 ? 'neutral' : stats.changePct > 0 ? 'up' : 'down',
    },
    {
      key: 'atHigh',
      label: t('dashboard.overview.high.label', { defaultValue: '24h High' }),
      value: formatPrice(stats.highPrice),
      sublabel: t('dashboard.overview.high.hint', { count: stats.highCount, defaultValue: '{{count}} at high' }),
      tone: 'up',
    },
    {
      key: 'atLow',
      label: t('dashboard.overview.low.label', { defaultValue: '24h Low' }),
      value: formatPrice(stats.lowPrice),
      sublabel: t('dashboard.overview.low.hint', { count: stats.lowCount, defaultValue: '{{count}} at low' }),
      tone: 'down',
    },
    {
      key: 'lowConfidence',
      label: t('dashboard.overview.confidence.label', { defaultValue: 'Avg Confidence' }),
      value: formatConfidencePct(stats.avgConfidence),
      sublabel: t('dashboard.overview.confidence.hint', { defaultValue: 'click for lowest' }),
      tone: 'neutral',
    },
    {
      key: 'stale',
      label: t('dashboard.overview.freshness.label', { defaultValue: 'Avg Freshness' }),
      value: formatFreshness(stats.avgFreshnessMs),
      sublabel: t('dashboard.overview.freshness.hint', { defaultValue: 'click for stalest' }),
      tone: 'neutral',
    },
  ]

  // Announce meaningful (rounded) changes via aria-live, throttled naturally by only
  // updating text when the rounded values actually differ — avoids spamming screen
  // readers on every sub-second WS tick while still surfacing real movement.
  useEffect(() => {
    if (loading) return
    const summary = [
      `${tiles[0].label} ${tiles[0].value}`,
      `${tiles[1].label} ${tiles[1].value}`,
      `${tiles[2].label} ${tiles[2].value}`,
      `${tiles[3].label} ${tiles[3].value}`,
      `${tiles[4].label} ${tiles[4].value}`,
    ].join(', ')
    if (summary !== lastAnnouncedRef.current) {
      lastAnnouncedRef.current = summary
      setAnnouncement(summary)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tiles is derived fresh each render from stats; comparing the joined summary is the intended dedupe key
  }, [loading, stats])

  if (loading) {
    return (
      <section
        aria-label={t('dashboard.overview.ariaLabel', { defaultValue: 'Market overview' })}
        aria-busy="true"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-6"
      >
        {Array.from({ length: TILE_COUNT }, (_, i) => (
          <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3">
            <SkeletonBone className="h-3 w-16 rounded mb-2" />
            <SkeletonBone className="h-5 w-20 rounded mb-2" />
            <SkeletonBone className="h-2.5 w-14 rounded" />
          </div>
        ))}
      </section>
    )
  }

  return (
    <section
      aria-label={t('dashboard.overview.ariaLabel', { defaultValue: 'Market overview' })}
      className="mb-6"
    >
      <div role="group" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {tiles.map((tile) => {
          const isActive = activeFilter === tile.key
          return (
            <button
              key={tile.key}
              type="button"
              onClick={() => onToggleFilter(tile.key)}
              aria-pressed={isActive}
              aria-label={t('dashboard.overview.tileAriaLabel', {
                label: tile.label,
                value: tile.value,
                defaultValue: '{{label}}: {{value}}. Click to filter the grid.',
              })}
              className={`text-left rounded-xl p-3 border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                isActive
                  ? 'bg-cyan-600/20 border-cyan-500'
                  : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 truncate">
                {tile.label}
              </p>
              <p className={`text-lg font-bold tabular-nums truncate ${toneClass[tile.tone]}`}>{tile.value}</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{tile.sublabel}</p>
            </button>
          )
        })}
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </section>
  )
}
