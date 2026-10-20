/**
 * @file ProposalVotingRulesExplainer (#853)
 *
 * Explains voting quorum, eligibility qualifications, and deadlines
 * in governance proposal views.
 *
 * Requirements satisfied:
 * - Clear explanation of voting quorum thresholds, progress bars, and remaining votes needed.
 * - Explanation of voter eligibility, snapshot block/time, and participation rates.
 * - Detailed deadline breakdown with UTC/local timestamps and urgency countdowns.
 * - Handles stale/unavailable data gracefully without fabricating numbers.
 * - Full accessibility with screen-reader labels and keyboard navigation.
 */
import { memo, useState, type ReactElement } from 'react'
import type { GovernanceProposal } from '../types/governance'
import {
  deadlineState,
  deadlineUrgency,
  formatFullDeadline,
  formatVotingPower,
  isStatusStale,
  participationPercent,
  quorumProgressPercent,
  quorumState,
  tallyTotal,
  votesRemainingToQuorum,
} from '../utils/governance'

export interface ProposalVotingRulesExplainerProps {
  proposal: GovernanceProposal
  now: number
}

export const ProposalVotingRulesExplainer = memo(function ProposalVotingRulesExplainer({
  proposal,
  now,
}: ProposalVotingRulesExplainerProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false)

  const regionId = `voting-rules-${proposal.id}`
  const buttonId = `voting-rules-btn-${proposal.id}`

  const participating = tallyTotal(proposal.tally)
  const quorum = quorumState(proposal.tally, proposal.quorum)
  const quorumPct = quorumProgressPercent(proposal.tally, proposal.quorum)
  const remainingVotes = votesRemainingToQuorum(proposal.tally, proposal.quorum)
  const participation = participationPercent(proposal.tally, proposal.totalVotingPower)
  const deadline = deadlineState(proposal.closesAt, now)
  const urgency = deadlineUrgency(proposal.closesAt, now)
  const fullDeadline = formatFullDeadline(proposal.closesAt)
  const stale = isStatusStale(proposal, now)

  const createdAtFormatted = new Date(proposal.createdAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <div className="flex flex-col gap-2 pt-1 border-t border-gray-800/80">
      <div className="flex items-center justify-between gap-2">
        <button
          id={buttonId}
          type="button"
          aria-expanded={isOpen}
          aria-controls={regionId}
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 rounded py-1 px-1.5 -ml-1.5 transition-colors"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M6 3.5l4.5 4.5L6 12.5z" />
          </svg>
          <span>{isOpen ? 'Hide voting rules & quorum guide' : 'Explain quorum, eligibility & deadlines'}</span>
        </button>

        {urgency === 'urgent' && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full animate-pulse">
            Closing in &lt; 24h
          </span>
        )}
      </div>

      {isOpen && (
        <section
          id={regionId}
          role="region"
          aria-labelledby={buttonId}
          className="flex flex-col gap-4 rounded-xl border border-gray-800 bg-gray-950/70 p-4 text-xs mt-1"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* ── 1. Quorum Section ── */}
            <div className="flex flex-col gap-2 rounded-lg border border-gray-800 bg-gray-900/60 p-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-200 uppercase tracking-wider text-[11px]">
                  1. Voting Quorum
                </h4>
                <span
                  className={[
                    'px-2 py-0.5 rounded text-[11px] font-medium border',
                    quorum === 'met'
                      ? 'bg-green-500/15 text-green-300 border-green-500/30'
                      : quorum === 'not-met'
                        ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
                        : 'bg-gray-700/20 text-gray-400 border-gray-700/40',
                  ].join(' ')}
                >
                  {quorum === 'met' && 'Quorum Met'}
                  {quorum === 'not-met' && 'Quorum Not Met'}
                  {quorum === 'unknown' && 'Quorum Unset'}
                </span>
              </div>

              {/* Progress bar */}
              {proposal.quorum !== null && proposal.quorum > 0 ? (
                <div className="flex flex-col gap-1.5 pt-1">
                  <div
                    className="flex h-2 w-full overflow-hidden rounded-full bg-gray-800"
                    role="progressbar"
                    aria-valuenow={quorumPct ?? 0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Quorum progress: ${quorumPct?.toFixed(1) ?? 0}%`}
                  >
                    <div
                      className={quorum === 'met' ? 'bg-green-500' : 'bg-yellow-500'}
                      style={{ width: `${quorumPct ?? 0}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-gray-400 tabular-nums">
                    <span>
                      {formatVotingPower(participating)} / {formatVotingPower(proposal.quorum)} votes
                    </span>
                    <span className="font-semibold text-gray-300">{quorumPct?.toFixed(1)}%</span>
                  </div>

                  {remainingVotes !== null && remainingVotes > 0 ? (
                    <p className="text-[11px] text-yellow-400/90 font-medium">
                      {formatVotingPower(remainingVotes)} more participating votes needed to validate result.
                    </p>
                  ) : (
                    <p className="text-[11px] text-green-400/90 font-medium">
                      Minimum participation requirement satisfied.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-gray-400 italic">No minimum quorum requirement stipulated by the contract.</p>
              )}

              <p className="text-gray-400 text-[11px] leading-relaxed border-t border-gray-800/80 pt-2">
                <strong>Why quorum matters:</strong> For any outcome to be legally binding, total participating
                votes (For, Against, and Abstain) must reach the threshold. If quorum is not met by the deadline,
                the proposal fails automatically regardless of majority support.
              </p>
            </div>

            {/* ── 2. Voter Eligibility Section ── */}
            <div className="flex flex-col gap-2 rounded-lg border border-gray-800 bg-gray-900/60 p-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-200 uppercase tracking-wider text-[11px]">
                  2. Voter Eligibility
                </h4>
                <span className="text-[11px] text-cyan-400/90 font-medium">
                  {participation !== null ? `${participation.toFixed(1)}% Turnout` : 'Turnout Unset'}
                </span>
              </div>

              <dl className="flex flex-col gap-1 text-[11px] text-gray-300">
                <div className="flex justify-between border-b border-gray-800/60 pb-1">
                  <dt className="text-gray-500">Eligible Voting Power:</dt>
                  <dd className="font-mono text-gray-200 tabular-nums">
                    {proposal.totalVotingPower !== null
                      ? formatVotingPower(proposal.totalVotingPower)
                      : 'Not reported by contract'}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-gray-800/60 py-1">
                  <dt className="text-gray-500">Snapshot Timestamp:</dt>
                  <dd className="font-mono text-gray-200">{createdAtFormatted}</dd>
                </div>
                <div className="flex justify-between pt-1">
                  <dt className="text-gray-500">Category / Body:</dt>
                  <dd className="text-gray-200 capitalize">{proposal.category ?? 'Community General'}</dd>
                </div>
              </dl>

              <p className="text-gray-400 text-[11px] leading-relaxed border-t border-gray-800/80 pt-2">
                <strong>Qualification policy:</strong> Voting power is frozen at proposal snapshot time.
                Accounts must hold staked voting rights or oracle provider credentials on Stellar at that exact
                timestamp. Tokens acquired after snapshot do not grant voting power for this decision.
              </p>
            </div>

            {/* ── 3. Deadlines & Timeline Section ── */}
            <div className="flex flex-col gap-2 rounded-lg border border-gray-800 bg-gray-900/60 p-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-200 uppercase tracking-wider text-[11px]">
                  3. Deadlines & Timelines
                </h4>
                <span
                  className={[
                    'px-2 py-0.5 rounded text-[11px] font-medium border',
                    deadline === 'open'
                      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                      : 'bg-gray-700/20 text-gray-400 border-gray-700/40',
                  ].join(' ')}
                >
                  {deadline === 'open' ? 'Ballot Open' : 'Voting Concluded'}
                </span>
              </div>

              {fullDeadline ? (
                <div className="flex flex-col gap-1 text-[11px] text-gray-300">
                  <div className="flex flex-col border-b border-gray-800/60 pb-1">
                    <span className="text-gray-500">Closes (Local):</span>
                    <span className="font-mono text-gray-200">{fullDeadline.local}</span>
                  </div>
                  <div className="flex flex-col pt-0.5">
                    <span className="text-gray-500">Closes (UTC):</span>
                    <span className="font-mono text-gray-200 text-[10px] break-all">{fullDeadline.utc}</span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 italic">No explicit deadline stipulated by governance API.</p>
              )}

              {stale && (
                <div
                  role="note"
                  className="rounded bg-yellow-500/10 border border-yellow-500/20 p-2 text-[11px] text-yellow-300"
                >
                  <strong>Stale contract status caveat:</strong> The voting deadline has passed, but the on-chain
                  reconciliation has not completed. Results remain provisional until formally closed on-chain.
                </div>
              )}

              <p className="text-gray-400 text-[11px] leading-relaxed border-t border-gray-800/80 pt-2">
                <strong>Execution timelock:</strong> Following a successful ballot, approved changes enter a
                mandatory 24-hour settlement window before parameter updates become effective on the network.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  )
})
