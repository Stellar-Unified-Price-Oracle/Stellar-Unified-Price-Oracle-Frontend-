import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../test/render'
import { checkAccessibility } from '../test/accessibility'
import { clearSwrCache } from '../hooks/useSwr'
import {
  fetchGovernanceProposals,
  fetchPriceHistory,
  fetchSourceReputations,
  fetchTreasury,
  fetchDisputes,
  fetchParameterRegistry,
} from '../api/rest'
import { GovernanceProposalCard } from '../components/GovernanceProposalCard'
import type { GovernanceProposal } from '../types'
import { Governance } from './Governance'

vi.mock('../api/rest', () => ({
  fetchGovernanceProposals: vi.fn(),
  fetchPriceHistory: vi.fn(),
  fetchSourceReputations: vi.fn(),
  fetchTreasury: vi.fn(),
  fetchDisputes: vi.fn(),
  fetchParameterRegistry: vi.fn(),
}))

vi.mock('../context/PriceContext', () => ({
  usePriceContext: vi.fn(() => ({ prices: [] })),
}))

const DAY = 24 * 60 * 60 * 1000

function proposal(overrides: Partial<GovernanceProposal> = {}): GovernanceProposal {
  return {
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
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  clearSwrCache()
  vi.mocked(fetchPriceHistory).mockImplementation((pair: string) => Promise.resolve({ pair, history: [] }))
  // New governance panel fetchers — resolve to empty arrays so panels render
  // their "no data" states rather than failing and emitting unexpected alerts.
  vi.mocked(fetchSourceReputations).mockResolvedValue([])
  vi.mocked(fetchTreasury).mockResolvedValue([])
  vi.mocked(fetchDisputes).mockResolvedValue([])
  vi.mocked(fetchParameterRegistry).mockResolvedValue([])
})

afterEach(cleanup)

describe('Governance page', () => {
  it('renders proposals returned by the governance API', async () => {
    vi.mocked(fetchGovernanceProposals).mockResolvedValue([proposal()])

    renderWithProviders(<Governance />)

    expect(await screen.findByText('Add Reflector as a primary source for ETH/USD')).toBeInTheDocument()
    expect(screen.getByText('Voting open')).toBeInTheDocument()
    expect(screen.getByText(/Quorum met/)).toBeInTheDocument()
    // Counts are rendered verbatim from the API payload.
    const tally = screen.getByRole('region', { name: 'Vote tally for GOV-1' })
    expect(within(tally).getByText('60')).toBeInTheDocument()
    expect(within(tally).getByText('30')).toBeInTheDocument()
    expect(within(tally).getByText('10')).toBeInTheDocument()
  })

  it('shows explicit unavailable states instead of implying zero support', async () => {
    vi.mocked(fetchGovernanceProposals).mockResolvedValue([
      proposal({
        id: 'GOV-2',
        status: 'pending',
        closesAt: null,
        tally: { for: 0, against: 0, abstain: 0 },
        quorum: null,
        totalVotingPower: null,
      }),
    ])

    renderWithProviders(<Governance />)

    expect(await screen.findByText('No votes recorded for this proposal.')).toBeInTheDocument()
    expect(screen.getByText('Quorum threshold not reported')).toBeInTheDocument()
    expect(screen.getByText('Participation not reported')).toBeInTheDocument()
    expect(screen.getByText('No deadline reported')).toBeInTheDocument()
  })

  it('flags a proposal the API still calls active after its deadline', async () => {
    vi.mocked(fetchGovernanceProposals).mockResolvedValue([proposal({ closesAt: Date.now() - 6 * 60 * 60 * 1000 })])

    renderWithProviders(<Governance />)

    const note = await screen.findByRole('note')
    expect(note).toHaveTextContent(/deadline has passed/)
    expect(note).toHaveTextContent(/provisional/)
    // The status is shown as reported, not rewritten to a guessed outcome.
    expect(screen.getByText('Voting open')).toBeInTheDocument()
  })

  it('distinguishes a load failure from "no proposals"', async () => {
    vi.mocked(fetchGovernanceProposals).mockRejectedValue(new Error('network down'))

    renderWithProviders(<Governance />)

    // There may be multiple alerts if other panels also fail, so scope to the
    // proposals section's error message specifically.
    const alertText = await screen.findByText(/Could not load governance proposals/)
    expect(alertText).toBeInTheDocument()
    expect(alertText.closest('[role="alert"]')).toHaveTextContent(/not a report that there are no decisions pending/)
    expect(screen.queryByText(/returned no proposals/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('states plainly when the API returned nothing', async () => {
    vi.mocked(fetchGovernanceProposals).mockResolvedValue([])

    renderWithProviders(<Governance />)

    expect(await screen.findByText(/returned no proposals/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('labels the provenance of both halves of the dashboard', async () => {
    vi.mocked(fetchGovernanceProposals).mockResolvedValue([proposal()])

    renderWithProviders(<Governance />)
    await screen.findByText('Add Reflector as a primary source for ETH/USD')

    const provenance = screen.getByRole('region', { name: 'How to read these figures' })
    expect(provenance).toHaveTextContent(/not.*the aggregator/i)
    expect(provenance).toHaveTextContent(/read-only mirror/i)
    // The leaderboard's latency column is relabelled because the value is
    // derived from staleness rather than measured.
    expect(screen.getByText('Observed lag (ms)')).toBeInTheDocument()
  })

  it('has no accessibility violations while loading', async () => {
    // Keep the fetch pending so the assertion runs against a stable loading DOM.
    vi.mocked(fetchGovernanceProposals).mockImplementation(() => new Promise(() => {}))
    await checkAccessibility(<Governance />)
  })
})

describe('GovernanceProposalCard', () => {
  it('has no accessibility violations', async () => {
    await checkAccessibility(<GovernanceProposalCard proposal={proposal()} now={Date.now()} />)
  })
})
