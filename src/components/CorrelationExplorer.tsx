import { memo, useState, useCallback, useMemo, useRef } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import {
  pearsonCorrelation,
  rollingCorrelation,
  alignSeries,
  detectCorrelationShifts,
  formatCorrelationInsight,
} from '../utils/correlation'
import type { CorrelationShift } from '../utils/correlation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PricePoint {
  timestamp: number
  price: number
}

interface CorrelationExplorerProps {
  pairs: string[]
  priceHistory: Record<string, PricePoint[]>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Maps a correlation value [-1, 1] to a Tailwind background colour class. */
function correlationCellClass(r: number): string {
  if (isNaN(r)) return 'bg-gray-700 text-gray-400'
  if (r >= 0.7) return 'bg-emerald-900 text-emerald-300'
  if (r >= 0.3) return 'bg-teal-900 text-teal-300'
  if (r > -0.3) return 'bg-gray-700 text-gray-300'
  if (r > -0.7) return 'bg-rose-900/60 text-rose-300'
  return 'bg-rose-900 text-rose-300'
}

/** Formats a correlation coefficient for display. */
function fmtR(r: number): string {
  if (isNaN(r)) return '—'
  return r.toFixed(2)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface InsightBannerProps {
  shift: CorrelationShift
  pairA: string
  pairB: string
}

const InsightBanner = memo(function InsightBanner({ shift, pairA, pairB }: InsightBannerProps) {
  const isBreakdown = shift.type === 'breakdown'
  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
        isBreakdown
          ? 'border-rose-700 bg-rose-900/30 text-rose-300'
          : 'border-emerald-700 bg-emerald-900/30 text-emerald-300'
      }`}
    >
      <span className="mt-0.5 shrink-0 text-base" aria-hidden="true">
        {isBreakdown ? '⚠️' : '✅'}
      </span>
      <p>{formatCorrelationInsight(shift, pairA, pairB)}</p>
    </div>
  )
})

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const CorrelationExplorer = memo(function CorrelationExplorer({
  pairs,
  priceHistory,
}: CorrelationExplorerProps) {
  // Pair selectors
  const [pairA, setPairA] = useState<string>(pairs[0] ?? '')
  const [pairB, setPairB] = useState<string>(pairs[1] ?? pairs[0] ?? '')

  // Rolling window slider
  const [windowSize, setWindowSize] = useState<number>(20)

  // Ref for the chart container (used by export image)
  const chartRef = useRef<HTMLDivElement>(null)

  // -------------------------------------------------------------------------
  // Aligned series for selected pair A vs pair B
  // -------------------------------------------------------------------------
  const aligned = useMemo(() => {
    const histA = priceHistory[pairA] ?? []
    const histB = priceHistory[pairB] ?? []
    return alignSeries(histA, histB)
  }, [pairA, pairB, priceHistory])

  // -------------------------------------------------------------------------
  // Rolling correlation series
  // -------------------------------------------------------------------------
  const rollingData = useMemo(() => {
    const values = rollingCorrelation(aligned.xs, aligned.ys, windowSize)
    return values.map((r, i) => ({
      r,
      timestamp: aligned.timestamps[i + windowSize - 1] ?? 0,
      time: new Date(aligned.timestamps[i + windowSize - 1] ?? 0).toLocaleTimeString(),
    }))
  }, [aligned, windowSize])

  // -------------------------------------------------------------------------
  // Detected shifts
  // -------------------------------------------------------------------------
  const shifts = useMemo(() => {
    const rValues = rollingData.map((d) => d.r)
    const timestamps = rollingData.map((d) => d.timestamp)
    return detectCorrelationShifts(rValues, timestamps)
  }, [rollingData])

  // -------------------------------------------------------------------------
  // Full correlation matrix — all pairs × all pairs
  // -------------------------------------------------------------------------
  const matrix = useMemo<number[][]>(() => {
    return pairs.map((pa) =>
      pairs.map((pb) => {
        if (pa === pb) return 1
        const { xs, ys } = alignSeries(priceHistory[pa] ?? [], priceHistory[pb] ?? [])
        return pearsonCorrelation(xs, ys)
      }),
    )
  }, [pairs, priceHistory])

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const handlePairAChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setPairA(e.target.value)
  }, [])

  const handlePairBChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setPairB(e.target.value)
  }, [])

  const handleWindowChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setWindowSize(Number(e.target.value))
  }, [])

  const handleExportCsv = useCallback(() => {
    const header = ['', ...pairs].join(',')
    const rows = pairs.map((pa, ri) => {
      const cells = pairs.map((_, ci) => fmtR(matrix[ri][ci]))
      return [pa, ...cells].join(',')
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'correlation-matrix.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [pairs, matrix])

  const handleExportImage = useCallback(() => {
    window.print()
  }, [])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <section className="flex flex-col gap-6 rounded-xl bg-gray-900 p-6 text-gray-100" aria-label="Correlation Explorer">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-cyan-400">Cross-Pair Correlation Explorer</h2>
        <p className="text-sm text-gray-400">
          Analyse how price pairs move together. Select two pairs to view rolling correlation over time.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4">
        {/* Pair A selector */}
        <label className="flex flex-col gap-1 text-sm text-gray-400">
          Pair A
          <select
            value={pairA}
            onChange={handlePairAChange}
            className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-gray-100 focus:border-cyan-500 focus:outline-none"
          >
            {pairs.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        {/* Pair B selector */}
        <label className="flex flex-col gap-1 text-sm text-gray-400">
          Pair B
          <select
            value={pairB}
            onChange={handlePairBChange}
            className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-gray-100 focus:border-cyan-500 focus:outline-none"
          >
            {pairs.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        {/* Rolling window slider */}
        <label className="flex flex-col gap-1 text-sm text-gray-400">
          Rolling window: <span className="font-mono text-cyan-400">{windowSize}</span>
          <input
            type="range"
            min={5}
            max={100}
            value={windowSize}
            onChange={handleWindowChange}
            className="w-40 accent-cyan-500"
            aria-label="Rolling window size"
          />
        </label>

        {/* Export buttons */}
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleExportCsv}
            className="rounded-md border border-gray-700 bg-gray-800 px-4 py-1.5 text-sm text-gray-200 transition hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            aria-label="Export correlation matrix as CSV"
          >
            Export CSV
          </button>
          <button
            onClick={handleExportImage}
            className="rounded-md border border-gray-700 bg-gray-800 px-4 py-1.5 text-sm text-gray-200 transition hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            aria-label="Export chart as image"
          >
            Export Image
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Correlation Matrix                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Correlation Matrix</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="min-w-full text-center text-xs">
            <thead>
              <tr className="bg-gray-800">
                <th className="border-b border-gray-700 px-3 py-2 text-left text-gray-500" scope="col">
                  &nbsp;
                </th>
                {pairs.map((p) => (
                  <th
                    key={p}
                    scope="col"
                    className="border-b border-gray-700 px-3 py-2 font-semibold text-cyan-400 whitespace-nowrap"
                  >
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pairs.map((pa, ri) => (
                <tr key={pa} className="border-b border-gray-800 last:border-0">
                  <th
                    scope="row"
                    className="whitespace-nowrap bg-gray-800 px-3 py-2 text-left font-semibold text-cyan-400"
                  >
                    {pa}
                  </th>
                  {pairs.map((_, ci) => {
                    const r = matrix[ri][ci]
                    return (
                      <td
                        key={ci}
                        className={`px-3 py-2 font-mono tabular-nums transition-colors ${correlationCellClass(r)}`}
                        title={`${pa} × ${pairs[ci]}: r = ${fmtR(r)}`}
                        aria-label={`${pa} versus ${pairs[ci]} correlation: ${fmtR(r)}`}
                      >
                        {fmtR(r)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Rolling Correlation Chart                                            */}
      {/* ------------------------------------------------------------------ */}
      <div ref={chartRef}>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
          Rolling Correlation — {pairA} × {pairB}
          {rollingData.length === 0 && (
            <span className="ml-2 font-normal normal-case text-gray-500">(insufficient data)</span>
          )}
        </h3>

        <div className="h-56 w-full" aria-label={`Rolling correlation chart for ${pairA} and ${pairB}`}>
          {rollingData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rollingData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: '#374151' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[-1, 1]}
                  ticks={[-1, -0.5, 0, 0.5, 1]}
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: '#374151' }}
                  width={32}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#9ca3af', fontSize: 11 }}
                  itemStyle={{ color: '#22d3ee', fontSize: 12 }}
                  formatter={(val: unknown) => [fmtR(typeof val === 'number' ? val : 0), 'r']}
                />
                {/* Zero reference line */}
                <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="r"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#22d3ee' }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-gray-700 text-sm text-gray-500">
              Not enough aligned data points for window size {windowSize}.
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Insight Banners                                                      */}
      {/* ------------------------------------------------------------------ */}
      {shifts.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Detected Shifts</h3>
          {shifts.map((shift, i) => (
            <InsightBanner key={`${shift.timestamp}-${i}`} shift={shift} pairA={pairA} pairB={pairB} />
          ))}
        </div>
      )}
    </section>
  )
})
