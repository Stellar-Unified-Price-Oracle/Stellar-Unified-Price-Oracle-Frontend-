import { describe, it, expect } from 'vitest'
import type { GovernanceProposal, ParameterEntry, ParameterChangeLogEntry, TreasuryEntry, PriceDispute } from '../types'
import {
  deadlineState,
  formatVotingPower,
  isStatusStale,
  orderProposals,
  participationPercent,
  quorumState,
  tallyTotal,
  voteShares,
  // #698
  groupParametersByCategory,
  formatChangeLogEntry,
  // #697
  reputationTier,
  formatReputationScore,
  REPUTATION_TIER_LABELS,
  // #696
  netUnclaimedRewards,
  contributionScore,
  // #695
  isDisputeOpen,
  orderDisputes,
  DISPUTE_STATUS_LABELS,
} from './governance'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_700_000_000_000

function makeProposal(overrides: Partial<GovernanceProposal> = {}): GovernanceProposal {
  return {
    id: 'GOV-1',
    title: 'Proposal',
    summary: '',
    status: 'active',
    createdAt: NOW - DAY,
    closesAt: NOW + DAY,
    tally: { for: 10, against: 5, abstain: 5 },
    quorum: 10,
    totalVotingPower: 100,
    category: null,
    relatedSources: [],
    ...overrides,
  }
}

describe('voteShares', () => {
  it('returns percentages that sum to 100', () => {
    const shares = voteShares({ for: 60, against: 30, abstain: 10 })
    expect(shares).not.toBeNull()
    expect(shares!.for).toBeCloseTo(60)
    expect(shares!.against).toBeCloseTo(30)
    expect(shares!.abstain).toBeCloseTo(10)
    expect(shares!.for + shares!.against + shares!.abstain).toBeCloseTo(100)
  })

  it('returns null — not zeros — when nothing has been counted', () => {
    // A zero-width bar reads as "unanimously rejected"; null lets the UI say
    // "no votes recorded" instead.
    expect(voteShares({ for: 0, against: 0, abstain: 0 })).toBeNull()
  })
})

describe('tallyTotal', () => {
  it('sums every option', () => {
    expect(tallyTotal({ for: 3, against: 4, abstain: 5 })).toBe(12)
  })
})

describe('quorumState', () => {
  it('judges quorum on participating power, not on the "for" count', () => {
    // 5 for + 5 against = 10 participating, which meets a quorum of 10 even
    // though only 5 votes support the proposal.
    expect(quorumState({ for: 5, against: 5, abstain: 0 }, 10)).toBe('met')
  })

  it('reports not-met when participation falls short', () => {
    expect(quorumState({ for: 5, against: 2, abstain: 0 }, 10)).toBe('not-met')
  })

  it('reports unknown when no threshold was reported', () => {
    expect(quorumState({ for: 100, against: 0, abstain: 0 }, null)).toBe('unknown')
  })
})

describe('participationPercent', () => {
  it('computes the share of eligible voting power', () => {
    expect(participationPercent({ for: 20, against: 10, abstain: 0 }, 100)).toBeCloseTo(30)
  })

  it('returns null when total voting power is unreported or non-positive', () => {
    expect(participationPercent({ for: 1, against: 0, abstain: 0 }, null)).toBeNull()
    expect(participationPercent({ for: 1, against: 0, abstain: 0 }, 0)).toBeNull()
  })
})

describe('deadlineState', () => {
  it('distinguishes open, closed and unstipulated', () => {
    expect(deadlineState(NOW + 1, NOW)).toBe('open')
    expect(deadlineState(NOW - 1, NOW)).toBe('closed')
    expect(deadlineState(null, NOW)).toBe('unstipulated')
  })
})

describe('isStatusStale', () => {
  it('flags a proposal the API still calls active past its deadline', () => {
    expect(isStatusStale(makeProposal({ status: 'active', closesAt: NOW - 1 }), NOW)).toBe(true)
  })

  it('does not flag an active proposal within its window', () => {
    expect(isStatusStale(makeProposal({ status: 'active', closesAt: NOW + DAY }), NOW)).toBe(false)
  })

  it('never flags a resolved proposal, whatever the clock says', () => {
    expect(isStatusStale(makeProposal({ status: 'passed', closesAt: NOW - DAY }), NOW)).toBe(false)
    expect(isStatusStale(makeProposal({ status: 'rejected', closesAt: NOW - DAY }), NOW)).toBe(false)
  })
})

