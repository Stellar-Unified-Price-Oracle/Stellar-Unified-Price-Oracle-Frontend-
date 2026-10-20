/**
 * @file GovernanceProposalCard
 *
 * Read-only summary of a single governance proposal: status, reported tally,
 * quorum and deadline.
 *
 * It renders the API's figures verbatim. Where the API has not reported a value
 * (no votes cast, quorum unset, total voting power unknown) the card says so
 * explicitly rather than drawing an empty bar that reads as zero support. If the
 * API still reports a proposal as active past its deadline, that is surfaced as
 * a caveat — the status is never rewritten to a guessed outcome.
 */
import { memo, type ReactElement } from 'react'
import type { GovernanceProposal, ProposalStatus, VoteTally } from '../types'
import { SOURCE_COLORS } from '../utils/sourceColors'
import { GovernanceActionGate } from './GovernanceActionGate'
import type { GovernanceRole } from '../types/governancePermissions'
import {
  STATUS_LABELS,
  deadlineState,
  formatVotingPower,
  isStatusStale,
  participationPercent,
  quorumState,
  tallyTotal,
  voteShares,
} from '../utils/governance'

const STATUS_STYLES: Record<ProposalStatus, string> = {
  active: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  pending: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
  passed: 'bg-green-500/15 text-green-300 border-green-500/30',
  rejected: 'bg-red-500/15 text-red-300 border-red-500/30',
  cancelled: 'bg-gray-600/15 text-gray-400 border-gray-600/30',
  executed: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
}

const OPTION_ORDER: readonly (keyof VoteTally)[] = ['for', 'against', 'abstain']

const OPTION_META: Record<keyof VoteTally, { label: string; bar: string; dot: string }> = {
  for: { label: 'For', bar: 'bg-green-500', dot: 'bg-green-400' },
  against: { label: 'Against', bar: 'bg-red-500', dot: 'bg-red-400' },
  abstain: { label: 'Abstain', bar: 'bg-gray-500', dot: 'bg-gray-400' },
}

