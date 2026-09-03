import { useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
  YAxis,
} from 'recharts'
import type { PriceHistoryEntry } from '../types'
import {
  computeQualityScore,
  computeQualityTrend,
  FACTOR_WEIGHTS,
} from '../utils/dataQualityScore'
import type { QualityFactors, QualityTrendPoint } from '../utils/dataQualityScore'

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface FactorBarProps {
  label: string
  score: number
  weight: number
  description: string
}

/** A single quality-factor row: label, progress bar, score badge, and tooltip. */
function FactorBar({ label, score, weight, description }: FactorBarProps) {
  const barColor =
    score >= 80
      ? 'bg-emerald-500'
      : score >= 60
        ? 'bg-cyan-500'
        : score >= 40
          ? 'bg-yellow-500'
          : 'bg-red-500'

  const textColor =
    score >= 80
      ? 'text-emerald-400'
      : score >= 60
        ? 'text-cyan-400'
        : score >= 40
          ? 'text-yellow-400'
          : 'text-red-400'

  return (
    <div className="group relative" title={description}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400 flex items-center gap-1.5">
          {label}
          <span className="text-[10px] text-gray-600 font-mono">
            ×{(weight * 100).toFixed(0)}%
          </span>
          {/* Tooltip trigger */}
          <span className="hidden group-hover:block absolute left-0 top-6 z-10 w-52 bg-gray-800 border border-gray-700 rounded-lg p-2 text-[11px] text-gray-300 shadow-lg pointer-events-none">
            {description}
          </span>
        </span>
        <span className={`text-xs font-semibold font-mono tabular-nums ${textColor}`}>
          {score}
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden" role="presentation">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${score}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trend sparkline custom tooltip
// ---------------------------------------------------------------------------

interface SparkTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: QualityTrendPoint }>
}

