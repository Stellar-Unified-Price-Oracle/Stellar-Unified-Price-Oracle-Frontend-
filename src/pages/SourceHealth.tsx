import { memo, useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { useSourceHealth, type SourceHealthData } from '../hooks/useSourceHealth'
import { timeAgo, formatChartTime } from '../utils/format'
import type { SourceName } from '../types'

// ─── Colour palette per source ────────────────────────────────────────────────
const SOURCE_ACCENT: Record<SourceName, { ring: string; badge: string; line: string }> = {
  chainlink: {
    ring: 'ring-blue-500/40',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    line: '#3b82f6',
  },
  redstone: {
    ring: 'ring-red-500/40',
    badge: 'bg-red-500/10 text-red-400 border-red-500/30',
    line: '#ef4444',
  },
  band: {
    ring: 'ring-purple-500/40',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    line: '#a855f7',
  },
  reflector: {
    ring: 'ring-cyan-500/40',
    badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    line: '#22d3ee',
  },
}

// ─── Status helpers ────────────────────────────────────────────────────────────
const STATUS_META = {
  healthy: {
    label: 'Healthy',
    dot: 'bg-green-500',
    text: 'text-green-400',
    pulse: true,
  },
  degraded: {
    label: 'Degraded',
    dot: 'bg-amber-400',
    text: 'text-amber-400',
    pulse: false,
  },
  down: {
    label: 'Down',
    dot: 'bg-red-500',
    text: 'text-red-400',
    pulse: false,
  },
} as const

// ─── Latency chart ─────────────────────────────────────────────────────────────
const LatencyChart = memo(function LatencyChart({
  data,
  lineColor,
  sourceName,
}: {
  data: SourceHealthData['latencyHistory']
  lineColor: string
  sourceName: string
}) {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark'),
  )

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const colors = {
    grid: dark ? '#1f2937' : '#e5e7eb',
    tick: dark ? '#6b7280' : '#9ca3af',
    tooltipBg: dark ? '#111827' : '#ffffff',
    tooltipBorder: dark ? '#1f2937' : '#e5e7eb',
    tooltipLabel: dark ? '#9ca3af' : '#6b7280',
  }

  if (!data.length) {
    return (
      <div className="h-24 flex items-center justify-center text-xs text-gray-500 dark:text-gray-600">
        No latency data
      </div>
    )
  }

  const chartData = data.map((d) => ({
    time: formatChartTime(d.timestamp),
    latency: Math.round(d.latency),
  }))

  const latencies = chartData.map((d) => d.latency)
  const min = Math.min(...latencies)
  const max = Math.max(...latencies)
  const pad = (max - min) * 0.2 || 20

  return (
    <div className="h-24" aria-label={`Latency history for ${sourceName}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis dataKey="time" hide />
          <YAxis
            domain={[Math.max(0, min - pad), max + pad]}
            tick={{ fill: colors.tick, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={36}
            tickFormatter={(v) => `${v}ms`}
          />
          <Tooltip
            contentStyle={{
              background: colors.tooltipBg,
              border: `1px solid ${colors.tooltipBorder}`,
              borderRadius: '6px',
              fontSize: '12px',
            }}
            labelStyle={{ color: colors.tooltipLabel }}
            formatter={(value: number) => [`${value}ms`, 'Latency']}
            labelFormatter={(label) => `Time: ${label}`}
          />
          <Line
            type="monotone"
            dataKey="latency"
            stroke={lineColor}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: lineColor }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
})

// ─── Source card ───────────────────────────────────────────────────────────────
const SourceCard = memo(function SourceCard({ data }: { data: SourceHealthData }) {
  const accent = SOURCE_ACCENT[data.source]
  const status = STATUS_META[data.status]

  return (
    <article
      className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 ring-1 ${accent.ring} flex flex-col gap-4 shadow-sm`}
      aria-label={`${data.source} oracle status`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white capitalize">
            {data.source}
          </h2>
          <span
            className={`inline-flex items-center gap-1.5 mt-1 text-xs font-medium ${status.text}`}
            role="status"
            aria-label={`Status: ${status.label}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${status.dot} ${status.pulse ? 'animate-pulse' : ''}`}
            />
            {status.label}
          </span>
        </div>
        <span
          className={`px-2 py-0.5 rounded border text-xs font-medium ${accent.badge}`}
        >
          Oracle
        </span>
      </div>

      {/* Stats grid */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Latency</dt>
          <dd className="font-mono font-medium text-gray-900 dark:text-gray-100">
            {data.latency !== null ? `${Math.round(data.latency)}ms` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Active feeds</dt>
          <dd className="font-mono font-medium text-gray-900 dark:text-gray-100">
            {data.activeFeeds}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Last update</dt>
          <dd className="font-medium text-gray-900 dark:text-gray-100">
            {data.lastUpdate !== null ? timeAgo(data.lastUpdate) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">24h uptime</dt>
          <dd
            className={`font-mono font-semibold ${
              data.uptime24h >= 99
                ? 'text-green-500'
                : data.uptime24h >= 95
                  ? 'text-amber-400'
                  : 'text-red-400'
            }`}
          >
            {data.uptime24h.toFixed(1)}%
          </dd>
        </div>
      </dl>

      {/* Uptime bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>Uptime</span>
          <span>{data.uptime24h.toFixed(1)}%</span>
        </div>
        <div
          className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden"
          role="progressbar"
          aria-valuenow={data.uptime24h}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${data.uptime24h.toFixed(1)}% uptime over last 24 hours`}
        >
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              data.uptime24h >= 99
                ? 'bg-green-500'
                : data.uptime24h >= 95
                  ? 'bg-amber-400'
                  : 'bg-red-500'
            }`}
            style={{ width: `${data.uptime24h}%` }}
          />
        </div>
      </div>

      {/* Latency chart */}
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Latency (last 20 polls)</p>
        <LatencyChart
          data={data.latencyHistory}
          lineColor={accent.line}
          sourceName={data.source}
        />
      </div>
    </article>
  )
})

// ─── Summary bar ──────────────────────────────────────────────────────────────
function SummaryBar({ sources }: { sources: SourceHealthData[] }) {
  const healthy = sources.filter((s) => s.status === 'healthy').length
  const degraded = sources.filter((s) => s.status === 'degraded').length
  const down = sources.filter((s) => s.status === 'down').length

  return (
    <div className="flex flex-wrap gap-3 text-sm" role="region" aria-label="Health summary">
      <span className="flex items-center gap-1.5 text-green-500">
        <span className="w-2 h-2 rounded-full bg-green-500" aria-hidden="true" />
        {healthy} Healthy
      </span>
      <span className="flex items-center gap-1.5 text-amber-400">
        <span className="w-2 h-2 rounded-full bg-amber-400" aria-hidden="true" />
        {degraded} Degraded
      </span>
      <span className="flex items-center gap-1.5 text-red-400">
        <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
        {down} Down
      </span>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export function SourceHealth() {
  const { sources, lastRefreshed, refresh } = useSourceHealth()

  return (
    <section aria-labelledby="source-health-heading">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1
            id="source-health-heading"
            className="text-2xl font-bold text-gray-900 dark:text-white"
          >
            Source Health
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Real-time status of each oracle data source
          </p>
        </div>

        <div className="flex items-center gap-4">
          <SummaryBar sources={sources} />
          <button
            type="button"
            onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Refresh source health"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582M20 20v-5h-.581M4.582 9A8 8 0 0119 15.418M19.418 15A8 8 0 014.999 8.582"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Last refreshed */}
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
        Last refreshed: {timeAgo(lastRefreshed)} &middot; Auto-updates every 5 seconds
      </p>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {sources.map((s) => (
          <SourceCard key={s.source} data={s} />
        ))}
      </div>
    </section>
  )
}
