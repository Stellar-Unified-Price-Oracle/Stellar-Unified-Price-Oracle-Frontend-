import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProposalVotingRulesExplainer } from './ProposalVotingRulesExplainer'
import type { GovernanceProposal } from '../types/governance'

function makeProposal(overrides: Partial<GovernanceProposal> = {}): GovernanceProposal {
  return {
    id: 'PROP-201',
    title: 'Increase Heartbeat Interval',
    summary: 'Proposes increasing heartbeat interval from 30s to 60s.',
    status: 'active',
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    closesAt: Date.now() + 2 * 24 * 60 * 60 * 1000,
    tally: {
      for: 60_000,
      against: 15_000,
      abstain: 5_000,
    },
    quorum: 100_000,
    totalVotingPower: 250_000,
    category: 'aggregation',
    relatedSources: ['chainlink', 'band'],
    ...overrides,
  }
}

describe('ProposalVotingRulesExplainer', () => {
  it('renders closed toggle button by default', () => {
    const proposal = makeProposal()
    render(<ProposalVotingRulesExplainer proposal={proposal} now={Date.now()} />)

    const toggle = screen.getByRole('button', { name: /Explain quorum, eligibility & deadlines/i })
    expect(toggle).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    // Explainer region not yet visible
    expect(screen.queryByRole('region', { name: /Explain quorum/i })).not.toBeInTheDocument()
  })

  it('expands on button click and displays quorum, eligibility, and deadline sections', () => {
    const proposal = makeProposal()
    render(<ProposalVotingRulesExplainer proposal={proposal} now={Date.now()} />)

    const toggle = screen.getByRole('button', { name: /Explain quorum, eligibility & deadlines/i })
    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('1. Voting Quorum')).toBeInTheDocument()
    expect(screen.getByText('2. Voter Eligibility')).toBeInTheDocument()
    expect(screen.getByText('3. Deadlines & Timelines')).toBeInTheDocument()
  })

  it('displays accurate quorum progress and remaining votes calculation', () => {
    // 80,000 participating of 100,000 required quorum -> 80% progress, 20,000 remaining
    const proposal = makeProposal({
      tally: { for: 50_000, against: 20_000, abstain: 10_000 },
      quorum: 100_000,
    })
    render(<ProposalVotingRulesExplainer proposal={proposal} now={Date.now()} />)

    fireEvent.click(screen.getByRole('button', { name: /Explain/i }))

    expect(screen.getByText('Quorum Not Met')).toBeInTheDocument()
    expect(screen.getByText(/80,000 \/ 100,000 votes/i)).toBeInTheDocument()
    expect(screen.getByText('80.0%')).toBeInTheDocument()
    expect(screen.getByText(/20,000 more participating votes needed/i)).toBeInTheDocument()
  })

  it('displays quorum met status when threshold is reached', () => {
    const proposal = makeProposal({
      tally: { for: 80_000, against: 20_000, abstain: 5_000 }, // 105,000 total
      quorum: 100_000,
    })
    render(<ProposalVotingRulesExplainer proposal={proposal} now={Date.now()} />)

    fireEvent.click(screen.getByRole('button', { name: /Explain/i }))

    expect(screen.getByText('Quorum Met')).toBeInTheDocument()
    expect(screen.getByText(/Minimum participation requirement satisfied/i)).toBeInTheDocument()
  })

  it('handles unset quorum gracefully without fabricating numbers', () => {
    const proposal = makeProposal({ quorum: null })
    render(<ProposalVotingRulesExplainer proposal={proposal} now={Date.now()} />)

    fireEvent.click(screen.getByRole('button', { name: /Explain/i }))

    expect(screen.getByText('Quorum Unset')).toBeInTheDocument()
    expect(screen.getByText(/No minimum quorum requirement stipulated/i)).toBeInTheDocument()
  })

  it('explains voter eligibility and participation turnout rate', () => {
    const proposal = makeProposal({
      tally: { for: 60_000, against: 15_000, abstain: 5_000 }, // 80,000
      totalVotingPower: 200_000, // 40% turnout
    })
    render(<ProposalVotingRulesExplainer proposal={proposal} now={Date.now()} />)

    fireEvent.click(screen.getByRole('button', { name: /Explain/i }))

    expect(screen.getByText('40.0% Turnout')).toBeInTheDocument()
    expect(screen.getByText('200,000')).toBeInTheDocument()
    expect(screen.getByText(/Qualification policy:/i)).toBeInTheDocument()
  })

  it('shows urgent badge when deadline is within 24 hours', () => {
    const now = Date.now()
    const proposal = makeProposal({ closesAt: now + 6 * 60 * 60 * 1000 }) // 6 hours remaining
    render(<ProposalVotingRulesExplainer proposal={proposal} now={now} />)

    expect(screen.getByText(/Closing in < 24h/i)).toBeInTheDocument()
  })

  it('surfaces stale contract status caveat if active past deadline', () => {
    const now = Date.now()
    const proposal = makeProposal({
      status: 'active',
      closesAt: now - 3600_000, // closed 1h ago
    })
    render(<ProposalVotingRulesExplainer proposal={proposal} now={now} />)

    fireEvent.click(screen.getByRole('button', { name: /Explain/i }))

    expect(screen.getByText(/Stale contract status caveat:/i)).toBeInTheDocument()
    expect(screen.getByText(/Voting Concluded/i)).toBeInTheDocument()
  })
})
