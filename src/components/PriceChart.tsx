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
  Line,
  LineChart,
  ReferenceLine,
  ReferenceArea,
} from 'recharts'
import type { TooltipPayload } from 'recharts'
import type { PriceHistoryEntry, PriceQualityFlags } from '../types'
import { formatChartTimeWithTz, formatPriceShort, formatTimestamp, getTimezoneAbbr } from '../utils/format'
import { rasterizeChartToDataUrl } from '../utils/chartExport'
import { exportPriceHistoryPdf } from '../utils/pdfExport'
import { loadChartExport } from '../utils/deferredExports'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { calculateRollingStatistics } from '../utils/rollingStatistics'
import { getChartPalette, getChartTheme, type ChartPalette, type ChartTheme } from '../utils/chartTheme'
import { getSourceTimestampState } from '../utils/sourceTimestamps'
import { buildSourceCoverageData } from '../utils/priceHistoryCoverage'
import { findPriceHistoryGaps } from '../utils/priceHistoryGaps'
import { useIsRtl } from '../hooks/useIsRtl'
import { DataQualityReportModal } from './DataQualityReportModal'

// ---------------------------------------------------------------------------
// #305 – Chart annotation types
// ---------------------------------------------------------------------------
export interface ChartAnnotation {
  /** Unique id for the annotation */
  id: string
  /** Unix timestamp (ms) of the event being annotated */
  timestamp: number
  /** Short label shown on the chart line */
  label: string
  /** Optional longer note shown in the tooltip */
  note?: string
  /** Hex colour for the reference line. Defaults to amber. */
  color?: string
  /** Quality annotations are API-derived and cannot be dismissed as user notes. */
  kind?: 'quality' | 'user'
}

function sourceTimestampSummary(entry: PriceHistoryEntry): string {
  if (entry.sources.length === 0) return 'No source contributors reported'
  return entry.sources
    .map((source) => {
      const sourceTimestamp = entry.sourceTimestamps?.find((item) => item.source === source)
      const state = getSourceTimestampState(sourceTimestamp, entry.timestamp)
      if (state === 'unavailable' || !sourceTimestamp) return `${source}: unavailable from API`
      return `${source}: ${formatTimestamp(sourceTimestamp.timestamp)}${state === 'stale' ? ' (stale)' : ''}`
    })
    .join('; ')
}

// ---------------------------------------------------------------------------
// #300 – Custom tooltip component
// ---------------------------------------------------------------------------
interface ChartPoint {
  price: number
  timestamp: number
  confidence: number
  sources: string[]
  sourceTimestamps?: PriceHistoryEntry['sourceTimestamps']
  time: string
  idx: number
  rollingMedian: number
  rangeLow: number
  rangeHigh: number
  sampleCount: number
  [key: string]: unknown
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload
  label?: string | number
  tzAbbr: string
  allData: ChartPoint[]
  palette: ChartPalette
  normalised?: boolean
}

