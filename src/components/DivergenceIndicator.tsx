import { memo } from 'react'
import type { DivergenceResult } from '../types'

interface DivergenceIndicatorProps {
  divergence: DivergenceResult
  /**
   * Threshold in percentage points above which the indicator turns amber/red.
   * Defaults to 1 % (warn) and 3 % (critical).
   */
  warnThreshold?: number
  criticalThreshold?: number
  /** Compact single-badge mode for PriceCard; false = full row for PriceDetail */
  compact?: boolean
}

/**
 * Renders a visual indicator of inter-oracle source divergence.
 *
 * Severity levels:
 *   - Normal  (< warnThreshold)     — green/muted
 *   - Warning (≥ warnThreshold)     — amber
 *   - Critical (≥ criticalThreshold) — red
 */
export const DivergenceIndicator = memo(function DivergenceIndicator({
  divergence,
  warnThreshold = 1,
  criticalThreshold = 3,
  compact = false,
}: DivergenceIndicatorProps) {
  const { maxDeviationPct, highSource, lowSource, sourceCount } = divergence

  if (sourceCount < 2) return null

  const isCritical = maxDeviationPct >= criticalThreshold
  const isWarning = !isCritical && maxDeviationPct >= warnThreshold

  const colorClasses = isCritical
    ? 'text-red-400 bg-red-500/10 border-red-500/30'
    : isWarning
      ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
      : 'text-green-400 bg-green-500/10 border-green-500/30'

  const dotColor = isCritical
    ? 'bg-red-400'
    : isWarning
      ? 'bg-amber-400'
      : 'bg-green-400'

  const label = isCritical ? 'High divergence' : isWarning ? 'Divergence warning' : 'Oracles aligned'

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border ${colorClasses}`}
        title={`${label}: ${maxDeviationPct.toFixed(2)}% spread between ${highSource ?? '—'} and ${lowSource ?? '—'}`}
        aria-label={`Source divergence: ${maxDeviationPct.toFixed(2)}%`}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} aria-hidden="true" />
        {maxDeviationPct.toFixed(2)}%
      </span>
    )
  }

  return (
    <div
      className={`flex items-center justify-between rounded-lg px-3 py-2 border text-sm ${colorClasses}`}
      role="status"
      aria-label={`Source divergence: ${maxDeviationPct.toFixed(2)}%`}
    >
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} aria-hidden="true" />
        <span className="font-medium">{label}</span>
        {highSource && lowSource && highSource !== lowSource && (
          <span className="text-xs opacity-70">
            ({highSource} vs {lowSource})
          </span>
        )}
      </div>
      <span className="font-mono font-semibold tabular-nums">
        {maxDeviationPct.toFixed(2)}%
      </span>
    </div>
  )
})