describe('orderProposals', () => {
  it('puts open votes first, then soonest deadline, with undated last', () => {
    const pending = makeProposal({ id: 'D', status: 'pending', closesAt: NOW + 10 * DAY })
    const openSoon = makeProposal({ id: 'B', status: 'active', closesAt: NOW + DAY })
    const openLater = makeProposal({ id: 'C', status: 'active', closesAt: NOW + 2 * DAY })
    const undated = makeProposal({ id: 'E', status: 'pending', closesAt: null })
    const passed = makeProposal({ id: 'A', status: 'passed', closesAt: NOW - DAY })

    const ordered = orderProposals([pending, undated, passed, openLater, openSoon])

    expect(ordered.map((p) => p.id)).toEqual(['B', 'C', 'D', 'E', 'A'])
  })

  it('is deterministic for equal ranks and deadlines', () => {
    const a = makeProposal({ id: 'A', status: 'passed', closesAt: null })
    const b = makeProposal({ id: 'B', status: 'passed', closesAt: null })
    expect(orderProposals([b, a]).map((p) => p.id)).toEqual(['A', 'B'])
  })

  it('does not mutate the input', () => {
    const input = [makeProposal({ id: 'Z' }), makeProposal({ id: 'A' })]
    orderProposals(input)
    expect(input.map((p) => p.id)).toEqual(['Z', 'A'])
  })
})

describe('formatVotingPower', () => {
  it('groups thousands and caps the fraction', () => {
    expect(formatVotingPower(4_100_000)).toBe('4,100,000')
    expect(formatVotingPower(1234.567)).toBe('1,234.57')
  })
})

// ── #698 Parameter registry ───────────────────────────────────────────────────

function makeParam(overrides: Partial<ParameterEntry> = {}): ParameterEntry {
  return {
    key: 'oracle.weight.chainlink',
    value: '0.4',
    description: 'Chainlink weight',
    owner: 'oracle-team',
    updatedAt: 1_700_000_000_000,
    category: 'weights',
    ...overrides,
  }
}

function makeChangeLogEntry(overrides: Partial<ParameterChangeLogEntry> = {}): ParameterChangeLogEntry {
  return {
    key: 'oracle.weight.chainlink',
    previousValue: '0.3',
    nextValue: '0.4',
    changedAt: 1_700_000_000_000,
    changedBy: 'oracle-team',
    reason: 'Increase weight after reliability review',
    ...overrides,
  }
}

describe('groupParametersByCategory', () => {
  it('groups entries by their category field', () => {
    const params = [
      makeParam({ key: 'a', category: 'weights' }),
      makeParam({ key: 'b', category: 'thresholds' }),
      makeParam({ key: 'c', category: 'weights' }),
    ]
    const groups = groupParametersByCategory(params)
    expect(groups.get('weights')?.map((p) => p.key)).toEqual(['a', 'c'])
    expect(groups.get('thresholds')?.map((p) => p.key)).toEqual(['b'])
  })

  it('returns an empty map for an empty list', () => {
    expect(groupParametersByCategory([]).size).toBe(0)
  })
})

describe('formatChangeLogEntry', () => {
  it('includes the changedBy identity in label when reason is null', () => {
    const entry = makeChangeLogEntry({ reason: null })
    expect(formatChangeLogEntry(entry).label).toBe('oracle-team')
  })

  it('includes both changedBy and reason when reason is present', () => {
    const entry = makeChangeLogEntry({ reason: 'Reliability review' })
    expect(formatChangeLogEntry(entry).label).toContain('oracle-team')
    expect(formatChangeLogEntry(entry).label).toContain('Reliability review')
  })

  it('produces a non-empty changedAtDisplay string', () => {
    const { changedAtDisplay } = formatChangeLogEntry(makeChangeLogEntry())
    expect(changedAtDisplay.length).toBeGreaterThan(0)
  })
})

// ── #697 Reputation ───────────────────────────────────────────────────────────

describe('reputationTier', () => {
  it('assigns elite for score >= 0.9', () => expect(reputationTier(0.95)).toBe('elite'))
  it('assigns strong for score in [0.7, 0.9)', () => expect(reputationTier(0.75)).toBe('strong'))
  it('assigns adequate for score in [0.5, 0.7)', () => expect(reputationTier(0.55)).toBe('adequate'))
  it('assigns weak for score < 0.5', () => expect(reputationTier(0.3)).toBe('weak'))
  it('assigns weak exactly at 0', () => expect(reputationTier(0)).toBe('weak'))
})

describe('REPUTATION_TIER_LABELS', () => {
  it('has a label for every tier', () => {
    const tiers: ReturnType<typeof reputationTier>[] = ['elite', 'strong', 'adequate', 'weak']
    for (const tier of tiers) {
      expect(REPUTATION_TIER_LABELS[tier]).toBeTruthy()
    }
  })
})

describe('formatReputationScore', () => {
  it('formats a score as a percentage with one decimal', () => {
    expect(formatReputationScore(0.874)).toBe('87.4 %')
  })
  it('returns null for a score outside [0, 1]', () => {
    expect(formatReputationScore(-0.1)).toBeNull()
    expect(formatReputationScore(1.01)).toBeNull()
  })
  it('handles boundary values 0 and 1', () => {
    expect(formatReputationScore(0)).toBe('0.0 %')
    expect(formatReputationScore(1)).toBe('100.0 %')
  })
})

