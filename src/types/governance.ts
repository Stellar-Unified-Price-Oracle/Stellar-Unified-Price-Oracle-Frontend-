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

// ---------------------------------------------------------------------------
// #698 — Transparent parameter registry
// ---------------------------------------------------------------------------

/**
 * A single auditable change to a system parameter.
 * Every field is reported by the API; nothing is inferred client-side.
 */
export interface ParameterChangeEntry {
  /** Monotonically increasing index within the parameter's history (1-based). */
  version: number
  /** Unix timestamp (ms) when the change was applied. */
  changedAt: number
  /** Stellar account address of the operator who applied the change. */
  changedBy: string
  /** Value before this change, serialised to string for display. */
  previousValue: string
  /** Value after this change, serialised to string for display. */
  newValue: string
  /** Human-readable explanation recorded at the time of the change. */
  reason: string
}

/** A registered system parameter with its current value and full change log. */
export interface ParameterRecord {
  /** Stable machine key, e.g. `"aggregator.minSources"`. */
  key: string
  /** Human-readable name shown in the registry UI. */
  label: string
  /** Category for grouping, e.g. `"aggregation"`, `"staking"`, `"alerts"`. */
  category: string
  /** Current value serialised to string. */
  currentValue: string
  /** Stellar account address of the team or governance body that owns this parameter. */
  owner: string
  /** Unix timestamp (ms) of the most recent change, or null if never changed. */
  lastChangedAt: number | null
  /** Complete ordered history of changes, oldest first. */
  history: ParameterChangeEntry[]
}

// ---------------------------------------------------------------------------
// #697 — Reputation decay and sybil resistance
// ---------------------------------------------------------------------------

/**
 * Sybil cluster detection result for a source.
 * When the aggregator detects that multiple source addresses share an
 * infrastructure fingerprint they are grouped into a cluster.
 */
export type SybilRisk = 'low' | 'medium' | 'high' | 'unknown'

/**
 * Reputation score with decay metadata for a single source.
 * Scores are reported by the aggregator, never computed client-side.
 */
export interface SourceReputationScore {
  /** Source identifier matching `SourceName`. */
  sourceId: string
  /**
   * Current effective score after decay, in [0, 1].
   * Null when the aggregator has not reported it yet.
   */
  score: number | null
  /**
   * Raw accumulated score before the decay penalty is applied.
   * Null when not reported.
   */
  rawScore: number | null
  /** Half-life in milliseconds: time for an idle score to halve. */
  decayHalfLifeMs: number
  /** Unix timestamp (ms) of the last scored event (correct price contribution). */
  lastScoredAt: number | null
  /** Unix timestamp (ms) of the most recent decay application. */
  lastDecayAt: number | null
  /**
   * Sybil-resistance classification for this source.
   * High risk sources have their score attenuated before governance weighting.
   */
  sybilRisk: SybilRisk
  /**
   * Numeric multiplier [0, 1] applied to the raw score due to sybil risk.
   * 1 means no attenuation; 0 means the source carries zero effective weight.
   */
  sybilAttenuationFactor: number
  /** Cluster identifier if the source is grouped with others, null otherwise. */
  sybilClusterId: string | null
}

// ---------------------------------------------------------------------------
// #696 — Treasury and incentive accounting
// ---------------------------------------------------------------------------

/**
 * Accounting period granularity.
 * The API reports rewards over these windows; the client displays them verbatim.
 */
export type AccountingPeriod = 'epoch' | 'daily' | 'weekly' | 'monthly'

/**
 * A single line item in a source operator's incentive ledger.
 * All amounts are in the protocol's reward unit (XLM-equivalent, reported as a string to avoid
 * fp representation errors for large values).
 */
export interface IncentiveLedgerEntry {
  /** Monotonically increasing sequence number within this source's ledger. */
  seq: number
  /** Unix timestamp (ms) when this entry was recorded. */
  recordedAt: number
  /** Category of contribution this reward is for. */
  rewardType: 'accuracy' | 'uptime' | 'latency' | 'staking' | 'slash'
  /** Amount credited (positive) or debited/slashed (negative), as a string. */
  amount: string
  /** Running total after this entry, as a string. */
  runningBalance: string
  /** Optional human-readable note from the aggregator. */
  note: string | null
}

