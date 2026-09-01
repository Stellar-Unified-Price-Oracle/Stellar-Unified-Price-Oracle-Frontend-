/**
 * @file BacktestTool.tsx
 *
 * Backtesting tool component for testing aggregation parameters against
 * historical price feed data (#464).
 */
import { memo, useState, useMemo, useCallback, type ReactElement } from 'react'
import type { PriceHistoryEntry } from '../types'
import {
  runBacktest,
  exportBacktestCsv,
  exportBacktestJson,
  type AggregationMode,
  type BacktestConfig,
  type BacktestPreset,
  type BacktestResult,
} from '../utils/backtest'
import { usePreferences } from '../preferences/PreferencesContext'
import { DEFAULT_BACKTEST_PRESETS } from '../preferences/constants'
import { formatPrice } from '../utils/format'

export interface BacktestToolProps {
  /** The asset pair being analyzed (e.g. "XLM/USD"). */
  pair: string
  /** Historical price entries for the feed. */
  history: PriceHistoryEntry[]
}

const AGGREGATION_MODES: { value: AggregationMode; label: string; description: string }[] = [
  { value: 'median', label: 'Median', description: 'Robust against single-source extreme outliers' },
  { value: 'weighted_mean', label: 'Weighted Mean', description: 'Weights values by source confidence score' },
  { value: 'mean', label: 'Arithmetic Mean', description: 'Equal weighting across all active sources' },
  { value: 'trimmed_mean', label: 'Trimmed Mean', description: 'Trims lowest & highest values before averaging' },
  { value: 'vwap', label: 'VWAP / Confidence', description: 'Volume / confidence weighted average price' },
]

