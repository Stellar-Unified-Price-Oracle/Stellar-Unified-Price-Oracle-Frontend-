/**
 * @file ReputationScorePanel (#697)
 *
 * Displays the reputation leaderboard with decay state and sybil-resistance
 * classification for each source. Scores are sorted by effective score
 * (after sybil attenuation).
 *
 * Rendering rules:
 * - A null score renders as "not reported", not zero.
 * - Sybil risk tier is shown verbatim as reported by the aggregator.
 * - Decay fraction is a display projection only — the aggregator's next
 *   reported score is authoritative.
 *
 * Note (#939): this panel is the canonical reputation leaderboard. The legacy
 * `ReputationPanel` is a thin wrapper that delegates here, so the two do not
 * duplicate rendering logic.
 */
import { memo, type ReactElement } from 'react'
import type { SourceReputationScore } from '../types'
import {
  SYBIL_RISK_LABELS,
  SYBIL_RISK_STYLES,
  formatReputationScore,
  effectiveScore,
  decayFraction,
  rankByEffectiveScore,
  sybilClusterPeers,
} from '../utils/reputationDecay'

function formatHalfLife(ms: number): string {
  const days = ms / (24 * 60 * 60 * 1000)
  if (days >= 1) return `${days.toFixed(0)} d half-life`
  const hours = ms / (60 * 60 * 1000)
  return `${hours.toFixed(0)} h half-life`
}

interface ReputationRowProps {
  rep: SourceReputationScore
  rank: number
  peers: SourceReputationScore[]
  now: number
}

const ReputationRow = memo(function ReputationRow({ rep, rank, peers, now }: ReputationRowProps): ReactElement {
  const effective = effectiveScore(rep)
  const decay = decayFraction(rep.lastScoredAt, rep.decayHalfLifeMs, now)
  const formattedScore = formatReputationScore(effective)

  return (
    <li className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        {/* Rank + source ID */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-gray-500 w-5 text-right" aria-hidden="true">
            #{rank}
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-gray-100 capitalize">{rep.sourceId}</span>
            {rep.sybilClusterId !== null && (
              <span className="text-xs text-yellow-400" title={`Sybil cluster: ${rep.sybilClusterId}`}>
                Cluster: {rep.sybilClusterId}
              </span>
            )}
          </div>
        </div>

        {/* Effective score */}
        <div className="text-right">
          <div className="text-lg font-bold tabular-nums text-gray-100">
            {formattedScore ?? <span className="text-gray-500 text-sm font-normal">Score not reported</span>}
          </div>
          {rep.sybilAttenuationFactor < 1 && (
            <div className="text-xs text-yellow-400">
              Attenuated ×{rep.sybilAttenuationFactor.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {/* Score bars */}
      <div className="flex flex-col gap-1.5">
        {/* Effective score bar */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="w-24 shrink-0">Effective</span>
          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 rounded-full transition-all"
              style={{ width: effective !== null ? `${(effective * 100).toFixed(1)}%` : '0%' }}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Decay freshness bar — visual projection only */}
        {decay !== null && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-24 shrink-0">Decay</span>
            <div
              className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden"
              aria-label={`Decay: ${(decay * 100).toFixed(0)}% of half-life consumed`}
            >
              <div
                className={`h-full rounded-full transition-all ${decay > 0.75 ? 'bg-red-500' : decay > 0.4 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${(decay * 100).toFixed(1)}%` }}
                aria-hidden="true"
              />
            </div>
            <span className="text-gray-500 text-xs">{formatHalfLife(rep.decayHalfLifeMs)}</span>
          </div>
        )}
      </div>

      {/* Sybil risk badge + cluster peers */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${SYBIL_RISK_STYLES[rep.sybilRisk]}`}
        >
          {SYBIL_RISK_LABELS[rep.sybilRisk]}
        </span>
        {peers.length > 0 && (
          <span className="text-yellow-400">
            Shares cluster with: {peers.map((p) => p.sourceId).join(', ')}
          </span>
        )}
      </div>
    </li>
  )
})

export interface ReputationScorePanelProps {
  scores: readonly SourceReputationScore[]
  /** Injected clock for deterministic rendering in tests. */
  now?: number
}

export const ReputationScorePanel = memo(function ReputationScorePanel({
  scores,
  now = Date.now(),
}: ReputationScorePanelProps): ReactElement {
  const ranked = rankByEffectiveScore(scores)

  return (
    <section aria-labelledby="reputation-heading" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 id="reputation-heading" className="text-lg font-semibold text-gray-100">
          Reputation scores
        </h2>
        <p className="text-xs text-gray-400">
          Effective scores after exponential decay and sybil-resistance attenuation. Scores are reported by the
          aggregator — the decay bar is a display projection only.
        </p>
      </div>

      {ranked.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">No reputation scores have been reported yet.</p>
      ) : (
        <ul className="flex flex-col gap-3 list-none p-0">
          {ranked.map((rep, i) => (
            <ReputationRow
              key={rep.sourceId}
              rep={rep}
              rank={i + 1}
              peers={sybilClusterPeers(ranked, rep.sourceId)}
              now={now}
            />
          ))}
        </ul>
      )}
    </section>
  )
})
