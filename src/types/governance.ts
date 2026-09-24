/**
 * @file Governance types (community voting on oracle-source decisions).
 *
 * Every field here is reported by the governance API. Nothing on these types is
 * inferred, back-filled, or re-scaled client-side. That constraint is
 * deliberate: source-performance figures and vote tallies are political
 * ammunition in this project, so a dashboard that guesses a value is worse than
 * one that renders "unavailable" — the community will act on the number.
 */

/**
 * Lifecycle of a proposal, exactly as reported by the API.
 * The client never derives a status (e.g. by comparing `closesAt` to the local
 * clock); see `deriveProposalDeadline` in `utils/governance.ts` for how a
 * stale-but-still-active proposal is surfaced without rewriting its status.
 */
export type ProposalStatus = 'pending' | 'active' | 'passed' | 'rejected' | 'cancelled' | 'executed'

/** The vote options the governance contract tallies. */
export type VoteChoice = 'for' | 'against' | 'abstain'

/**
 * Raw vote counts as reported by the API, in voting-power units.
 * Counts are whole, non-negative integers and are never re-scaled client-side.
 */
export interface VoteTally {
  for: number
  against: number
  abstain: number
}

/** A single governance proposal the community can act on. */
export interface GovernanceProposal {
  /** Stable identifier assigned by the governance contract. */
  id: string
  title: string
  summary: string
  status: ProposalStatus
  /** Unix timestamp (ms) when voting opened. */
  createdAt: number
  /** Unix timestamp (ms) when voting closes, or null when the API reports no deadline. */
  closesAt: number | null
  /** Vote counts exactly as reported by the API. */
  tally: VoteTally
  /** Participating voting power required for the result to be valid, or null when unset. */
  quorum: number | null
  /** Total eligible voting power, or null when the API does not report it. */
  totalVotingPower: number | null
  /** Owning governance body or category, or null. */
  category: string | null
  /** Oracle sources this proposal concerns (add / remove / re-weight). */
  relatedSources: string[]
}
