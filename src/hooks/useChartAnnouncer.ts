import { useEffect, useMemo, useRef } from 'react'
import { formatPrice } from '../utils/format'
import { useAnnounce } from './useAnnounce'

/**
 * Configuration for chart announcement behavior
 */
export interface ChartAnnouncerConfig {
  /**
   * Deduplication window for chart announcements in milliseconds
   * @default 5000 (5 seconds)
   */
  deduplicationMs: number

  /**
   * Only announce if price range changed by at least this percentage
   * @default 1 (1% change in range)
   */
  minRangeChangePercent: number

  /**
   * Whether to announce high and low values separately or combined
   * @default false (combined announcement)
   */
  separateHighLow: boolean
}

const DEFAULT_CONFIG: ChartAnnouncerConfig = {
  deduplicationMs: 5000,
  minRangeChangePercent: 1,
  separateHighLow: false,
}

/**
 * Information about price range for announcement
 */
interface PriceRange {
  high: number
  low: number
  current: number
  openPrice?: number
  closePrice?: number
}

/**
 * Hook for announcing chart/price range data updates to screen readers.
 *
 * Useful for reading data tables that accompany charts, helping visually
 * impaired users understand the data being visualized.
 *
 * @example Announce chart data on load
 * ```tsx
 * function PriceChart() {
 *   const history = usePriceHistory(pair)
 *   useChartAnnouncer(history?.current)
 *   return <Chart data={history} />
 * }
 * ```
 *
 * @example With custom thresholds
 * ```tsx
 * useChartAnnouncer(history, {
 *   minRangeChangePercent: 5,  // Only announce if range changed 5%+
 *   deduplicationMs: 10000,
 * })
 * ```
 */
export function useChartAnnouncer(
  priceRange: PriceRange | undefined,
  config: Partial<ChartAnnouncerConfig> = {},
): void {
  const { announce } = useAnnounce({
    deduplicationMs: (config.deduplicationMs ?? DEFAULT_CONFIG.deduplicationMs) * 2,
  })

  const prevRangeRef = useRef<PriceRange | undefined>()
  const lastAnnouncedRef = useRef<number>(0)

  const mergedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config])

  useEffect(() => {
    if (!priceRange) return

    const now = Date.now()

    // Check deduplication
    if (now - lastAnnouncedRef.current < mergedConfig.deduplicationMs) {
      return
    }

    if (!prevRangeRef.current) {
      // Initial announcement of chart data
      const announcement = buildChartAnnouncement(priceRange, mergedConfig)
      if (announcement) {
        announce(announcement, 'polite')
        lastAnnouncedRef.current = now
      }
      prevRangeRef.current = priceRange
      return
    }

    // Check if range changed significantly
    const prevRange = prevRangeRef.current
    const rangeChange = calculateRangeChange(prevRange, priceRange)

    if (rangeChange >= mergedConfig.minRangeChangePercent) {
      const announcement = buildChartAnnouncement(priceRange, mergedConfig)
      if (announcement) {
        announce(announcement, 'polite')
        lastAnnouncedRef.current = now
      }
    }

    prevRangeRef.current = priceRange
  }, [priceRange, mergedConfig, announce])
}

/**
 * Calculate the percentage change in price range
 */
function calculateRangeChange(prev: PriceRange, current: PriceRange): number {
  const prevRange = prev.high - prev.low
  const currRange = current.high - current.low

  if (prevRange === 0) return 0

  return Math.abs((currRange - prevRange) / prevRange) * 100
}

/**
 * Build a readable announcement of chart data
 */
function buildChartAnnouncement(range: PriceRange, config: ChartAnnouncerConfig): string {
  const parts: string[] = []

  // Current price
  parts.push(`Current price: ${formatPrice(range.current)}`)

  // High and low
  if (config.separateHighLow) {
    parts.push(`High: ${formatPrice(range.high)}, Low: ${formatPrice(range.low)}`)
  } else {
    parts.push(`Range: ${formatPrice(range.low)} to ${formatPrice(range.high)}`)
  }

  // Open and close (for candle charts)
  if (range.openPrice !== undefined && range.closePrice !== undefined) {
    const direction = range.closePrice >= range.openPrice ? 'up' : 'down'
    const change = Math.abs(
      ((range.closePrice - range.openPrice) / range.openPrice) * 100,
    )
    parts.push(
      `Closed ${direction} ${change.toFixed(2)}% from open of ${formatPrice(range.openPrice)}`,
    )
  }

  return parts.join('. ')
}

