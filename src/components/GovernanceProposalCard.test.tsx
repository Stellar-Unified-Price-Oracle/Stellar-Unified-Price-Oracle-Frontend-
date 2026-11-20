import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { GovernanceProposal } from '../types'
import { GovernanceProposalCard } from './GovernanceProposalCard'

const DAY = 86_400_000
const proposal: GovernanceProposal = {
  id: 'GOV-1',
  title: 'Add Reflector as a primary source for ETH/USD',
  summary: 'Reflector cleared the reliability bar.',
  status: 'active',
  createdAt: Date.now() - DAY,
  closesAt: Date.now() + DAY,
  tally: { for: 60, against: 30, abstain: 10 },
  quorum: 50,
  totalVotingPower: 200,
  category: 'oracle-sources',
  relatedSources: ['reflector'],
}

describe('GovernanceProposalCard', () => {
  it('renders proposed changes alongside the voting rules', () => {
    render(
      <GovernanceProposalCard
        now={Date.now()}
        proposal={{
          ...proposal,
          proposedParameterChanges: [
            {
              paramKey: 'minSources',
              paramName: 'Minimum sources',
              category: 'aggregation',
              currentValue: '2',
              proposedValue: '3',
              diffType: 'modify',
            },
          ],
        }}
      />,
    )
    expect(screen.getByText('Minimum sources')).toBeVisible()
    expect(screen.getByRole('button', { name: /Explain quorum/ })).toBeVisible()
  })
})