function CustomTooltip({ active, payload, label, tzAbbr, allData, palette, normalised }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  // The first payload entry carries the primary series data
  const raw = payload[0]?.payload as ChartPoint | undefined
  if (!raw) return null

  const pricePayload = payload.filter((point) => !ROLLING_STAT_KEYS.has(String(point.dataKey)))
  const price = typeof raw.price === 'number' ? raw.price : (pricePayload[0]?.value as number | undefined)
  const confidence = typeof raw.confidence === 'number' ? raw.confidence : null
  const sources: string[] = Array.isArray(raw.sources) ? raw.sources : []
  const qualityFlags = raw.qualityFlags

  // % change vs previous visible point
  let pctChange: number | null = null
  if (!normalised && typeof raw.idx === 'number' && raw.idx > 0) {
    const prev = allData[raw.idx - 1]
    if (prev && prev.price && price) {
      pctChange = ((price - prev.price) / prev.price) * 100
    }
  }

  return (
    <div
      className="rounded-lg border p-3 text-xs shadow-xl min-w-[160px]"
      style={{
        backgroundColor: palette.tooltipBackground,
        borderColor: palette.border,
        color: palette.tooltipForeground,
      }}
    >
      <p className="mb-2" style={{ color: palette.tooltipMuted }}>
        {label} <span className="text-gray-600">({tzAbbr})</span>
      </p>
      {price !== undefined && (
        <p className="font-mono font-semibold text-sm mb-1" style={{ color: palette.tooltipForeground }}>
          {normalised
            ? `${typeof payload[0]?.value === 'number' ? payload[0].value.toFixed(2) : '—'}%`
            : `$${formatPriceShort(price)}`}
        </p>
      )}
      {pctChange !== null && (
        <p className="mb-1 font-mono" style={{ color: palette.series[pctChange >= 0 ? 3 : 4].color }}>
          {pctChange >= 0 ? '▲' : '▼'} {Math.abs(pctChange).toFixed(3)}% vs prev
        </p>
      )}
      {confidence !== null && (
        <p className="mb-1" style={{ color: palette.tooltipMuted }}>
          Confidence: <span style={{ color: palette.tooltipForeground }}>{(confidence * 100).toFixed(1)}%</span>
        </p>
      )}
      {typeof raw.rollingMedian === 'number' && (
        <div className="mt-1.5 pt-1.5 border-t border-gray-800 text-gray-300">
          <p>
            Rolling median:{' '}
            <span className="font-mono">
              {normalised ? `${raw.rollingMedian.toFixed(2)}%` : `$${formatPriceShort(raw.rollingMedian)}`}
            </span>
          </p>
          <p className="text-gray-400">
            Range ({raw.sampleCount} obs.):{' '}
            {normalised
              ? `${raw.rangeLow.toFixed(2)}% to ${raw.rangeHigh.toFixed(2)}%`
              : `$${formatPriceShort(raw.rangeLow)} to $${formatPriceShort(raw.rangeHigh)}`}
          </p>
        </div>
      )}
      {sources.length > 0 && (
        <div className="mt-1.5 pt-1.5 border-t" style={{ borderColor: palette.border }}>
          <p className="mb-1" style={{ color: palette.tooltipMuted }}>
            {sources.length} oracle{sources.length !== 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap gap-1">
            {sources.map((s) => (
              <span
                key={s}
                className="rounded px-1.5 py-0.5 font-mono"
                style={{ backgroundColor: palette.background, color: palette.series[0].color }}
              >
                {s}
              </span>
            ))}
          </div>
          <ul className="mt-1.5 space-y-1" aria-label="Contributing source timestamps">
            {sources.map((source) => {
              const sourceTimestamp = raw.sourceTimestamps?.find((item) => item.source === source)
              const state = getSourceTimestampState(sourceTimestamp, raw.timestamp)
              return (
                <li key={source} style={{ color: palette.tooltipMuted }}>
                  {source}:{' '}
                  {!sourceTimestamp || state === 'unavailable' ? (
                    <span>Unavailable from API</span>
                  ) : (
                    <>
                      <time dateTime={new Date(sourceTimestamp.timestamp).toISOString()}>
                        {formatTimestamp(sourceTimestamp.timestamp)}
                      </time>
                      {state === 'stale' && <span> (stale)</span>}
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {qualityFlags ? (
        <div className="mt-1.5 border-t border-gray-800 pt-1.5">
          <p className="mb-1 text-gray-500">Quality flags reported by API</p>
          {(['synthetic', 'stale', 'imputed'] as const).map((flag) => (
            <p key={flag} className="text-gray-300">
              {flag}: {qualityFlags[flag] === undefined ? 'not reported' : qualityFlags[flag] ? 'yes' : 'no'}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-1.5 border-t border-gray-800 pt-1.5 text-gray-500">Quality flags not reported by API</p>
      )}
      {pricePayload.slice(1).map((p, i) => {
        const color = typeof p.color === 'string' ? p.color : '#fff'
        const label = p.name != null ? String(p.name) : `Series ${i + 1}`
        const value = typeof p.value === 'number' ? p.value : undefined
        return (
          <div key={i} className="mt-1.5 pt-1.5 border-t" style={{ borderColor: palette.border }}>
            <p style={{ color }} className="font-mono">
              {label}:{' '}
              {normalised
                ? `${value !== undefined ? value.toFixed(2) : '—'}%`
                : value !== undefined
                  ? `$${formatPriceShort(value)}`
                  : '—'}
            </p>
          </div>
        )
      })}
    </div>
  )
}

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

// Normalise a series of prices to percentage change relative to first point.
function normaliseToPercent(data: { price: number; timestamp: number }[]): { pct: number; timestamp: number }[] {
  if (data.length === 0) return []
  const base = data[0].price
  if (base === 0) return data.map((d) => ({ pct: 0, timestamp: d.timestamp }))
  return data.map((d) => ({ pct: ((d.price - base) / base) * 100, timestamp: d.timestamp }))
}

export interface OverlayPair {
  pair: string
  data: PriceHistoryEntry[]
}

interface PriceChartProps {
  data: PriceHistoryEntry[]
  pair: string
  loading?: boolean
  loadingMore?: boolean
  hasMore?: boolean
  onLoadMore?: () => Promise<void>
  timeRange?: TimeRange
  onTimeRangeChange?: (range: TimeRange) => void
  /** IANA timezone identifier, 'UTC', or 'Local'. Defaults to 'UTC'. */
  timezone?: string
  /** Additional pairs to overlay on the same chart. */
  overlayPairs?: OverlayPair[]
  /** #305 – Optional chart annotations (events / user notes). */
  annotations?: ChartAnnotation[]
}

function ChartContent({
  data,
  pair,
  timeRange,
  onTimeRangeChange,
  fullScreen,
  onToggleFullScreen,
  palette,
  loadingMore,
  hasMore,
  onLoadMore,
  timezone = 'UTC',
  overlayPairs = [],
  annotations = [],
}: {
  data: PriceHistoryEntry[]
  pair: string
  timeRange: TimeRange
  onTimeRangeChange: (r: TimeRange) => void
  fullScreen: boolean
  onToggleFullScreen: () => void
  palette: ChartPalette
  loadingMore: boolean
  hasMore: boolean
  onLoadMore?: () => Promise<void>
  timezone?: string
  overlayPairs?: OverlayPair[]
  annotations?: ChartAnnotation[]
}) {
  const isRtl = useIsRtl()
  // Zoom/pan state
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ x: number; domain: [number, number] } | null>(null)
  // Touch zoom/pan state (#301) — single-finger pan, two-finger pinch zoom
  const touchStateRef = useRef<
    | { mode: 'pan'; startX: number; domain: [number, number] }
    | { mode: 'pinch'; startDist: number; domain: [number, number] }
    | null
  >(null)
  // Toggle individual overlay pairs on/off
  const [hiddenPairs, setHiddenPairs] = useState<Set<string>>(new Set())
  const [hiddenCoverageSources, setHiddenCoverageSources] = useState<Set<string>>(new Set())
  const [coverageVisible, setCoverageVisible] = useState(false)
  // Whether to show normalised % change (used when overlays present)
  const [normalised, setNormalised] = useState(false)
  // Whether accessible data table is shown
  const [tableVisible, setTableVisible] = useState(false)
  // Chart export (#299)
  const chartWrapperRef = useRef<HTMLDivElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)

  useEffect(() => {
    if (!exportMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [exportMenuOpen])

  // #302 – Track previous data length to detect incremental real-time appends.
  // Only animate (isAnimationActive) on first render or time-range change;
  // suppress it on incremental appends so the chart doesn't re-animate on every tick.
  const reducedMotion = useReducedMotion()
  const prevDataLengthRef = useRef<number>(0)
  const prevTimeRangeRef = useRef<TimeRange>(timeRange)
  const isRangeChange = prevTimeRangeRef.current !== timeRange
  if (isRangeChange) prevTimeRangeRef.current = timeRange
  const filteredLength = filterByRange(data, timeRange).length
  const isIncremental = !isRangeChange && prevDataLengthRef.current > 0 && filteredLength > prevDataLengthRef.current
  prevDataLengthRef.current = filteredLength
  // Animate only on initial mount or range change, not on real-time appends or when reduced motion is active
  const shouldAnimate = !isIncremental && !reducedMotion

  // #305 – Annotation management state
  const [localAnnotations, setLocalAnnotations] = useState<ChartAnnotation[]>(annotations)
  const [annotationFormOpen, setAnnotationFormOpen] = useState(false)
  const [annotationDraft, setAnnotationDraft] = useState<{ timestamp: number; label: string; note: string }>({
    timestamp: Date.now(),
    label: '',
    note: '',
  })

  // Sync external annotations prop into local state
  useEffect(() => {
    setLocalAnnotations(annotations)
  }, [annotations])

  const tzAbbr = getTimezoneAbbr(timezone)
  const filteredData = filterByRange(data, timeRange)
  const potentialGaps = useMemo(() => findPriceHistoryGaps(filteredData), [filteredData])
  const rollingStatistics = calculateRollingStatistics(filteredData)

  const chartData = filteredData
    .slice()
    .reverse()
    .map((d, i) => {
      const statistic = rollingStatistics[rollingStatistics.length - 1 - i]
      return {
        ...d,
        time: formatChartTimeWithTz(d.timestamp, timezone),
        idx: i,
        rollingMedian: statistic.median,
        rangeLow: statistic.low,
        rangeHigh: statistic.high,
        rangeBandBase: statistic.low,
        rangeBandWidth: statistic.high - statistic.low,
        sampleCount: statistic.sampleCount,
      }
    })

  // Build overlay series (filter by range, normalise if needed)
  const hasOverlays = overlayPairs.length > 0
  const activeOverlays = overlayPairs.filter((op) => !hiddenPairs.has(op.pair))

  // Build a merged dataset for the overlay line chart
  // Each row is keyed by index; primary pair uses 'price', overlays use pair name as key
  const mergedChartData = useMemo(() => {
    if (!hasOverlays) return chartData
    // Normalise primary
    const primaryNorm = normalised ? normaliseToPercent(chartData) : null
    const normaliseStatistic = (value: number) => {
      const basePrice = chartData[0]?.price ?? 0
      return normalised && basePrice !== 0 ? ((value - basePrice) / basePrice) * 100 : value
    }
    const base = chartData.map((d, i) => ({
      ...d,
      [pair]: normalised && primaryNorm ? primaryNorm[i].pct : d.price,
      rollingMedian: normaliseStatistic(d.rollingMedian),
      rangeLow: normaliseStatistic(d.rangeLow),
      rangeHigh: normaliseStatistic(d.rangeHigh),
      rangeBandBase: normaliseStatistic(d.rangeLow),
      rangeBandWidth: normaliseStatistic(d.rangeHigh) - normaliseStatistic(d.rangeLow),
    }))
    // Merge each overlay
    for (const op of overlayPairs) {
      const opFiltered = filterByRange(op.data, timeRange).slice().reverse()
      const opNorm = normalised ? normaliseToPercent(opFiltered) : null
      opFiltered.forEach((pt, i) => {
        if (i < base.length) {
          base[i] = {
            ...base[i],
            [op.pair]: normalised && opNorm ? opNorm[i].pct : pt.price,
          }
        }
      })
    }
    return base
  }, [hasOverlays, chartData, pair, overlayPairs, normalised, timeRange])

  const prices = chartData.map((d) => d.price)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const pad = (maxP - minP) * 0.1 || maxP * 0.05

  const totalPoints = mergedChartData.length
  const activeDomain = useMemo<[number, number]>(() => zoomDomain ?? [0, totalPoints - 1], [zoomDomain, totalPoints])

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

  const handleDoubleClick = useCallback(() => setZoomDomain(null), [])

  // Touch pan/pinch-zoom (#301) — mirrors the mouse wheel/drag behaviour for touch devices
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        touchStateRef.current = {
          mode: 'pan',
          startX: e.touches[0].clientX,
          domain: [...activeDomain] as [number, number],
        }
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        )
        touchStateRef.current = { mode: 'pinch', startDist: dist, domain: [...activeDomain] as [number, number] }
      }
    },
    [activeDomain],
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const state = touchStateRef.current
      if (!state) return

      if (state.mode === 'pan' && e.touches.length === 1) {
        e.preventDefault()
        const dx = e.touches[0].clientX - state.startX
        const [lo, hi] = state.domain
        const span = hi - lo
        const shift = -Math.round((dx / 300) * span)
        const newLo = Math.max(0, Math.min(totalPoints - 1 - span, lo + shift))
        setZoomDomain([newLo, newLo + span])
      } else if (state.mode === 'pinch' && e.touches.length === 2) {
        e.preventDefault()
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        )
        const ratio = state.startDist / (dist || 1)
        const [lo, hi] = state.domain
        const span = hi - lo
        const newSpan = Math.max(2, Math.min(totalPoints - 1, Math.round(span * ratio)))
        const center = (lo + hi) / 2
        const newLo = Math.max(0, Math.round(center - newSpan / 2))
        const newHi = Math.min(totalPoints - 1, newLo + newSpan)
        setZoomDomain([newLo, newHi])
      }
    },
    [totalPoints],
  )

  const handleTouchEnd = useCallback(() => {
    touchStateRef.current = null
  }, [])

  const visibleData = mergedChartData.slice(activeDomain[0], activeDomain[1] + 1)
  const coverageData = useMemo(
    () => buildSourceCoverageData(chartData.slice(activeDomain[0], activeDomain[1] + 1)),
    [chartData, activeDomain],
  )
  const activeCoverageSeries = coverageData.series.filter((item) => !hiddenCoverageSources.has(item.source))

  // Human-readable label for the currently zoomed date range (#301)
  const zoomedRangeLabel =
    zoomDomain && visibleData.length > 0
      ? `${formatTimestamp(visibleData[0].timestamp)} – ${formatTimestamp(visibleData[visibleData.length - 1].timestamp)}`
      : null

  const handleExport = useCallback(
    async (format: 'png' | 'svg' | 'pdf') => {
      const container = chartWrapperRef.current
      if (!container) return
      setExportMenuOpen(false)
      setExporting(true)
      try {
        const { exportChartAsPng, exportChartAsSvg } = await loadChartExport()
        const bgColor = palette.background
        const safePair = pair.replace(/\//g, '-')
        const filename = `${safePair}_${timeRange}.${format}`
        if (format === 'svg') {
          exportChartAsSvg(container, filename, bgColor)
        } else if (format === 'pdf') {
          const chart = await rasterizeChartToDataUrl(container, bgColor)
          exportPriceHistoryPdf({ pair, history: data, chart, filename, palette })
        } else {
          await exportChartAsPng(container, filename, bgColor)
        }
      } finally {
        setExporting(false)
      }
    },
    [palette, pair, timeRange, data],
  )

  // Check if user scrolled near the start to trigger load more
  useEffect(() => {
    if (!hasMore || !onLoadMore || loadingMore) return

    const [lo] = activeDomain
    // If user zoomed/panned to show first 25% of data, load more
    if (lo < Math.max(5, totalPoints * 0.25)) {
      onLoadMore()
    }
  }, [activeDomain, hasMore, onLoadMore, loadingMore, totalPoints])

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
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{pair} Price History</h3>
          {loadingMore && (
            <div className="flex items-center gap-1 text-xs text-blue-500">
              <div className="animate-spin w-3 h-3 border border-blue-500 border-t-transparent rounded-full" />
              Loading more...
            </div>
          )}
          <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded font-mono" title="Chart timezone">
            {tzAbbr}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {rangeBar}
          <button
            type="button"
            onClick={() => setCoverageVisible((visible) => !visible)}
            className={`px-2 py-1 text-xs rounded-lg border transition-colors ${
              coverageVisible
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                : 'text-gray-400 border-gray-700 hover:text-gray-200 hover:bg-gray-700'
            }`}
            aria-pressed={coverageVisible}
            aria-label="Toggle per-source coverage overlay"
          >
            Coverage
          </button>
          {hasOverlays && (
            <button
              type="button"
              onClick={() => setNormalised((n) => !n)}
              className={`px-2 py-1 text-xs rounded-lg border transition-colors ${
                normalised
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                  : 'text-gray-400 border-gray-700 hover:text-gray-200 hover:bg-gray-700'
              }`}
              aria-pressed={normalised}
              aria-label="Toggle % change normalisation"
            >
              % Change
            </button>
          )}
          <button
            type="button"
            onClick={() => setTableVisible((v) => !v)}
            className={`px-2 py-1 text-xs rounded-lg border transition-colors ${
              tableVisible
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                : 'text-gray-400 border-gray-700 hover:text-gray-200 hover:bg-gray-700'
            }`}
            aria-pressed={tableVisible}
            aria-label={tableVisible ? 'Hide data table' : 'Show data table'}
          >
            Table
          </button>
          {zoomedRangeLabel && (
            <span className="text-xs text-cyan-400 font-mono" aria-live="polite">
              {zoomedRangeLabel}
            </span>
          )}
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
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setExportMenuOpen((o) => !o)}
              disabled={exporting}
              className="px-2 py-1 text-xs rounded-lg border text-gray-400 border-gray-700 hover:text-gray-200 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              aria-haspopup="true"
              aria-expanded={exportMenuOpen}
              aria-label="Export chart"
            >
              {exporting ? (
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              )}
              Export
            </button>
            {exportMenuOpen && (
              <div
                className="absolute end-0 mt-1 w-32 bg-gray-800 border border-gray-700 rounded-xl shadow-lg z-10 overflow-hidden"
                role="menu"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleExport('png')}
                  className="w-full text-start px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  Export as PNG
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleExport('svg')}
                  className="w-full text-start px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  Export as SVG
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleExport('pdf')}
                  className="w-full text-start px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  Export as PDF
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setReportModalOpen(true)}
            className="px-2 py-1 text-xs rounded-lg border text-amber-400 border-amber-600/40 hover:text-amber-200 hover:bg-amber-600/20 transition-colors flex items-center gap-1"
            aria-haspopup="dialog"
            aria-label={`Report data-quality concern for ${pair}`}
          >
            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Report Concern
          </button>
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Overlay legend */}
      {hasOverlays && (
        <div className="flex flex-wrap items-center gap-3 mb-2" role="group" aria-label="Overlay pairs legend">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="inline-block w-5 border-t-2" style={{ borderColor: palette.series[0].color }} />
            <span style={{ color: palette.series[0].color }}>{pair}</span>
          </div>
          {overlayPairs.map((op, i) => {
            const series = palette.series[(i + 1) % palette.series.length]
            const color = series.color
            const hidden = hiddenPairs.has(op.pair)
            return (
              <button
                key={op.pair}
                type="button"
                onClick={() =>
                  setHiddenPairs((prev) => {
                    const next = new Set(prev)
                    if (next.has(op.pair)) next.delete(op.pair)
                    else next.add(op.pair)
                    return next
                  })
                }
                className={`flex items-center gap-1.5 text-xs transition-opacity ${hidden ? 'opacity-40' : ''}`}
                aria-pressed={!hidden}
                aria-label={`Toggle ${op.pair} overlay`}
                style={{ color }}
              >
                <span
                  className="inline-block w-5 border-t-2"
                  style={{ borderColor: color, borderTopStyle: series.dash === '0' ? 'solid' : 'dashed' }}
                />
                {op.pair}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-2 text-xs" role="group" aria-label="Rolling statistics">
        <span className="inline-flex items-center gap-1.5 text-violet-300">
          <span className="inline-block w-5 border-t-2 border-dashed border-violet-400" aria-hidden="true" />
          Rolling median (20 observations)
        </span>
        <span className="inline-flex items-center gap-1.5 text-gray-400">
          <span
            className="inline-block w-5 h-2 rounded bg-violet-400/20 border border-violet-400/40"
            aria-hidden="true"
          />
          Range band (rolling low–high)
        </span>
        <span className="text-gray-500">
          Based on {filteredData.length} loaded observations
          {hasMore ? '; older history may be available by scrolling.' : '.'}
        </span>
      </div>

      <div
        ref={chartWrapperRef}
        className={`flex-1 min-h-0 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="img"
        aria-label={`${pair} price chart with ${chartData.length} data points`}
      >
        {hasOverlays ? (
          <ResponsiveContainer width="100%" height="100%">
            {/* #302 – isAnimationActive suppressed on incremental real-time appends */}
            <LineChart data={visibleData}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
              <XAxis
                dataKey="time"
                tick={{ fill: palette.muted, fontSize: 11 }}
                axisLine={{ stroke: palette.border }}
                tickLine={false}
                interval="preserveStartEnd"
                label={{
                  value: tzAbbr,
                  position: isRtl ? 'insideBottomLeft' : 'insideBottomRight',
                  offset: -5,
                  fill: palette.muted,
                  fontSize: 10,
                }}
              />
              <YAxis
                tick={{ fill: palette.muted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => (normalised ? `${v.toFixed(1)}%` : formatPriceShort(v))}
                width={80}
              />
              {/* #300 – Custom tooltip with sources, confidence, oracle count, % change */}
              <Tooltip
                content={
                  <CustomTooltip
                    tzAbbr={tzAbbr}
                    allData={visibleData as ChartPoint[]}
                    palette={palette}
                    normalised={normalised}
                  />
                }
              />
              {potentialGaps.map((gap) => (
                <ReferenceArea
                  key={`${gap.startTimestamp}-${gap.endTimestamp}`}
                  x1={formatChartTimeWithTz(gap.startTimestamp, timezone)}
                  x2={formatChartTimeWithTz(gap.endTimestamp, timezone)}
                  fill="#f59e0b"
                  fillOpacity={0.12}
                  stroke="#f59e0b"
                  strokeDasharray="4 2"
                />
              ))}
              {/* #305 – Annotations as vertical reference lines */}
              {localAnnotations.map((ann) => {
                const annTime = formatChartTimeWithTz(ann.timestamp, timezone)
                return (
                  <ReferenceLine
                    key={ann.id}
                    x={annTime}
                    stroke={ann.color ?? '#f59e0b'}
                    strokeDasharray="4 2"
                    label={{
                      value: ann.label,
                      position: 'top',
                      fill: ann.color ?? '#f59e0b',
                      fontSize: 10,
                    }}
                  />
                )
              })}
              <Line
                type="monotone"
                dataKey={pair}
                stroke={palette.series[0].color}
                strokeDasharray={palette.series[0].dash}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={shouldAnimate}
                animationDuration={400}
                animationEasing="ease-out"
              />
              {activeOverlays.map((op, i) => (
                <Line
                  key={op.pair}
                  type="monotone"
                  dataKey={op.pair}
                  stroke={palette.series[(i + 1) % palette.series.length].color}
                  strokeDasharray={palette.series[(i + 1) % palette.series.length].dash}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3 }}
                  isAnimationActive={shouldAnimate}
                  animationDuration={400}
                  animationEasing="ease-out"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {/* #302 – isAnimationActive suppressed on incremental real-time appends */}
            <AreaChart data={visibleData}>
              <defs>
                <linearGradient id={`priceGradient${fullScreen ? 'Fs' : ''}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={palette.series[0].color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={palette.series[0].color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
              <XAxis
                dataKey="time"
                tick={{ fill: palette.muted, fontSize: 11 }}
                axisLine={{ stroke: palette.border }}
                tickLine={false}
                interval="preserveStartEnd"
                label={{
                  value: tzAbbr,
                  position: isRtl ? 'insideBottomLeft' : 'insideBottomRight',
                  offset: -5,
                  fill: palette.muted,
                  fontSize: 10,
                }}
              />
              <YAxis
                orientation={isRtl ? 'right' : 'left'}
                domain={[minP - pad, maxP + pad]}
                tick={{ fill: palette.muted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => formatPriceShort(v)}
                width={80}
              />
              {/* #300 – Custom tooltip with sources, confidence, oracle count, % change */}
              <Tooltip
                content={<CustomTooltip tzAbbr={tzAbbr} allData={visibleData as ChartPoint[]} palette={palette} normalised={false} />}
              />
              {potentialGaps.map((gap) => (
                <ReferenceArea
                  key={`${gap.startTimestamp}-${gap.endTimestamp}`}
                  x1={formatChartTimeWithTz(gap.startTimestamp, timezone)}
                  x2={formatChartTimeWithTz(gap.endTimestamp, timezone)}
                  fill="#f59e0b"
                  fillOpacity={0.12}
                  stroke="#f59e0b"
                  strokeDasharray="4 2"
                />
              ))}
              {/* #305 – Annotations as vertical reference lines */}
              {localAnnotations.map((ann) => {
                const annTime = formatChartTimeWithTz(ann.timestamp, timezone)
                return (
                  <ReferenceLine
                    key={ann.id}
                    x={annTime}
                    stroke={ann.color ?? '#f59e0b'}
                    strokeDasharray="4 2"
                    label={{
                      value: ann.label,
                      position: 'top',
                      fill: ann.color ?? '#f59e0b',
                      fontSize: 10,
                    }}
                  />
                )
              })}
              <Area
                type="monotone"
                dataKey="price"
                stroke={palette.series[0].color}
                strokeDasharray={palette.series[0].dash}
                strokeWidth={2}
                fill={`url(#priceGradient${fullScreen ? 'Fs' : ''})`}
                dot={false}
                activeDot={{ r: 4, fill: palette.series[0].color }}
                isAnimationActive={shouldAnimate}
                animationDuration={400}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      {coverageVisible && (
        <section
          className="mt-3 rounded-lg border p-3"
          style={{ backgroundColor: palette.background, borderColor: palette.border }}
          aria-label="Per-source observed history coverage"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2" role="group" aria-label="Toggle covered sources">
            {coverageData.series.map((item) => {
              const seriesIndex = coverageData.series.indexOf(item)
              const series = palette.series[seriesIndex % palette.series.length]
              const hidden = hiddenCoverageSources.has(item.source)
              return (
                <button
                  key={item.source}
                  type="button"
                  onClick={() =>
                    setHiddenCoverageSources((previous) => {
                      const next = new Set(previous)
                      if (next.has(item.source)) next.delete(item.source)
                      else next.add(item.source)
                      return next
                    })
                  }
                  className={`rounded border px-2 py-1 text-xs ${hidden ? 'opacity-50' : ''}`}
                  style={{ color: series.color, borderColor: series.color }}
                  aria-pressed={!hidden}
                  aria-label={`Toggle ${item.source} coverage`}
                >
                  {item.source}: {item.percent.toFixed(1)}%
                </button>
              )
            })}
          </div>
          {coverageData.series.length === 0 ? (
            <p className="py-5 text-center text-sm" style={{ color: palette.muted }} role="status">
              Per-source coverage is unavailable because the returned history contains no contributing-source data.
            </p>
          ) : (
            <>
              <div
                className="h-32 w-full"
                role="img"
                aria-label={`Per-source observed coverage across ${coverageData.points.length} historical price points`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={coverageData.points}>
                    <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(timestamp: number) => formatChartTimeWithTz(timestamp, timezone)}
                      tick={{ fill: palette.muted, fontSize: 10 }}
                      axisLine={{ stroke: palette.border }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 50, 100]}
                      tickFormatter={(value: number) => `${value}%`}
                      tick={{ fill: palette.muted, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip
                      labelFormatter={(timestamp) => formatChartTimeWithTz(Number(timestamp), timezone)}
                      formatter={(value, name) => {
                        const item = coverageData.series.find((series) => series.dataKey === name)
                        return [`${Number(value).toFixed(0)}%`, item?.source ?? String(name)]
                      }}
                      contentStyle={{
                        backgroundColor: palette.tooltipBackground,
                        borderColor: palette.border,
                        color: palette.tooltipForeground,
                      }}
                      labelStyle={{ color: palette.tooltipMuted }}
                      itemStyle={{ color: palette.tooltipForeground }}
                    />
                    {activeCoverageSeries.map((item) => {
                      const seriesIndex = coverageData.series.indexOf(item)
                      const series = palette.series[seriesIndex % palette.series.length]
                      return (
                        <Line
                          key={item.source}
                          type="stepAfter"
                          dataKey={item.dataKey}
                          name={item.source}
                          stroke={series.color}
                          strokeDasharray={series.dash}
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                      )
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs" style={{ color: palette.muted }}>
                Coverage is the share of returned price points that report each source as a contributor; it does not
                represent upstream uptime.
              </p>
              <div className="sr-only">
                <table aria-label="Per-source price history coverage data">
                  <caption>Coverage by returned historical price point</caption>
                  <thead>
                    <tr>
                      <th scope="col">Timestamp</th>
                      {coverageData.series.map((item) => (
                        <th scope="col" key={item.source}>{item.source} coverage</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {coverageData.points.slice(0, 100).map((point, index) => (
                      <tr key={`${point.timestamp}-${index}`}>
                        <td>{formatTimestamp(point.timestamp)}</td>
                        {coverageData.series.map((item) => (
                          <td key={item.source}>{point[item.dataKey] === 100 ? 'Contributed' : 'Not reported'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
      {/* #305 – Annotation controls */}
      <div className="flex items-center gap-2 mt-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => setAnnotationFormOpen((v) => !v)}
          className={`px-2 py-1 text-xs rounded-lg border transition-colors ${
            annotationFormOpen
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              : 'text-gray-400 border-gray-700 hover:text-gray-200 hover:bg-gray-700'
          }`}
          aria-expanded={annotationFormOpen}
          aria-label="Toggle annotation form"
        >
          + Annotate
        </button>
        {localAnnotations.length > 0 && (
          <span className="text-xs text-gray-500">
            {localAnnotations.length} annotation{localAnnotations.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {annotationFormOpen && (
        <div className="mt-2 p-3 rounded-lg border border-gray-700 bg-gray-900/50 flex flex-col gap-2 flex-shrink-0">
          <p className="text-xs text-gray-400 font-medium">Add Chart Annotation</p>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Label (e.g. Fed announcement)"
              value={annotationDraft.label}
              onChange={(e) => setAnnotationDraft((d) => ({ ...d, label: e.target.value }))}
              className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              aria-label="Annotation label"
            />
            <input
              type="text"
              placeholder="Note (optional)"
              value={annotationDraft.note}
              onChange={(e) => setAnnotationDraft((d) => ({ ...d, note: e.target.value }))}
              className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              aria-label="Annotation note"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400" htmlFor="ann-timestamp">
              Time (ms)
            </label>
            <input
              id="ann-timestamp"
              type="number"
              value={annotationDraft.timestamp}
              onChange={(e) => setAnnotationDraft((d) => ({ ...d, timestamp: Number(e.target.value) }))}
              className="w-36 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              aria-label="Annotation timestamp"
            />
            <button
              type="button"
              onClick={() => setAnnotationDraft((d) => ({ ...d, timestamp: Date.now() }))}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Now
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!annotationDraft.label.trim()}
              onClick={() => {
                const ann: ChartAnnotation = {
                  id: crypto.randomUUID(),
                  timestamp: annotationDraft.timestamp,
                  label: annotationDraft.label.trim(),
                  note: annotationDraft.note.trim() || undefined,
                  color: '#f59e0b',
                }
                setLocalAnnotations((prev) => [...prev, ann])
                setAnnotationDraft({ timestamp: Date.now(), label: '', note: '' })
                setAnnotationFormOpen(false)
              }}
              className="px-3 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setAnnotationFormOpen(false)}
              className="px-3 py-1 text-xs text-gray-400 rounded hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {localAnnotations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 flex-shrink-0">
          {localAnnotations.map((ann) => (
            <span
              key={ann.id}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border"
              style={{ borderColor: ann.color ?? '#f59e0b', color: ann.color ?? '#f59e0b' }}
              title={ann.note}
              role={ann.kind === 'quality' ? 'note' : undefined}
              aria-label={ann.kind === 'quality' ? `${ann.label}: ${ann.note ?? ''}` : undefined}
            >
              {ann.label}
              {ann.kind !== 'quality' && (
                <button
                  type="button"
                  onClick={() => setLocalAnnotations((prev) => prev.filter((a) => a.id !== ann.id))}
                  className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
                  aria-label={`Remove annotation ${ann.label}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-2 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
        <div>
          {chartData.length > 0 && `${chartData.length} price points`}
          {hasMore && ' • More data available'}
        </div>
        {fullScreen && (
          <p className="text-gray-600 dark:text-gray-600">
            Scroll or pinch to zoom · Drag to pan · Double-click to reset · Press Esc to close
          </p>
        )}
      </div>

      {/* #304 Accessible data table fallback */}
      {tableVisible && (
        <div className="mt-4 overflow-x-auto max-h-60 overflow-y-auto rounded-lg border border-gray-700">
          <table className="w-full text-xs text-gray-300" aria-label={`${pair} price history data table (${tzAbbr})`}>
            <thead className="bg-gray-800 sticky top-0">
              <tr>
                <th scope="col" className="px-3 py-2 text-start font-medium text-gray-400">
                  Time ({tzAbbr})
                </th>
                <th scope="col" className="px-3 py-2 text-end font-medium text-gray-400">
                  Price (USD)
                </th>
                <th scope="col" className="px-3 py-2 text-end font-medium text-gray-400">
                  Confidence
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium text-gray-400">
                  Rolling median
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium text-gray-400">
                  Range low–high
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium text-gray-400">
                  Source timestamps
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleData.map((d, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-850'}>
                  <td className="px-3 py-1.5 font-mono">{d.time}</td>
                  <td className="px-3 py-1.5 text-right font-mono">${formatPriceShort(d.price)}</td>
                  <td className="px-3 py-1.5 text-right">{(d.confidence * 100).toFixed(1)}%</td>
                  <td className="px-3 py-1.5 text-right font-mono">${formatPriceShort(d.rollingMedian)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">
                    ${formatPriceShort(d.rangeLow)} – ${formatPriceShort(d.rangeHigh)}
                  </td>
                  <td className="px-3 py-1.5">{sourceTimestampSummary(d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* sr-only table always present for screen readers */}
      <div className="sr-only" aria-live="polite">
        <table aria-label={`${pair} price history accessible data`}>
          <caption>
            {pair} price data — {chartData.length} points ({tzAbbr})
          </caption>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Price USD</th>
              <th scope="col">Confidence</th>
              <th scope="col">Contributing source timestamps</th>
            </tr>
          </thead>
          <tbody>
            {chartData.slice(0, 50).map((d, i) => (
              <tr key={i}>
                <td>{d.time}</td>
                <td>{formatPriceShort(d.price)}</td>
                <td>{(d.confidence * 100).toFixed(1)}%</td>
                <td>{sourceTimestampSummary(d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DataQualityReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        pair={pair}
        selectedTimestamp={data[data.length - 1]?.timestamp}
        selectedPrice={data[data.length - 1]?.price}
        availableSources={data[data.length - 1]?.sources}
      />
    </div>
  )
}

export const PriceChart = memo(function PriceChart({
  data,
  pair,
  loading,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
  timeRange: externalRange,
  onTimeRangeChange: externalOnChange,
  timezone = 'UTC',
  overlayPairs = [],
  annotations = [],
}: PriceChartProps) {
  const [theme, setTheme] = useState<ChartTheme>(() => getChartTheme())
  const [fullScreen, setFullScreen] = useState(false)
  const [internalRange, setInternalRange] = useState<TimeRange>('24h')
  const palette = useMemo(() => getChartPalette(theme), [theme])

  const timeRange = externalRange ?? internalRange
  const onTimeRangeChange = externalOnChange ?? setInternalRange

  useEffect(() => {
    const updateTheme = () => setTheme(getChartTheme())
    const observer = new MutationObserver(() => {
      updateTheme()
    })
    observer.observe(document.documentElement, { attributeFilter: ['class'] })
    const mediaQueries = [
      window.matchMedia('(forced-colors: active)'),
      window.matchMedia('(prefers-contrast: more)'),
    ]
    for (const mediaQuery of mediaQueries) mediaQuery.addEventListener('change', updateTheme)
    return () => {
      observer.disconnect()
      for (const mediaQuery of mediaQueries) mediaQuery.removeEventListener('change', updateTheme)
    }
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
    <div
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 h-80"
      style={{ backgroundColor: palette.background, borderColor: palette.border }}
    >
      <ChartContent
        data={data}
        pair={pair}
        timeRange={timeRange}
        onTimeRangeChange={onTimeRangeChange}
        fullScreen={false}
        onToggleFullScreen={() => setFullScreen(true)}
        palette={palette}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadMore={onLoadMore}
        timezone={timezone}
        overlayPairs={overlayPairs}
        annotations={annotations}
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
          <div
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 w-full max-w-6xl h-[80vh] flex flex-col"
            style={{ backgroundColor: palette.background, borderColor: palette.border }}
          >
            <ChartContent
              data={data}
              pair={pair}
              timeRange={timeRange}
              onTimeRangeChange={onTimeRangeChange}
              fullScreen={true}
              onToggleFullScreen={() => setFullScreen(false)}
              palette={palette}
              loadingMore={loadingMore}
              hasMore={hasMore}
              onLoadMore={onLoadMore}
              timezone={timezone}
              overlayPairs={overlayPairs}
              annotations={annotations}
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