/**
 * Hook for announcing data table updates accompanying a chart.
 * Announces when new rows are added, removed, or the data changes significantly.
 *
 * @example
 * ```tsx
 * function PriceHistoryTable() {
 *   const data = usePriceHistory(pair)
 *   useChartDataTableAnnouncer(data)
 *   return <Table data={data} />
 * }
 * ```
 */
export function useChartDataTableAnnouncer(
  data: Array<{ price: number; timestamp: number }> | undefined,
  config: Partial<ChartAnnouncerConfig> = {},
): void {
  const { announce } = useAnnounce(config)
  const prevCountRef = useRef(0)
  const lastAnnouncedRef = useRef<number>(0)

  const mergedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config])

  useEffect(() => {
    if (!data || data.length === 0) return

    const now = Date.now()

    // Check deduplication
    if (now - lastAnnouncedRef.current < mergedConfig.deduplicationMs) {
      return
    }

    const count = data.length
    const prevCount = prevCountRef.current

    if (prevCount === 0 && count > 0) {
      // Initial data load
      announce(
        `Chart data table loaded with ${count} data point${count !== 1 ? 's' : ''}`,
        'polite',
      )
      lastAnnouncedRef.current = now
    } else if (count > prevCount) {
      // Data added
      const added = count - prevCount
      announce(
        `${added} new data point${added !== 1 ? 's' : ''} added to chart`,
        'polite',
      )
      lastAnnouncedRef.current = now
    } else if (count < prevCount) {
      // Data removed (filtering, time range change)
      const removed = prevCount - count
      announce(
        `${removed} data point${removed !== 1 ? 's' : ''} removed from chart`,
        'polite',
      )
      lastAnnouncedRef.current = now
    }

    prevCountRef.current = count
  }, [data, mergedConfig, announce])
}

/**
 * Hook for announcing chart summary statistics
 * (e.g., "BTC/USD: High $75,000, Low $70,000, Average $72,500")
 *
 * @example
 * ```tsx
 * function ChartStats() {
 *   const stats = calculateChartStats(historyData)
 *   useChartStatisticsAnnouncer(stats)
 *   return <Stats data={stats} />
 * }
 * ```
 */
export interface ChartStatistics {
  pair: string
  high: number
  low: number
  average?: number
  median?: number
  volume?: number
  periodLabel?: string // e.g., "24 hour", "7 day", "1 month"
}

export function useChartStatisticsAnnouncer(
  stats: ChartStatistics | undefined,
  config: Partial<ChartAnnouncerConfig> = {},
): void {
  const { announce } = useAnnounce({
    deduplicationMs: 10000, // Longer dedup for stats
    ...config,
  })

  const prevStatsRef = useRef<ChartStatistics | undefined>()

  useEffect(() => {
    if (!stats) return

    const prev = prevStatsRef.current

    // Only announce if stats changed significantly
    if (prev && prev.high === stats.high && prev.low === stats.low) {
      prevStatsRef.current = stats
      return
    }

    const parts = [`${stats.pair} chart summary`]
    if (stats.periodLabel) {
      parts[0] += ` for ${stats.periodLabel}`
    }
    parts.push(`:`)
    parts.push(`High ${formatPrice(stats.high)}`)
    parts.push(`Low ${formatPrice(stats.low)}`)

    if (stats.average) {
      parts.push(`Average ${formatPrice(stats.average)}`)
    }
    if (stats.median) {
      parts.push(`Median ${formatPrice(stats.median)}`)
    }

    announce(parts.join(', '), 'polite')
    prevStatsRef.current = stats
  }, [stats, announce])
}
