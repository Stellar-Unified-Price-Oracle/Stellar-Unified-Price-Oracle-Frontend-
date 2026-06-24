import { memo, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { PriceHistoryEntry } from '../types'
import { formatChartTime, formatPriceShort } from '../utils/format'

export type TimeRange = '1h' | '24h' | '7d' | '30d' | '1y'

const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: '1H', value: '1h' },
  { label: '24H', value: '24h' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '1Y', value: '1y' },
]

function filterByRange(data: PriceHistoryEntry[], range: TimeRange): PriceHistoryEntry[] {
  const now = Date.now()
  const ms: Record<TimeRange, number> = {
    '1h': 3_600_000,
    '24h': 86_400_000,
    '7d': 7 * 86_400_000,
    '30d': 30 * 86_400_000,
    '1y': 365 * 86_400_000,
  }
  const cutoff = now - ms[range]
  const filtered = data.filter((d) => d.timestamp >= cutoff)
  return filtered.length > 0 ? filtered : data
}

interface PriceChartProps {
  data: PriceHistoryEntry[]
  pair: string
  loading?: boolean
  timeRange?: TimeRange
  onTimeRangeChange?: (range: TimeRange) => void
}

function ChartContent({
  data,
  pair,
  timeRange,
  onTimeRangeChange,
  fullScreen,
  onToggleFullScreen,
  dark,
}: {
  data: PriceHistoryEntry[]
  pair: string
  timeRange: TimeRange
  onTimeRangeChange: (r: TimeRange) => void
  fullScreen: boolean
  onToggleFullScreen: () => void
  dark: boolean
}) {
  // Zoom/pan state
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ x: number; domain: [number, number] } | null>(null)

  const filteredData = filterByRange(data, timeRange)

  const chartData = filteredData
    .slice()
    .reverse()
    .map((d, i) => ({ ...d, time: formatChartTime(d.timestamp), idx: i }))

  const prices = chartData.map((d) => d.price)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const pad = (maxP - minP) * 0.1 || maxP * 0.05

  const colors = {
    gridStroke: dark ? '#1f2937' : '#e5e7eb',
    tickFill: dark ? '#6b7280' : '#9ca3af',
    axisLine: dark ? '#1f2937' : '#e5e7eb',
    tooltipBg: dark ? '#111827' : '#ffffff',
    tooltipBorder: dark ? '#1f2937' : '#e5e7eb',
    tooltipLabel: dark ? '#9ca3af' : '#6b7280',
  }

  const totalPoints = chartData.length
  const activeDomain = useMemo<[number, number]>(
    () => zoomDomain ?? [0, totalPoints - 1],
    [zoomDomain, totalPoints],
  )

  // Reset zoom when data or range changes
  useEffect(() => {
    setZoomDomain(null)
  }, [timeRange, data])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const [lo, hi] = activeDomain
      const span = hi - lo
      const factor = e.deltaY < 0 ? 0.8 : 1.25
      const newSpan = Math.max(2, Math.min(totalPoints - 1, Math.round(span * factor)))
      const center = (lo + hi) / 2
      const newLo = Math.max(0, Math.round(center - newSpan / 2))
      const newHi = Math.min(totalPoints - 1, newLo + newSpan)
      setZoomDomain([newLo, newHi])
    },
    [activeDomain, totalPoints],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsPanning(true)
      panStartRef.current = { x: e.clientX, domain: [...activeDomain] as [number, number] }
    },
    [activeDomain],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning || !panStartRef.current) return
      const dx = e.clientX - panStartRef.current.x
      const [lo, hi] = panStartRef.current.domain
      const span = hi - lo
      // ~300px = full span, scale pixels to index shift
      const shift = -Math.round((dx / 300) * span)
      const newLo = Math.max(0, Math.min(totalPoints - 1 - span, lo + shift))
      setZoomDomain([newLo, newLo + span])
    },
    [isPanning, totalPoints],
  )

  const handleMouseUp = useCallback(() => setIsPanning(false), [])

  const visibleData = chartData.slice(activeDomain[0], activeDomain[1] + 1)

  const rangeBar = (
    <div className="flex items-center gap-1" role="group" aria-label="Time range selector">
      {TIME_RANGES.map((r) => (
        <button
          key={r.value}
          type="button"
          onClick={() => onTimeRangeChange(r.value)}
          className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
            timeRange === r.value
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
          }`}
          aria-pressed={timeRange === r.value}
          aria-label={`${r.label} time range`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{pair} Price History</h3>
        <div className="flex items-center gap-3">
          {rangeBar}
          {zoomDomain && (
            <button
              type="button"
              onClick={() => setZoomDomain(null)}
              className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 rounded transition-colors"
              aria-label="Reset zoom"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={onToggleFullScreen}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
            aria-label={fullScreen ? 'Exit full screen' : 'Enter full screen'}
            aria-expanded={fullScreen}
          >
            {fullScreen ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div
        className={`flex-1 min-h-0 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        role="img"
        aria-label={`${pair} price chart`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={visibleData}>
            <defs>
              <linearGradient id={`priceGradient${fullScreen ? 'Fs' : ''}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.gridStroke} />
            <XAxis
              dataKey="time"
              tick={{ fill: colors.tickFill, fontSize: 11 }}
              axisLine={{ stroke: colors.axisLine }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[minP - pad, maxP + pad]}
              tick={{ fill: colors.tickFill, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatPriceShort}
              width={80}
            />
            <Tooltip
              contentStyle={{
                background: colors.tooltipBg,
                border: `1px solid ${colors.tooltipBorder}`,
                borderRadius: '8px',
                fontSize: '13px',
              }}
              labelStyle={{ color: colors.tooltipLabel }}
              formatter={(value: number) => [`$${formatPriceShort(value)}`, pair]}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#22d3ee"
              strokeWidth={2}
              fill={`url(#priceGradient${fullScreen ? 'Fs' : ''})`}
              dot={false}
              activeDot={{ r: 4, fill: '#22d3ee' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {fullScreen && (
        <p className="text-xs text-gray-600 dark:text-gray-600 mt-2 text-center flex-shrink-0">
          Scroll to zoom · Drag to pan · Press Esc to close
        </p>
      )}
    </div>
  )
}

export const PriceChart = memo(function PriceChart({
  data,
  pair,
  loading,
  timeRange: externalRange,
  onTimeRangeChange: externalOnChange,
}: PriceChartProps) {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [fullScreen, setFullScreen] = useState(false)
  const [internalRange, setInternalRange] = useState<TimeRange>('24h')

  const timeRange = externalRange ?? internalRange
  const onTimeRangeChange = externalOnChange ?? setInternalRange

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!fullScreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullScreen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [fullScreen])

  // Prevent body scroll when full-screen
  useEffect(() => {
    document.body.style.overflow = fullScreen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [fullScreen])

  if (loading) {
    return (
      <div
        className="h-80 bg-gray-100 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl flex items-center justify-center"
        role="status"
        aria-label="Loading chart"
      >
        <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="h-80 bg-gray-100 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500">
        No historical data available
      </div>
    )
  }

  const inline = (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 h-80">
      <ChartContent
        data={data}
        pair={pair}
        timeRange={timeRange}
        onTimeRangeChange={onTimeRangeChange}
        fullScreen={false}
        onToggleFullScreen={() => setFullScreen(true)}
        dark={dark}
      />
    </div>
  )

  const overlay = fullScreen
    ? createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${pair} full screen chart`}
        >
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 w-full max-w-6xl h-[80vh] flex flex-col">
            <ChartContent
              data={data}
              pair={pair}
              timeRange={timeRange}
              onTimeRangeChange={onTimeRangeChange}
              fullScreen={true}
              onToggleFullScreen={() => setFullScreen(false)}
              dark={dark}
            />
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      {inline}
      {overlay}
    </>
  )
})
