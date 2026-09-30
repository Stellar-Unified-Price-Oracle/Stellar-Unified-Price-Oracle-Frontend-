/**
 * @file ReputationPanel — Reputation decay & sybil resistance (#697).
 *
 * Shows per-source reputation scores, decay state, and sybil-resistance
 * weights. Scores are verbatim from the API; the client computes no derived
 * reputation values.
 */
import { memo, type ReactElement } from 'react'
import { useSwr } from '../hooks/useSwr'
import { fetchSourceReputations } from '../api/rest'
import type { SourceReputation } from '../types'
import {
  reputationTier,
  REPUTATION_TIER_LABELS,
  formatReputationScore,
} from '../utils/governance'

const TIER_COLOURS: Record<ReturnType<typeof reputationTier>, string> = {
  elite: 'text-emerald-400',
  strong: 'text-blue-400',
  adequate: 'text-yellow-400',
  weak: 'text-red-400',
}

interface SourceReputationRowProps {
  rep: SourceReputation
}

const SourceReputationRow = memo(function SourceReputationRow({ rep }: SourceReputationRowProps): ReactElement {
  const tier = reputationTier(rep.decayedScore)
  const tierColour = TIER_COLOURS[tier]
  const rawDisplay = formatReputationScore(rep.score) ?? 'N/A'
  const decayedDisplay = formatReputationScore(rep.decayedScore) ?? 'N/A'
  const sybilDisplay = formatReputationScore(rep.sybilResistanceWeight) ?? 'N/A'
  const lastDecayDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(rep.lastDecayAt),
  )

  return (
    <li className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="font-medium text-gray-100 capitalize">{rep.sourceId}</span>
        <span className={`text-sm font-semibold ${tierColour}`} aria-label={`Reputation tier: ${REPUTATION_TIER_LABELS[tier]}`}>
          {REPUTATION_TIER_LABELS[tier]}
        </span>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="flex flex-col gap-0.5">
          <dt className="text-gray-500">Raw score</dt>
          <dd className="text-gray-100 font-mono">{rawDisplay}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-gray-500">After decay</dt>
          <dd className="text-gray-100 font-mono">{decayedDisplay}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-gray-500">Sybil weight</dt>
          <dd className="text-gray-100 font-mono">{sybilDisplay}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-gray-500">Inactive periods</dt>
          <dd className="text-gray-100 font-mono">{rep.inactivePeriods}</dd>
        </div>
      </dl>

      <p className="text-xs text-gray-500">Decay last computed: {lastDecayDate}</p>
    </li>
  )
})

export function ReputationPanel(): ReactElement {
  const { data, loading, error, refetch } = useSwr(
    'governance/reputation',
    (signal) => fetchSourceReputations(signal),
    { refreshInterval: 120_000, staleTime: 60_000 },
  )

  return (
    <section aria-labelledby="reputation-heading" className="flex flex-col gap-4">
      <h2 id="reputation-heading" className="text-lg font-semibold text-gray-100">
        Source reputation
      </h2>

      <p className="text-xs text-gray-500">
        Reputation scores decay over periods of inactivity and are weighted against sybil-resistance metrics to prevent
        manufactured influence. All values are verbatim from the API.
      </p>

      {loading && !data && (
        <p className="text-sm text-gray-500 py-6 text-center" role="status">
          Loading reputation data…
        </p>
      )}

      {!loading && error !== null && (
        <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 flex flex-col items-start gap-3">
          <p className="text-sm text-red-300">Could not load source reputation data.</p>
          <button
            type="button"
            onClick={refetch}
            className="min-h-[44px] px-4 py-2 text-sm font-medium bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && error === null && (!data || data.length === 0) && (
        <p className="text-sm text-gray-500 py-6 text-center">No reputation data available.</p>
      )}

      {data && data.length > 0 && (
        <ul className="flex flex-col gap-3 list-none p-0">
          {[...data].sort((a, b) => b.decayedScore - a.decayedScore).map((rep) => (
            <SourceReputationRow key={rep.sourceId} rep={rep} />
          ))}
        </ul>
      )}
    </section>
  )
}