// ── #696 Treasury ─────────────────────────────────────────────────────────────

function makeTreasuryEntry(overrides: Partial<TreasuryEntry> = {}): TreasuryEntry {
  return {
    sourceId: 'chainlink',
    accruedRewards: '100.0',
    claimedRewards: '60.0',
    pendingRewards: '10.0',
    uptimeScore: 0.99,
    accuracyScore: 0.95,
    lastSettledAt: 1_700_000_000_000,
    ...overrides,
  }
}

describe('netUnclaimedRewards', () => {
  it('computes accrued minus claimed', () => {
    expect(netUnclaimedRewards(makeTreasuryEntry())).toBe('40')
  })

  it('returns null when accrued is not a finite number', () => {
    expect(netUnclaimedRewards(makeTreasuryEntry({ accruedRewards: 'NaN' }))).toBeNull()
  })

  it('returns null when claimed exceeds accrued (data anomaly)', () => {
    expect(netUnclaimedRewards(makeTreasuryEntry({ accruedRewards: '10', claimedRewards: '20' }))).toBeNull()
  })

  it('returns null for negative amounts', () => {
    expect(netUnclaimedRewards(makeTreasuryEntry({ accruedRewards: '-10', claimedRewards: '0' }))).toBeNull()
  })
})

describe('contributionScore', () => {
  it('averages uptime and accuracy', () => {
    expect(contributionScore(makeTreasuryEntry({ uptimeScore: 1, accuracyScore: 0 }))).toBeCloseTo(0.5)
    expect(contributionScore(makeTreasuryEntry({ uptimeScore: 0.8, accuracyScore: 0.6 }))).toBeCloseTo(0.7)
  })

  it('returns null for scores out of [0, 1]', () => {
    expect(contributionScore(makeTreasuryEntry({ uptimeScore: -0.1 }))).toBeNull()
    expect(contributionScore(makeTreasuryEntry({ accuracyScore: 1.1 }))).toBeNull()
  })
})

// ── #695 Disputes ─────────────────────────────────────────────────────────────

function makeDispute(overrides: Partial<PriceDispute> = {}): PriceDispute {
  return {
    id: 'DISP-1',
    assetPair: 'BTC/USD',
    disputedPrice: 42000,
    priceTimestamp: 1_700_000_000_000,
    status: 'open',
    challenger: 'validator-xyz',
    reason: 'Price deviates 8 % from cross-venue median.',
    evidenceUrl: null,
    createdAt: 1_700_000_000_000,
    resolvedAt: null,
    outcome: null,
    resolutionNotes: null,
    flaggedSources: ['band'],
    ...overrides,
  }
}

describe('isDisputeOpen', () => {
  it('returns true for open and under_review', () => {
    expect(isDisputeOpen(makeDispute({ status: 'open' }))).toBe(true)
    expect(isDisputeOpen(makeDispute({ status: 'under_review' }))).toBe(true)
  })
  it('returns false for resolved and dismissed', () => {
    expect(isDisputeOpen(makeDispute({ status: 'resolved' }))).toBe(false)
    expect(isDisputeOpen(makeDispute({ status: 'dismissed' }))).toBe(false)
  })
})

describe('DISPUTE_STATUS_LABELS', () => {
  it('has a label for every status', () => {
    const statuses: PriceDispute['status'][] = ['open', 'under_review', 'resolved', 'dismissed']
    for (const s of statuses) {
      expect(DISPUTE_STATUS_LABELS[s]).toBeTruthy()
    }
  })
})

describe('orderDisputes', () => {
  it('puts open disputes first, then under_review, then resolved/dismissed', () => {
    const resolved = makeDispute({ id: 'A', status: 'resolved', createdAt: 1_000 })
    const underReview = makeDispute({ id: 'B', status: 'under_review', createdAt: 2_000 })
    const open = makeDispute({ id: 'C', status: 'open', createdAt: 3_000 })
    const dismissed = makeDispute({ id: 'D', status: 'dismissed', createdAt: 4_000 })

    const ordered = orderDisputes([resolved, dismissed, underReview, open])
    expect(ordered.map((d) => d.id)).toEqual(['C', 'B', 'D', 'A'])
  })

  it('within the same rank orders by newest createdAt first', () => {
    const older = makeDispute({ id: 'X', status: 'open', createdAt: 1_000 })
    const newer = makeDispute({ id: 'Y', status: 'open', createdAt: 2_000 })
    expect(orderDisputes([older, newer]).map((d) => d.id)).toEqual(['Y', 'X'])
  })

  it('does not mutate the input', () => {
    const input = [makeDispute({ id: 'Z' }), makeDispute({ id: 'A' })]
    orderDisputes(input)
    expect(input.map((d) => d.id)).toEqual(['Z', 'A'])
  })
})