function SparkTooltip({ active, payload }: SparkTooltipProps) {
  if (!active || !payload?.length) return null
  const { value, payload: point } = payload[0]
  const ts = new Date(point.timestamp).toLocaleString()
  return (
    <div className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[11px] text-gray-200 shadow">
      <p>{ts}</p>
      <p className="font-semibold">Score: {value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Score ring
// ---------------------------------------------------------------------------

interface ScoreRingProps {
  score: number
  label: string
  colorClass: string
}

/**
 * Circular score ring that renders a subtle arc proportional to the score.
 * Uses an SVG stroke-dasharray technique — pure CSS, no canvas.
 */
function ScoreRing({ score, label, colorClass }: ScoreRingProps) {
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - score / 100)

  // Extract the leading text-* class to get the stroke colour
  const strokeColorClass = colorClass.split(' ')[0] // e.g. 'text-emerald-400'

  // Map Tailwind text-* token to an actual hex value for SVG stroke
  const strokeColorMap: Record<string, string> = {
    'text-emerald-400': '#34d399',
    'text-cyan-400':    '#22d3ee',
    'text-yellow-400':  '#facc15',
    'text-red-400':     '#f87171',
  }

  const stroke = strokeColorMap[strokeColorClass] ?? '#6b7280'

  return (
    <div className="relative flex items-center justify-center w-20 h-20 shrink-0">
      <svg
        width="80"
        height="80"
        viewBox="0 0 80 80"
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* Background track */}
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="#1f2937"
          strokeWidth="6"
        />
        {/* Score arc */}
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      {/* Score text overlaid in the centre */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-bold font-mono tabular-nums leading-none ${colorClass.split(' ')[0]}`}>
          {score}
        </span>
        <span className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">
          {label}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface DataQualityScorecardProps {
  /** The asset pair being displayed, e.g. "BTC/USD". */
  pair: string
  /** Unix timestamp (ms) of the most recent published price. */
  latestTimestamp: number
  /** Historical entries in the selected range. */
  history: PriceHistoryEntry[]
  /** Optional override for "now" — useful in tests. */
  nowMs?: number
}

/**
 * Per-pair data quality scorecard.
 *
 * Renders:
 * - A 0–100 composite quality score with colour-coded ring and band label
 * - A factor breakdown with labelled progress bars (freshness, confidence,
 *   deviation, source coverage)
 * - A trend sparkline showing quality score over the selected history range
 * - Plain-language explanations for each factor
 */
export function DataQualityScorecard({
  pair,
  latestTimestamp,
  history,
  nowMs,
}: DataQualityScorecardProps) {
  const now = nowMs ?? Date.now()

  const { score, factors, label, colorClass } = useMemo(
    () => computeQualityScore(history, latestTimestamp, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, latestTimestamp, now],
  )

  const trendData = useMemo(
    () => computeQualityTrend(history, 20, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, now],
  )

  const factorRows: Array<{
    key: keyof QualityFactors
    label: string
    weight: number
    description: string
  }> = [
    {
      key: 'freshness',
      label: 'Freshness',
      weight: FACTOR_WEIGHTS.freshness,
      description:
        'How recently the latest price was published. Decays linearly from 100 at 0 s to 0 at 5 min.',
    },
    {
      key: 'confidence',
      label: 'Confidence',
      weight: FACTOR_WEIGHTS.confidence,
      description:
        'Average aggregator confidence score across all history entries in the selected range (0–1 → 0–100).',
    },
    {
      key: 'deviation',
      label: 'Deviation',
      weight: FACTOR_WEIGHTS.deviation,
      description:
        'Price stability — measured via coefficient of variation (CV). CV near 0 % → 100; CV ≥ 5 % → 0.',
    },
    {
      key: 'sourceCoverage',
      label: 'Source Coverage',
      weight: FACTOR_WEIGHTS.sourceCoverage,
      description:
        'Mean number of oracle sources (Chainlink, Redstone, Band, Reflector) active per entry, scaled to 100.',
    },
  ]

  // Sparkline stroke colour mirrors the current quality band
  const sparkColorMap: Record<string, string> = {
    'text-emerald-400': '#34d399',
    'text-cyan-400':    '#22d3ee',
    'text-yellow-400':  '#facc15',
    'text-red-400':     '#f87171',
  }
  const sparkColor = sparkColorMap[colorClass.split(' ')[0]] ?? '#6b7280'

  return (
    <section
      aria-label={`Data quality scorecard for ${pair}`}
      className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6"
    >
      {/* Section header */}
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">
        Data Quality Scorecard
      </p>

      {/* Top row: ring + summary + factor breakdown */}
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Score ring */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <ScoreRing score={score} label={label} colorClass={colorClass} />
          <p className="text-[11px] text-gray-500 text-center max-w-[90px]">
            Composite quality for&nbsp;<span className="font-mono text-gray-400">{pair}</span>
          </p>
        </div>

        {/* Factor bars */}
        <div className="flex-1 flex flex-col gap-3 justify-center min-w-0">
          {factorRows.map(({ key, label: factorLabel, weight, description }) => (
            <FactorBar
              key={key}
              label={factorLabel}
              score={factors[key]}
              weight={weight}
              description={description}
            />
          ))}
        </div>
      </div>

      {/* Plain-language summary */}
      <p className="mt-4 text-xs text-gray-400 leading-relaxed">
        {score >= 80 && (
          <>
            This feed is in <span className="text-emerald-400 font-medium">excellent condition</span>.
            Prices are fresh, highly confident, stable, and backed by broad source coverage.
          </>
        )}
        {score >= 60 && score < 80 && (
          <>
            This feed is in <span className="text-cyan-400 font-medium">good condition</span>.
            Minor degradation in one or more factors — monitor the breakdown for details.
          </>
        )}
        {score >= 40 && score < 60 && (
          <>
            This feed is in <span className="text-yellow-400 font-medium">fair condition</span>.
            Some factors are below optimal. Check freshness, confidence, or source coverage.
          </>
        )}
        {score < 40 && (
          <>
            This feed is in <span className="text-red-400 font-medium">poor condition</span>.
            Significant degradation detected. Exercise caution when relying on this feed.
          </>
        )}
      </p>

      {/* Trend sparkline */}
      {trendData.length >= 2 && (
        <div className="mt-5">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">
            Quality score trend
          </p>
          <div
            className="h-16"
            role="img"
            aria-label={`Quality score trend for ${pair} over the selected range`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <YAxis domain={[0, 100]} hide />
                <Tooltip content={<SparkTooltip />} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke={sparkColor}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  )
}
