import { memo, useMemo } from 'react'
import type { MoveAttribution } from '../types'
import { buildConfidenceRegimeSummaries } from '../utils/confidenceRegimes'

interface ConfidenceRegimePanelProps {
  histories: ReadonlyMap<string, MoveAttribution[]>
}

const STALE_AFTER_MS = 5 * 60_000

export const ConfidenceRegimePanel = memo(function ConfidenceRegimePanel({ histories }: ConfidenceRegimePanelProps) {
  const summaries = useMemo(() => buildConfidenceRegimeSummaries(histories), [histories])
  const latestTimestamp = useMemo(
    () =>
      [...histories.values()].reduce(
        (latest, history) => Math.max(latest, history[history.length - 1]?.timestamp ?? 0),
        0,
      ),
    [histories],
  )

  return (
    <section
      aria-labelledby="confidence-regime-title"
      className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-5"
    >
      <h2 id="confidence-regime-title" className="text-sm font-semibold text-gray-100 mb-2">
        Confidence by asset and volatility regime
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        Mean reported confidence within each asset’s recent low, moderate, and high realized-volatility tertile. This
        describes observed scores; it does not measure prediction accuracy.
      </p>

      {latestTimestamp > 0 && Date.now() - latestTimestamp > STALE_AFTER_MS && (
        <p className="text-xs text-amber-300 mb-3" role="status">
          Live tick history is stale; these summaries may not reflect current conditions.
        </p>
      )}

      {summaries.length === 0 ? (
        <p className="text-sm text-gray-400" role="status">
          Confidence regime summaries will appear after enough live price ticks are received.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-start text-xs">
            <caption className="sr-only">Mean reported confidence by asset and relative volatility regime</caption>
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th scope="col" className="py-2 pe-4 font-medium">
                  Asset
                </th>
                {summaries[0].regimes.map(({ regime }) => (
                  <th key={regime} scope="col" className="py-2 px-3 font-medium capitalize">
                    {regime} volatility
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summaries.map(({ assetPair, regimes }) => (
                <tr key={assetPair} className="border-b border-gray-800/70 last:border-0">
                  <th scope="row" className="py-2 pe-4 font-medium text-gray-200">
                    {assetPair}
                  </th>
                  {regimes.map(({ regime, sampleCount, meanConfidence }) => (
                    <td key={regime} className="py-2 px-3 text-gray-300">
                      {sampleCount > 0 ? (
                        <span
                          aria-label={`${(meanConfidence * 100).toFixed(1)} percent mean confidence, ${sampleCount} ticks`}
                        >
                          {(meanConfidence * 100).toFixed(1)}% <span className="text-gray-500">({sampleCount})</span>
                        </span>
                      ) : (
                        <span className="text-gray-500">Unavailable</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
})
