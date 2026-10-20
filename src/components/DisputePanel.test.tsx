import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PriceDispute } from '../types'
import { DisputePanel } from './DisputePanel'

const NOW = 1_700_000_000_000
const DAY = 86_400_000

function makeDispute(overrides: Partial<PriceDispute> = {}): PriceDispute {
  return {
    id: 'DSP-1',
    assetPair: 'XLM/USD',
    contestedAt: NOW - DAY,
    contestedPrice: '0.1234',
    challengerPrice: null,
    challenger: 'GA_CHALLENGER_1234567890',
    status: 'open',
    openedAt: NOW - DAY,
    resolutionDeadline: NOW + DAY,
    rationale: 'Outlier price detected from source.',
    impliedSources: ['reflector'],
    evidence: [],
    comments: [],
    resolutionNote: null,
    ...overrides,
  }
}

describe('DisputePanel', () => {
  it('renders the section heading', () => {
    render(<DisputePanel disputes={[]} now={NOW} />)
    expect(screen.getByRole('heading', { name: 'Price disputes' })).toBeDefined()
  })

  it('shows empty state when no disputes', () => {
    render(<DisputePanel disputes={[]} now={NOW} />)
    expect(screen.getByText('No disputes have been recorded.')).toBeDefined()
  })

  it('renders dispute assetPair and contested price', () => {
    render(<DisputePanel disputes={[makeDispute()]} now={NOW} />)
    expect(screen.getByText(/XLM\/USD/)).toBeDefined()
    expect(screen.getByText(/0\.1234/)).toBeDefined()
  })

  it('shows the dispute status label', () => {
    render(<DisputePanel disputes={[makeDispute({ status: 'under_review' })]} now={NOW} />)
    expect(screen.getByText('Under review')).toBeDefined()
  })

  it('shows open dispute count badge', () => {
    render(
      <DisputePanel
        disputes={[makeDispute({ status: 'open' }), makeDispute({ id: 'DSP-2', status: 'resolved_upheld' })]}
        now={NOW}
      />,
    )
    expect(screen.getByText(/1 open/)).toBeDefined()
  })

  it('shows a deadline-breached caveat for an open dispute past its deadline', () => {
    render(<DisputePanel disputes={[makeDispute({ resolutionDeadline: NOW - 1 })]} now={NOW} />)
    expect(screen.getByRole('note')).toBeDefined()
  })

  it('shows resolution note for a resolved dispute', () => {
    render(
      <DisputePanel
        disputes={[makeDispute({ status: 'resolved_upheld', resolutionNote: 'Price confirmed correct.' })]}
        now={NOW}
      />,
    )
    expect(screen.getByText('Price confirmed correct.')).toBeDefined()
  })

  it('expands to show evidence and comments on toggle click', async () => {
    const user = userEvent.setup()
    const dispute = makeDispute({
      evidence: [
        {
          id: 'ev1',
          submittedBy: 'GA_SUBMITTER',
          submittedAt: NOW,
          description: 'On-chain proof of deviation.',
          uri: 'ipfs://QmFakeHash',
        },
      ],
      comments: [
        {
          id: 'c1',
          author: 'GA_AUDITOR',
          postedAt: NOW,
          body: 'Confirmed: source was offline.',
        },
      ],
    })
    render(<DisputePanel disputes={[dispute]} now={NOW} />)
    await user.click(screen.getByRole('button', { name: /Show details/ }))
    expect(screen.getByText('On-chain proof of deviation.')).toBeDefined()
    expect(screen.getByText('Confirmed: source was offline.')).toBeDefined()
  })

  it('shows implied sources', () => {
    render(<DisputePanel disputes={[makeDispute({ impliedSources: ['chainlink', 'band'] })]} now={NOW} />)
    expect(screen.getByText('chainlink')).toBeDefined()
    expect(screen.getByText('band')).toBeDefined()
  })

  it('shows "No open disputes" when all are resolved', () => {
    render(
      <DisputePanel disputes={[makeDispute({ status: 'resolved_overturned' })]} now={NOW} />,
    )
    expect(screen.getByText(/No open disputes/)).toBeDefined()
  })

  it('renders status transition timeline with chronological milestones and aria-current="step"', () => {
    const dispute = makeDispute({
      id: 'DSP-TIMELINE',
      status: 'under_review',
      statusTransitions: [
        {
          status: 'open',
          timestamp: NOW - 100_000,
          actor: 'GA_SUBMITTER_123',
          note: 'Challenger submitted stake and bond.',
        },
        {
          status: 'under_review',
          timestamp: NOW - 50_000,
          actor: 'GA_ORACLE_COUNCIL',
          note: 'Council initiated review quorum.',
        },
      ],
    })

    render(<DisputePanel disputes={[dispute]} now={NOW} />)

    expect(screen.getByRole('list', { name: 'Status transitions for dispute DSP-TIMELINE' })).toBeDefined()
    expect(screen.getByText('Stage: Open')).toBeDefined()
    expect(screen.getByText('Stage: Under review')).toBeDefined()
    expect(screen.getByText('Challenger submitted stake and bond.')).toBeDefined()
    expect(screen.getByText('Council initiated review quorum.')).toBeDefined()

    const listItems = screen.getAllByRole('listitem')
    const timelineItems = listItems.filter((li) => li.getAttribute('aria-current') !== null)
    expect(timelineItems).toHaveLength(1)
    expect(timelineItems[0].getAttribute('aria-current')).toBe('step')
    expect(timelineItems[0].textContent).toContain('Current Status')
  })
})

