import { memo, useMemo } from 'react'
import type { MoveAttribution } from '../types'

interface ConfidenceChangeExplanationProps {
  latest: MoveAttribution
  previous?: MoveAttribution
}

const STALE_AFTER_MS = 5 * 60_000

function observedSpreadPercent(tick: MoveAttribution): number | null {
  const prices = tick.sources
    .filter((source) => source.priceIsObserved && Number.isFinite(source.price) && source.price > 0)
    .map((source) => source.price)
  if (prices.length < 2 || tick.price <= 0) return null
  return ((Math.max(...prices) - Math.min(...prices)) / tick.price) * 100
}

function sourceNames(tick: MoveAttribution): string {
  return (
    tick.sources
      .map((source) => source.source)
      .sort()
      .join(', ') || 'none'
  )
}

export const ConfidenceChangeExplanation = memo(function ConfidenceChangeExplanation({
  latest,
  previous,
}: ConfidenceChangeExplanationProps) {
  const concurrentChanges = useMemo(() => {
    if (!previous) return []

    const changes: string[] = []
    let comparableInputs = 0
    const previousSources = sourceNames(previous)
    const currentSources = sourceNames(latest)

    if (previous.sources.length > 0 && latest.sources.length > 0) {
      comparableInputs += 1
      if (previousSources !== currentSources) {
        changes.push(`Contributing sources changed from ${previousSources} to ${currentSources}.`)
      }
    }

    const oldSpread = observedSpreadPercent(previous)
    const newSpread = observedSpreadPercent(latest)
    if (oldSpread !== null && newSpread !== null) {
      comparableInputs += 1
      if (Math.abs(oldSpread - newSpread) > 1e-9) {
        changes.push(`Observed source spread changed from ${oldSpread.toFixed(3)}% to ${newSpread.toFixed(3)}%.`)
      }
    }

    if (previous.deltaPercent !== null && latest.deltaPercent !== null) {
      comparableInputs += 1
      if (Math.abs(previous.deltaPercent - latest.deltaPercent) > 1e-9) {
        changes.push(
          `Aggregate price movement changed from ${previous.deltaPercent.toFixed(3)}% to ${latest.deltaPercent.toFixed(3)}%.`,
        )
      }
    }

    if (changes.length === 0) {
      changes.push(
        comparableInputs > 0
          ? 'No change was detected in the available inputs listed above.'
          : 'The preceding tick does not contain enough comparable inputs to identify concurrent changes.',
      )
    }

    return changes
  }, [latest, previous])

  return (
    <section
      aria-labelledby="confidence-change-title"
      className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6"
    >
      <h2 id="confidence-change-title" className="text-xs text-gray-400 uppercase tracking-wider mb-3">
        Confidence change context
      </h2>

      {Date.now() - latest.timestamp > STALE_AFTER_MS && (
        <p className="text-xs text-amber-300 mb-3" role="status">
          This explanation uses stale live tick data and may not reflect current conditions.
        </p>
      )}

      {latest.previousConfidence === null ? (
        <p className="text-sm text-gray-400" role="status">
          A previous live confidence score is not available for comparison.
        </p>
      ) : latest.confidence === latest.previousConfidence ? (
        <p className="text-sm text-gray-300" role="status">
          Confidence is unchanged at {(latest.confidence * 100).toFixed(1)}% on the latest tick.
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-200 mb-3">
            Confidence changed from {(latest.previousConfidence * 100).toFixed(1)}% to{' '}
            {(latest.confidence * 100).toFixed(1)}%.
          </p>
          <p className="text-xs text-gray-400 mb-2">Inputs that changed at the same time (not causal attribution):</p>
          <ul className="list-disc ps-5 space-y-1 text-sm text-gray-300" aria-label="Concurrent input changes">
            {concurrentChanges.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        </>
      )}

      <p className="text-xs text-gray-500 mt-3">
        The current API supplies a confidence score but not its per-factor contributions; concurrent changes cannot
        establish which factor caused the score movement.
      </p>
    </section>
  )
})
