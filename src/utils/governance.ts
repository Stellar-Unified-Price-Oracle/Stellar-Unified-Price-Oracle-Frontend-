/**
 * @file Pure helpers for the governance dashboard.
 *
 * These exist so the trust-critical arithmetic is one testable function rather
 * than inline JSX. Two rules govern everything here:
 *
 * 1. **Never fabricate a value.** When the API has not reported the inputs for
 *    a figure, return `null` so the UI can render an explicit "unavailable"
 *    state. Returning `0` for unknown data is the failure mode this module is
 *    written to prevent — a 0 % approval bar reads as "the community rejected
 *    this" when it may simply mean "no votes yet".
 * 2. **Never reinterpret a reported status.** `proposalStatus` is whatever the
 *    API said. Deadline state is reported separately so a stale status can be
 *    flagged as stale without silently rewriting it.
 */
import type { GovernanceProposal, ProposalStatus, VoteTally } from '../types'

/** Participating voting power: the sum of every counted vote. */
export function tallyTotal(tally: VoteTally): number {
  return tally.for + tally.against + tally.abstain
}

/**
 * Share of participating voting power held by each option, as percentages
 * summing to 100.
 *
 * Returns `null` when nothing has been counted yet. Do **not** substitute zeros
 * for the null case — render "no votes recorded" instead, or a proposal with no
 * participation is visually indistinguishable from one unanimously rejected.
 */
export function voteShares(tally: VoteTally): Record<keyof VoteTally, number> | null {
  const total = tallyTotal(tally)
  if (total <= 0) return null
  return {
    for: (tally.for / total) * 100,
    against: (tally.against / total) * 100,
    abstain: (tally.abstain / total) * 100,
  }
}

/** Whether a proposal's participating voting power has reached its quorum. */
export type QuorumState = 'met' | 'not-met' | 'unknown'

/**
 * Quorum result, or `'unknown'` when the API reports no quorum threshold.
 * Quorum is judged on *participating* power (all options), which is what
 * governs validity of the result — not on the "for" count.
 */
export function quorumState(tally: VoteTally, quorum: number | null): QuorumState {
  if (quorum === null) return 'unknown'
  return tallyTotal(tally) >= quorum ? 'met' : 'not-met'
}

/**
 * Share of eligible voting power that participated, as a percentage.
 * `null` when the API does not report total voting power, or reports a
 * non-positive amount (which would make the ratio meaningless).
 */
export function participationPercent(tally: VoteTally, totalVotingPower: number | null): number | null {
  if (totalVotingPower === null || totalVotingPower <= 0) return null
  return (tallyTotal(tally) / totalVotingPower) * 100
}

/** Position of the local clock relative to the reported voting deadline. */
export type DeadlineState = 'open' | 'closed' | 'unstipulated'

/** Deadline state from the reported `closesAt`, or `'unstipulated'` when absent. */
export function deadlineState(closesAt: number | null, now: number = Date.now()): DeadlineState {
  if (closesAt === null) return 'unstipulated'
  return closesAt > now ? 'open' : 'closed'
}

/**
 * True when the API still reports a proposal as `'active'` even though its
 * reported deadline has passed.
 *
 * This does **not** rewrite the status to `'passed'`/`'rejected'` — the client
 * cannot know the outcome, and guessing it would put a fabricated verdict in
 * front of voters. It is a caveat flag: the UI shows the API status verbatim
 * plus a note that the deadline has passed and the tally has not yet been
 * reconciled.
 */
export function isStatusStale(proposal: GovernanceProposal, now: number = Date.now()): boolean {
  return proposal.status === 'active' && deadlineState(proposal.closesAt, now) === 'closed'
}

/** Human-readable label for a proposal status. */
export const STATUS_LABELS: Record<ProposalStatus, string> = {
  pending: 'Pending',
  active: 'Voting open',
  passed: 'Passed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  executed: 'Executed',
}

/**
 * Orders proposals for display: anything open for voting first, then the rest
 * by deadline (soonest first), with undated proposals last. Stable and
 * deterministic so two renders never disagree about the order.
 */
export function orderProposals(proposals: readonly GovernanceProposal[]): GovernanceProposal[] {
  const rank = (p: GovernanceProposal): number => (p.status === 'active' ? 0 : p.status === 'pending' ? 1 : 2)
  return [...proposals].sort((a, b) => {
    const byRank = rank(a) - rank(b)
    if (byRank !== 0) return byRank
    const aCloses = a.closesAt ?? Number.POSITIVE_INFINITY
    const bCloses = b.closesAt ?? Number.POSITIVE_INFINITY
    if (aCloses !== bCloses) return aCloses - bCloses
    return a.id.localeCompare(b.id)
  })
}

/** Formats a voting-power amount for display, e.g. `1,234.5`. */
export function formatVotingPower(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
}