/** Aggregated incentive summary for one source operator over a reporting window. */
export interface SourceIncentiveSummary {
  /** Source identifier. */
  sourceId: string
  /** Reporting window this summary covers. */
  period: AccountingPeriod
  /** Unix timestamp (ms) start of the period. */
  periodStart: number
  /** Unix timestamp (ms) end of the period. */
  periodEnd: number
  /** Total rewards earned this period, as a string. */
  totalEarned: string
  /** Total slashes incurred this period, as a string. */
  totalSlashed: string
  /** Net balance change this period (earned − slashed), as a string. */
  netChange: string
  /** Cumulative all-time balance, as a string. Null when not reported. */
  cumulativeBalance: string | null
  /** The individual ledger entries that make up this period. */
  ledger: IncentiveLedgerEntry[]
}

// ---------------------------------------------------------------------------
// #695 — Dispute and challenge process
// ---------------------------------------------------------------------------

/** Lifecycle of a price dispute. */
export type DisputeStatus = 'open' | 'under_review' | 'resolved_upheld' | 'resolved_overturned' | 'withdrawn'

/**
 * A piece of evidence attached to a dispute by any participant.
 * The API is the source of truth for all evidence; nothing is fabricated
 * client-side.
 */
export interface DisputeEvidence {
  /** Stable identifier assigned by the aggregator. */
  id: string
  /** Stellar address of the submitter. */
  submittedBy: string
  /** Unix timestamp (ms) of submission. */
  submittedAt: number
  /** Short description of what this evidence shows. */
  description: string
  /** URI to the full evidence artefact (IPFS CID, on-chain tx hash URL, etc.). */
  uri: string | null
}

/**
 * An auditor's or resolver's comment on the dispute.
 * Forms the on-platform record replacing the current off-platform discussion.
 */
export interface DisputeComment {
  /** Stable identifier. */
  id: string
  /** Stellar address of the author. */
  author: string
  /** Unix timestamp (ms) when the comment was posted. */
  postedAt: number
  /** Markdown-free plain text body. */
  body: string
}

/** A formal price dispute on record. */
export interface PriceDispute {
  /** Stable identifier assigned by the aggregator. */
  id: string
  /** The asset pair whose price is contested, e.g. `"XLM/USD"`. */
  assetPair: string
  /** Unix timestamp (ms) of the price point being challenged. */
  contestedAt: number
  /** The aggregated price value that is being disputed, serialised to string. */
  contestedPrice: string
  /** The price the challenger believes is correct, or null when not asserted. */
  challengerPrice: string | null
  /** Stellar address of the challenger. */
  challenger: string
  /** Current lifecycle state. */
  status: DisputeStatus
  /** Unix timestamp (ms) when the dispute was opened. */
  openedAt: number
  /**
   * Unix timestamp (ms) by which a resolution must be reached,
   * or null when not stipulated.
   */
  resolutionDeadline: number | null
  /** Human-readable explanation from the challenger. */
  rationale: string
  /** Sources the challenger believes contributed erroneous data. */
  impliedSources: string[]
  /** All evidence attached to this dispute. */
  evidence: DisputeEvidence[]
  /** All comments on this dispute (chronological). */
  comments: DisputeComment[]
  /** Human-readable resolution note, null until resolved. */
  resolutionNote: string | null
}

/**
 * Raw vote counts as reported by the API, in voting-power units.
 * Counts are whole, non-negative integers and are never re-scaled client-side.
 */
export interface VoteTally {
  for: number
  against: number
  abstain: number
}

// ── #698 Transparent parameter registry ──────────────────────────────────────

/**
 * A single tuneable parameter managed by the registry.
 * All fields come verbatim from the API — the client never infers values.
 */