/** Renders `closesAt` relative to `now`; the caller guarantees `closesAt` is non-null. */
function formatDeadline(closesAt: number, now: number): string {
  const diff = closesAt - now
  const abs = Math.abs(diff)
  const days = Math.floor(abs / 86_400_000)
  const hours = Math.floor(abs / 3_600_000)
  const label =
    days >= 1
      ? `${days} day${days === 1 ? '' : 's'}`
      : hours >= 1
        ? `${hours} hour${hours === 1 ? '' : 's'}`
        : `${Math.max(1, Math.floor(abs / 60_000))} min`
  return diff > 0 ? `Closes in ${label}` : `Deadline passed ${label} ago`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export interface GovernanceProposalCardProps {
  proposal: GovernanceProposal
  /** Injected clock so deadline and staleness rendering is deterministic in tests. */
  now: number
  onVote?: (proposalId: string, choice: 'for' | 'against' | 'abstain') => void
  onExecute?: (proposalId: string) => void
  simulatedRole?: GovernanceRole
}

export const GovernanceProposalCard = memo(function GovernanceProposalCard({
  proposal,
  now,
  onVote,
  onExecute,
  simulatedRole,
}: GovernanceProposalCardProps): ReactElement {
  const titleId = `proposal-${proposal.id}-title`
  const shares = voteShares(proposal.tally)
  const participating = tallyTotal(proposal.tally)
  const quorum = quorumState(proposal.tally, proposal.quorum)
  const participation = participationPercent(proposal.tally, proposal.totalVotingPower)
  const deadline = deadlineState(proposal.closesAt, now)
  const stale = isStatusStale(proposal, now)

  return (
    <article
      aria-labelledby={titleId}
      className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4"
    >
      {/* ── Header ── */}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 id={titleId} className="text-base font-semibold text-gray-100 leading-snug">
            {proposal.title}
          </h3>
          <span
            className={[
              'inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap',
              STATUS_STYLES[proposal.status],
            ].join(' ')}
          >
            {STATUS_LABELS[proposal.status]}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
          <span className="font-mono text-gray-500">{proposal.id}</span>
          {proposal.category !== null && (
            <span className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-700">
              {proposal.category}
            </span>
          )}
          {proposal.closesAt !== null && (
            <span className={deadline === 'closed' ? 'text-yellow-400' : undefined}>
              {formatDeadline(proposal.closesAt, now)}
            </span>
          )}
          {proposal.closesAt === null && <span>No deadline reported</span>}
        </div>
      </header>

      <p className="text-sm text-gray-300 leading-relaxed">{proposal.summary}</p>

      {proposal.relatedSources.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Related oracle sources">
          <span className="text-xs text-gray-500">Affects:</span>
          {proposal.relatedSources.map((source) => {
            const colors = SOURCE_COLORS[source.toLowerCase()] ?? 'bg-gray-700/30 text-gray-400 border-gray-600/30'
            return (
              <span
                key={source}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors}`}
              >
                {capitalize(source)}
              </span>
            )
          })}
        </div>
      )}

      {proposal.proposedParameterChanges && proposal.proposedParameterChanges.length > 0 && (
        <ProposedParameterDiff
          changes={proposal.proposedParameterChanges}
          proposalId={proposal.id}
          compact
        />
      )}

      {/* ── Tally ── */}
      <section aria-label={`Vote tally for ${proposal.id}`} className="flex flex-col gap-2">
        {shares === null ? (
          // Unknown ≠ zero: an empty bar would read as unanimous rejection.
          <p className="text-sm text-gray-400 italic">No votes recorded for this proposal.</p>
        ) : (
          <>
            <div
              className="flex h-2 w-full overflow-hidden rounded-full bg-gray-800"
              role="img"
              aria-label={`Vote split — for ${shares.for.toFixed(1)}%, against ${shares.against.toFixed(1)}%, abstain ${shares.abstain.toFixed(1)}%`}
            >
              {OPTION_ORDER.map((option) =>
                proposal.tally[option] > 0 ? (
                  <div key={option} className={OPTION_META[option].bar} style={{ width: `${shares[option]}%` }} />
                ) : null,
              )}
            </div>

            <dl className="grid grid-cols-3 gap-2 text-xs">
              {OPTION_ORDER.map((option) => (
                <div key={option} className="flex flex-col gap-0.5">
                  <dt className="flex items-center gap-1.5 text-gray-400">
                    <span className={`w-2 h-2 rounded-full ${OPTION_META[option].dot}`} aria-hidden="true" />
                    {OPTION_META[option].label}
                  </dt>
                  <dd className="text-gray-200 tabular-nums font-mono">
                    {formatVotingPower(proposal.tally[option])}
                    <span className="text-gray-500 font-sans"> ({shares[option].toFixed(1)}%)</span>
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}

        {/* ── Quorum & participation ── */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs border-t border-gray-800 pt-2">
          <span
            className={quorum === 'met' ? 'text-green-400' : quorum === 'not-met' ? 'text-yellow-400' : 'text-gray-500'}
          >
            {quorum === 'met' &&
              `Quorum met — ${formatVotingPower(participating)} of ${formatVotingPower(proposal.quorum as number)} participating`}
            {quorum === 'not-met' &&
              `Quorum not met — ${formatVotingPower(participating)} of ${formatVotingPower(proposal.quorum as number)} participating`}
            {quorum === 'unknown' && 'Quorum threshold not reported'}
          </span>
          <span className="text-gray-500">
            {participation === null
              ? 'Participation not reported'
              : `${participation.toFixed(1)}% of eligible voting power participated`}
          </span>
        </div>

        {/* ── #853 Quorum, eligibility, and deadline explainer ── */}
        <ProposalVotingRulesExplainer proposal={proposal} now={now} />
      </section>

      {/* ── Stale-status caveat ── */}
      {stale && (
        <p
          role="note"
          className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2"
        >
          The API still reports this proposal as <strong>voting open</strong>, but its deadline has passed. The tally
          shown is as last reported and the outcome has not yet been reconciled — treat it as provisional.
        </p>
      )}

      {/* ── Governance Action Gating (#857) ── */}
      {proposal.status === 'active' && !stale && (
        <div className="border-t border-gray-800 pt-3">
          <GovernanceActionGate action="proposal:vote" simulatedRole={simulatedRole}>
            {({ allowed, disabledReason }) => (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-gray-400 font-medium">Cast Ballot:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!allowed}
                    aria-disabled={!allowed}
                    title={disabledReason ?? 'Vote in favour of this proposal'}
                    onClick={() => onVote?.(proposal.id, 'for')}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Vote For
                  </button>
                  <button
                    type="button"
                    disabled={!allowed}
                    aria-disabled={!allowed}
                    title={disabledReason ?? 'Vote against this proposal'}
                    onClick={() => onVote?.(proposal.id, 'against')}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Vote Against
                  </button>
                  <button
                    type="button"
                    disabled={!allowed}
                    aria-disabled={!allowed}
                    title={disabledReason ?? 'Abstain from voting'}
                    onClick={() => onVote?.(proposal.id, 'abstain')}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Abstain
                  </button>
                </div>
              </div>
            )}
          </GovernanceActionGate>
        </div>
      )}

      {proposal.status === 'passed' && (
        <div className="border-t border-gray-800 pt-3">
          <GovernanceActionGate action="proposal:execute" simulatedRole={simulatedRole}>
            {({ allowed, disabledReason }) => (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-green-400">Proposal passed quorum threshold.</span>
                <button
                  type="button"
                  disabled={!allowed}
                  aria-disabled={!allowed}
                  title={disabledReason ?? 'Execute approved proposal on-chain'}
                  onClick={() => onExecute?.(proposal.id)}
                  className="px-3 py-1 text-xs font-semibold rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Execute on Soroban
                </button>
              </div>
            )}
          </GovernanceActionGate>
        </div>
      )}
    </article>
  )
})