export const BacktestTool = memo(function BacktestTool({
  pair,
  history,
}: BacktestToolProps): ReactElement {
  const { preferences, updatePreference } = usePreferences()

  const presets = useMemo<BacktestPreset[]>(() => {
    return preferences.backtestPresets ?? DEFAULT_BACKTEST_PRESETS
  }, [preferences.backtestPresets])

  const [selectedPresetId, setSelectedPresetId] = useState<string>(presets[0]?.id ?? 'custom')

  const [config, setConfig] = useState<BacktestConfig>(() => {
    return presets[0]?.config ?? {
      mode: 'median',
      outlierThresholdPercent: 1.5,
      minSources: 2,
      confidenceWeighting: true,
      maxStalenessSec: 300,
    }
  })

  const [newPresetName, setNewPresetName] = useState('')
  const [showPresetModal, setShowPresetModal] = useState(false)

  // Run non-blocking backtest over history
  const result = useMemo<BacktestResult>(() => {
    return runBacktest(pair, history, config)
  }, [pair, history, config])

  const handleModeChange = useCallback((mode: AggregationMode) => {
    setConfig((prev) => ({ ...prev, mode }))
    setSelectedPresetId('custom')
  }, [])

  const handleOutlierThresholdChange = useCallback((val: number) => {
    setConfig((prev) => ({ ...prev, outlierThresholdPercent: val }))
    setSelectedPresetId('custom')
  }, [])

  const handleMinSourcesChange = useCallback((val: number) => {
    setConfig((prev) => ({ ...prev, minSources: val }))
    setSelectedPresetId('custom')
  }, [])

  const handleStalenessChange = useCallback((val: number) => {
    setConfig((prev) => ({ ...prev, maxStalenessSec: val }))
    setSelectedPresetId('custom')
  }, [])

  const handleConfidenceWeightingToggle = useCallback(() => {
    setConfig((prev) => ({ ...prev, confidenceWeighting: !prev.confidenceWeighting }))
    setSelectedPresetId('custom')
  }, [])

  const handleSelectPreset = useCallback(
    (presetId: string) => {
      setSelectedPresetId(presetId)
      const found = presets.find((p) => p.id === presetId)
      if (found) {
        setConfig(found.config)
      }
    },
    [presets],
  )

  const handleSavePreset = useCallback(() => {
    if (!newPresetName.trim()) return
    const newPreset: BacktestPreset = {
      id: `preset-${Date.now()}`,
      name: newPresetName.trim(),
      config,
    }
    const updatedPresets = [...presets, newPreset]
    updatePreference('backtestPresets', updatedPresets)
    setSelectedPresetId(newPreset.id)
    setNewPresetName('')
    setShowPresetModal(false)
  }, [newPresetName, config, presets, updatePreference])

  const handleExportCsv = useCallback(() => {
    exportBacktestCsv(result)
  }, [result])

  const handleExportJson = useCallback(() => {
    exportBacktestJson(result)
  }, [result])

  return (
    <section
      aria-label="Aggregation Parameter Backtesting Tool"
      className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden p-6 space-y-6"
    >
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-cyan-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Aggregation Parameter Backtester
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Simulate and evaluate aggregation modes, thresholding, and outlier filters against {pair} history ({history.length} data points)
          </p>
        </div>

        {/* Action Controls & Preset Dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="preset-select" className="sr-only">
            Select Preset
          </label>
          <select
            id="preset-select"
            value={selectedPresetId}
            onChange={(e) => handleSelectPreset(e.target.value)}
            className="bg-gray-800 text-gray-200 border border-gray-700 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500 transition-colors"
          >
            <option value="custom">Custom Parameters</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                Preset: {p.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowPresetModal(true)}
            className="px-3 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors border border-gray-700"
          >
            Save Preset
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={history.length === 0}
            className="px-3 py-1.5 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Export CSV
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            disabled={history.length === 0}
            className="px-3 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors border border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* ── Parameters Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-gray-950 p-4 rounded-xl border border-gray-800">
        {/* Mode Selector */}
        <div>
          <label htmlFor="mode-select" className="block text-xs font-medium text-gray-400 mb-1">
            Aggregation Mode
          </label>
          <select
            id="mode-select"
            value={config.mode}
            onChange={(e) => handleModeChange(e.target.value as AggregationMode)}
            className="w-full bg-gray-800 text-gray-100 border border-gray-700 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
          >
            {AGGREGATION_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-gray-500 mt-1">
            {AGGREGATION_MODES.find((m) => m.value === config.mode)?.description}
          </p>
        </div>

        {/* Outlier Threshold Slider */}
        <div>
          <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
            <label htmlFor="outlier-threshold">Outlier Threshold</label>
            <span className="font-mono text-cyan-400">{config.outlierThresholdPercent}%</span>
          </div>
          <input
            id="outlier-threshold"
            type="range"
            min="0.1"
            max="5.0"
            step="0.1"
            value={config.outlierThresholdPercent}
            onChange={(e) => handleOutlierThresholdChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <p className="text-[11px] text-gray-500 mt-1">Deviations above this % are flagged/filtered</p>
        </div>

        {/* Min Sources */}
        <div>
          <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
            <label htmlFor="min-sources">Minimum Sources</label>
            <span className="font-mono text-cyan-400">{config.minSources}</span>
          </div>
          <input
            id="min-sources"
            type="range"
            min="1"
            max="4"
            step="1"
            value={config.minSources}
            onChange={(e) => handleMinSourcesChange(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <p className="text-[11px] text-gray-500 mt-1">Min active sources required for consensus</p>
        </div>

        {/* Max Staleness & Confidence Toggle */}
        <div className="space-y-2">
          <div>
            <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
              <label htmlFor="max-staleness">Max Staleness (sec)</label>
              <span className="font-mono text-cyan-400">{config.maxStalenessSec}s</span>
            </div>
            <input
              id="max-staleness"
              type="number"
              min="30"
              max="1800"
              step="30"
              value={config.maxStalenessSec}
              onChange={(e) => handleStalenessChange(parseInt(e.target.value, 10) || 300)}
              className="w-full bg-gray-800 text-gray-100 border border-gray-700 text-xs rounded-lg px-3 py-1 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={config.confidenceWeighting}
              onChange={handleConfidenceWeightingToggle}
              className="rounded bg-gray-800 border-gray-700 text-cyan-500 focus:ring-cyan-500 h-4 w-4"
            />
            <span>Confidence Weighting</span>
          </label>
        </div>
      </div>

      {/* ── Summary Metrics Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-950 p-4 rounded-xl border border-gray-800">
          <p className="text-xs text-gray-500 font-medium">Mean Deviation</p>
          <p className="text-xl font-bold font-mono text-cyan-400 mt-1">
            {result.meanDeviationPercent.toFixed(3)}%
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">Average % shift from baseline</p>
        </div>

        <div className="bg-gray-950 p-4 rounded-xl border border-gray-800">
          <p className="text-xs text-gray-500 font-medium">Max Deviation</p>
          <p className="text-xl font-bold font-mono text-yellow-400 mt-1">
            {result.maxDeviationPercent.toFixed(3)}%
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">Peak single-point variance</p>
        </div>

        <div className="bg-gray-950 p-4 rounded-xl border border-gray-800">
          <p className="text-xs text-gray-500 font-medium">Synthetic Anomaly Rate</p>
          <p className="text-xl font-bold font-mono text-purple-400 mt-1">
            {result.anomalyRatePercent.toFixed(1)}%
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">{result.anomalyCount} points flagged</p>
        </div>

        <div className="bg-gray-950 p-4 rounded-xl border border-gray-800">
          <p className="text-xs text-gray-500 font-medium">Outliers Filtered</p>
          <p className="text-xl font-bold font-mono text-green-400 mt-1">
            {result.outliersFilteredCount}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">Spikes removed from feed</p>
        </div>
      </div>

      {/* ── Visual Comparison Chart ── */}
      <div className="bg-gray-950 p-5 rounded-xl border border-gray-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-200">Before / After Visual Comparison</h3>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-3 h-0.5 bg-cyan-400 rounded-full inline-block" /> Baseline
            </span>
            <span className="flex items-center gap-1.5 text-purple-400">
              <span className="w-3 h-0.5 bg-purple-400 rounded-full inline-block" /> Backtested ({config.mode})
            </span>
          </div>
        </div>

        {result.points.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
            No history data available for backtesting visual comparison
          </div>
        ) : (
          <BacktestVisualChart points={result.points} />
        )}
      </div>

      {/* Save Preset Modal */}
      {showPresetModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="text-base font-semibold text-gray-100">Save Backtest Preset</h3>
            <div>
              <label htmlFor="preset-name" className="block text-xs text-gray-400 mb-1">
                Preset Name
              </label>
              <input
                id="preset-name"
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="e.g. Low Latency Median"
                className="w-full bg-gray-800 text-gray-100 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPresetModal(false)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={!newPresetName.trim()}
                className="px-4 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
})

// ── SVG Visual Comparison Sub-chart ──────────────────────────────────────────

interface BacktestVisualChartProps {
  points: BacktestResult['points']
}

function BacktestVisualChart({ points }: BacktestVisualChartProps): ReactElement {
  // Downsample to max 100 visual points for performance
  const sampled = useMemo(() => {
    if (points.length <= 100) return points
    const step = Math.ceil(points.length / 100)
    return points.filter((_, idx) => idx % step === 0)
  }, [points])

  const minPrice = Math.min(...sampled.map((p) => Math.min(p.baselinePrice, p.backtestedPrice)))
  const maxPrice = Math.max(...sampled.map((p) => Math.max(p.baselinePrice, p.backtestedPrice)))
  const range = maxPrice - minPrice || 1

  const width = 800
  const height = 180

  const baselinePath = sampled
    .map((p, i) => {
      const x = (i / (sampled.length - 1)) * width
      const y = height - ((p.baselinePrice - minPrice) / range) * (height - 20) - 10
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  const backtestPath = sampled
    .map((p, i) => {
      const x = (i / (sampled.length - 1)) * width
      const y = height - ((p.backtestedPrice - minPrice) / range) * (height - 20) - 10
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div className="w-full overflow-hidden">
      <svg className="w-full h-44" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {/* Background Grid */}
        <line x1="0" y1="40" x2={width} y2="40" stroke="#1f2937" strokeDasharray="4 4" />
        <line x1="0" y1="90" x2={width} y2="90" stroke="#1f2937" strokeDasharray="4 4" />
        <line x1="0" y1="140" x2={width} y2="140" stroke="#1f2937" strokeDasharray="4 4" />

        {/* Baseline Line */}
        <path d={baselinePath} fill="none" stroke="#22d3ee" strokeWidth="1.8" opacity="0.75" />

        {/* Backtested Line */}
        <path d={backtestPath} fill="none" stroke="#c084fc" strokeWidth="2.2" />

        {/* Anomaly Highlight Dots */}
        {sampled.map((p, i) => {
          if (!p.isAnomaly) return null
          const x = (i / (sampled.length - 1)) * width
          const y = height - ((p.backtestedPrice - minPrice) / range) * (height - 20) - 10
          return <circle key={i} cx={x} cy={y} r="3" fill="#f87171" />
        })}
      </svg>

      <div className="flex justify-between items-center text-[10px] text-gray-500 pt-1 font-mono">
        <span>Min: {formatPrice(minPrice)}</span>
        <span>Max: {formatPrice(maxPrice)}</span>
      </div>
    </div>
  )
}
