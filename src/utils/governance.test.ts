import { describe, it, expect } from 'vitest'
import type { GovernanceProposal } from '../types'
import {
  deadlineState,
  formatVotingPower,
  isStatusStale,
  orderProposals,
  participationPercent,
  quorumState,
  tallyTotal,
  voteShares,
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
