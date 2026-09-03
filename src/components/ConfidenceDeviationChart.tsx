/**
 * #462 – Historical confidence and deviation charts for PriceDetail.
 *
 * Renders two secondary tabs:
 *  1. **Confidence** – confidence score over time as an area series
 *  2. **Deviation** – std-dev of per-source prices at each tick (when source prices
 *     can be inferred from excluded-source metadata)
 *
 * Both share the same date range (passed in from PriceDetail) and both support
 * PNG / SVG export via the ChartEngine canvas.
 */

import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { CanvasChart } from '../chart/CanvasChart'
import { createAreaPlugin, createLinePlugin } from '../chart/ChartEngine'
import type { ChartSeries } from '../chart/ChartEngine'
import type { PriceHistoryEntry } from '../types/price'
import { downloadFile } from '../utils/export'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ChartTab = 'confidence' | 'deviation'

const AREA_PLUGINS = [createAreaPlugin()]
const LINE_PLUGINS = [createLinePlugin()]

function formatPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`
}

function formatDeviation(v: number): string {
  return `±${v.toFixed(4)}`
}

/**
 * Computes the standard deviation of source-reported prices at each tick from
 * the `excludedSources` metadata + the accepted price as a proxy for the
 * median. When no metadata is present the series is empty.
 */
function buildDeviationSeries(history: PriceHistoryEntry[]): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = []
  for (const entry of history) {
    if (!entry.excludedSources || entry.excludedSources.length === 0) continue
    const prices = [entry.price, ...entry.excludedSources.map((e) => e.reportedPrice)]
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length
    const variance = prices.reduce((s, p) => s + (p - avg) ** 2, 0) / prices.length
    pts.push({ x: entry.timestamp, y: Math.sqrt(variance) })
  }
  return pts
}

// ---------------------------------------------------------------------------
// Export helpers (canvas-based)
// ---------------------------------------------------------------------------

async function exportCanvas(canvas: HTMLCanvasElement, filename: string, format: 'png' | 'svg'): Promise<void> {
  if (format === 'png') {
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  } else {
    // SVG export: encode a <img> of the canvas as a data-url inside a minimal SVG
    const dataUrl = canvas.toDataURL('image/png')
    const w = canvas.width
    const h = canvas.height
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><image href="${dataUrl}" width="${w}" height="${h}"/></svg>`
    downloadFile(svg, filename, 'image/svg+xml')
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ConfidenceDeviationChartProps {
  history: PriceHistoryEntry[]
  pair: string
  /** Optional parent-controlled time range in ms (0 means show all). */
  rangeMs?: number
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ConfidenceDeviationChart = memo(function ConfidenceDeviationChart({
  history,
  pair,
  rangeMs = 0,
}: ConfidenceDeviationChartProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>('confidence')
  const [exporting, setExporting] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Apply time-range filter
  const filtered = useMemo<PriceHistoryEntry[]>(() => {
    if (rangeMs <= 0 || history.length === 0) return history
    const cutoff = Date.now() - rangeMs
    const out = history.filter((e) => e.timestamp >= cutoff)
    return out.length > 0 ? out : history
  }, [history, rangeMs])

  // Build confidence series
  const confidenceSeries = useMemo<ChartSeries[]>(
    () => [
      {
        id: 'confidence',
        label: 'Confidence',
        color: '#22d3ee',
        style: 'area',
        points: filtered.map((e) => ({ x: e.timestamp, y: e.confidence })),
      },
    ],
    [filtered],
  )

  // Build deviation series
  const deviationPoints = useMemo(() => buildDeviationSeries(filtered), [filtered])
  const deviationSeries = useMemo<ChartSeries[]>(
    () => [
      {
        id: 'deviation',
        label: 'Source deviation',
        color: '#a78bfa',
        style: 'line',
        points: deviationPoints,
      },
    ],
    [deviationPoints],
  )

  const activeSeries = activeTab === 'confidence' ? confidenceSeries : deviationSeries
  const activePlugins = activeTab === 'confidence' ? AREA_PLUGINS : LINE_PLUGINS
  const activeFormatY = activeTab === 'confidence' ? formatPct : formatDeviation
  const hasData = activeTab === 'confidence' ? filtered.length > 0 : deviationPoints.length > 0

  const handleExport = useCallback(
    async (format: 'png' | 'svg') => {
      const container = containerRef.current
      if (!container) return
      const canvas = container.querySelector('canvas')
      if (!canvas) return
      setExporting(true)
      try {
        const safePair = pair.replace(/\//g, '-')
        const filename = `${safePair}_${activeTab}.${format}`
        await exportCanvas(canvas, filename, format)
      } finally {
        setExporting(false)
      }
    },
    [pair, activeTab],
  )

  return (
    <div>
      {/* Tab strip */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1" role="tablist" aria-label="Chart type">
          {(['confidence', 'deviation'] as ChartTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                activeTab === tab
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700 border border-transparent'
              }`}
            >
              {tab === 'confidence' ? 'Confidence' : 'Deviation'}
            </button>
          ))}
        </div>

        {/* Export buttons */}
        <div className="flex gap-1">
          <button
            type="button"
            disabled={exporting || !hasData}
            onClick={() => handleExport('png')}
            className="px-2 py-1 text-xs rounded border text-gray-400 border-gray-700 hover:text-gray-200 hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Export as PNG"
          >
            PNG
          </button>
          <button
            type="button"
            disabled={exporting || !hasData}
            onClick={() => handleExport('svg')}
            className="px-2 py-1 text-xs rounded border text-gray-400 border-gray-700 hover:text-gray-200 hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Export as SVG"
          >
            SVG
          </button>
        </div>
      </div>

      {/* Chart area */}
      <div ref={containerRef}>
        {!hasData ? (
          <div
            className="flex items-center justify-center h-40 rounded-lg border border-dashed border-gray-700 text-sm text-gray-500"
            role="status"
            aria-label={`No ${activeTab} data available`}
          >
            {activeTab === 'deviation'
              ? 'Deviation data requires per-source exclusion metadata from the API'
              : 'No history data available'}
          </div>
        ) : (
          <CanvasChart
            series={activeSeries}
            plugins={activePlugins}
            className="w-full h-48"
            formatX={(x) => {
              const d = new Date(x)
              return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            }}
            formatY={activeFormatY}
          />
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-gray-600 mt-2">
        {activeTab === 'confidence'
          ? 'Confidence score (0–100%) over time. A sustained decline signals feed health degradation.'
          : 'Standard deviation of per-source reported prices at each tick. Higher values indicate less oracle agreement.'}
      </p>
    </div>
  )
})