export interface ParameterEntry {
  /** Stable identifier for this parameter, e.g. `"oracle.weight.chainlink"`. */
  key: string
  /** Current value as a raw string (number, bool, or JSON-encoded object). */
  value: string
  /** Human-readable description of what the parameter controls. */
  description: string
  /** The team or role responsible for this parameter. */
  owner: string
  /** Unix timestamp (ms) when this value was last changed. */
  updatedAt: number
  /** Category grouping, e.g. `"thresholds"` | `"weights"` | `"timeouts"`. */
  category: string
}

/**
 * A single change-log entry for a parameter.
 * Ordered descending by `changedAt` (most recent first).
 */
export interface ParameterChangeLogEntry {
  /** The parameter key this entry refers to. */
  key: string
  /** Value before the change. */
  previousValue: string
  /** Value after the change. */
  nextValue: string
  /** Unix timestamp (ms) when the change was applied. */
  changedAt: number
  /** Actor who made the change (address, team name, or `"governance"`). */
  changedBy: string
  /** Human-readable rationale, or null when not provided. */
  reason: string | null
}

// ── #697 Reputation decay & sybil resistance ─────────────────────────────────

/**
 * Reputation metrics for a single oracle source.
 * The raw score from the API is never re-scaled client-side.
 */
export interface SourceReputation {
  /** Oracle source identifier, e.g. `"chainlink"`. */
  sourceId: string
  /** Current reputation score in [0, 1]. */
  score: number
  /** Effective score after decay applied by the registry. */
  decayedScore: number
  /**
   * Sybil resistance weight in [0, 1].
   * Low values indicate suspected duplicate or low-stake sources.
   */
  sybilResistanceWeight: number
  /** Unix timestamp (ms) of the last decay computation. */
  lastDecayAt: number
  /** Number of consecutive periods with no activity (drives accelerated decay). */
  inactivePeriods: number
}

// ── #696 Treasury & incentive accounting ─────────────────────────────────────

/**
 * Ledger entry for an oracle source operator.
 * Amounts are in the protocol's native unit (a string to avoid float drift).
 */
export interface TreasuryEntry {
  /** Oracle source identifier. */
  sourceId: string
  /** Cumulative rewards accrued, as a decimal string. */
  accruedRewards: string
  /** Cumulative rewards claimed, as a decimal string. */
  claimedRewards: string
  /**
   * Rewards pending the next settlement cycle, as a decimal string.
   * Null when the cycle has not yet been computed.
   */
  pendingRewards: string | null
  /** Uptime contribution score used in the last settlement, in [0, 1]. */
  uptimeScore: number
  /** Accuracy contribution score used in the last settlement, in [0, 1]. */
  accuracyScore: number
  /** Unix timestamp (ms) of the last settlement computation. */
  lastSettledAt: number | null
}

// ── #695 Dispute & challenge process ─────────────────────────────────────────

/** Lifecycle of a price dispute. */
export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'dismissed'

/** The outcome recorded when a dispute is closed. */
export type DisputeOutcome = 'upheld' | 'rejected' | 'inconclusive' | null

/**
 * A formal challenge to an aggregated price.
 * All fields are verbatim from the governance API.
 */
export interface PriceDispute {
  /** Stable identifier assigned at submission time. */
  id: string
  /** The asset pair being challenged, e.g. `"BTC/USD"`. */
  assetPair: string
  /** The disputed aggregated price. */
  disputedPrice: number
  /** Unix timestamp (ms) of the price tick being challenged. */
  priceTimestamp: number
  /** Current lifecycle status. */
  status: DisputeStatus
  /** Address or identifier of the party who raised the dispute. */
  challenger: string
  /** Human-readable description of the discrepancy observed. */
  reason: string
  /**
   * URL or CID pointing to attached evidence (chart exports, raw tick dumps).
   * Null when no evidence was attached.
   */
  evidenceUrl: string | null
  /** Unix timestamp (ms) when the dispute was submitted. */
  createdAt: number
  /** Unix timestamp (ms) when the dispute was closed, or null when still open. */
  resolvedAt: number | null
  /** Final outcome, or null while the dispute is still open. */
  outcome: DisputeOutcome
  /** Reviewer notes written when the dispute was closed. Null until resolved. */
  resolutionNotes: string | null
  /** Sources flagged by the challenger as contributing to the bad price. */
  flaggedSources: string[]
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
