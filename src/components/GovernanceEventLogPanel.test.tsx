import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GovernanceEventLogPanel } from './GovernanceEventLogPanel'
import type { GovernanceEvent } from '../types/governanceEvents'
import * as eventUtils from '../utils/governanceEvents'

const mockEvents: GovernanceEvent[] = [
  {
    id: 'GEV-PROP-1772000000000-001',
    eventType: 'proposal_created',
    timestamp: 1772000000000,
    actorAddress: 'GCPROP1111111111111111111111111111111111111111111111111111',
    actorRole: 'proposer',
    targetEntityId: 'GOV-2026-001',
    description: 'Introduced proposal to register Pyth Network.',
    network: 'testnet',
    txHash: '7a1f5926b482df7924da6e9b48924b1ec5168e82ef62b1a8d003b5785a1ef902',
  },
  {
    id: 'GEV-VOTE-1772100000000-002',
    eventType: 'vote_cast',
    timestamp: 1772100000000,
    actorAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFOGKEYZTOWR4FHCEDGTO',
    actorRole: 'voter',
    targetEntityId: 'GOV-2026-001',
    description: 'Cast 120,000 voting power in favour of GOV-2026-001.',
    network: 'testnet',
    txHash: '1e34b928c0498df89304e28490a09b348912ef62b1a8d003b5785a1ef9034901',
  },
]

describe('GovernanceEventLogPanel (#858)', () => {
  it('renders heading, stable identifiers badge, and event counter', () => {
    render(<GovernanceEventLogPanel events={mockEvents} />)
    expect(screen.getByRole('heading', { name: /Governance Event Log & Audit Trail/i })).toBeDefined()
    expect(screen.getByText('Stable Identifiers')).toBeDefined()
    expect(screen.getByText('2 / 2')).toBeDefined()
  })

  it('renders loading state when loading is true and events are empty', () => {
    render(<GovernanceEventLogPanel events={[]} loading={true} />)
    expect(screen.getByText(/Loading governance event audit trail/i)).toBeDefined()
  })

  it('renders error state with retry button', async () => {
    const handleRetry = vi.fn()
    render(<GovernanceEventLogPanel events={[]} error="Failed to fetch audit log" onRetry={handleRetry} />)
    expect(screen.getByText(/Failed to load governance event log: Failed to fetch audit log/i)).toBeDefined()

    const retryBtn = screen.getByRole('button', { name: 'Retry' })
    await userEvent.click(retryBtn)
    expect(handleRetry).toHaveBeenCalledTimes(1)
  })

  it('renders empty state when no events exist', () => {
    render(<GovernanceEventLogPanel events={[]} />)
    expect(screen.getByText('No governance events have been recorded.')).toBeDefined()
  })

  it('renders events in table with stable IDs, event types, and actor roles', () => {
    render(<GovernanceEventLogPanel events={mockEvents} />)
    expect(screen.getByText('GEV-PROP-1772000000000-001')).toBeDefined()
    expect(screen.getByText('GEV-VOTE-1772100000000-002')).toBeDefined()
    expect(screen.getAllByText('Proposal Introduced').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Ballot Cast').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Governance Proposer')).toBeDefined()
    expect(screen.getByText('Eligible Voter')).toBeDefined()
  })

  it('filters events by search query', async () => {
    render(<GovernanceEventLogPanel events={mockEvents} />)
    const searchInput = screen.getByPlaceholderText(/Search event ID, actor, or target/i)
    await userEvent.type(searchInput, 'Ballot')

    expect(screen.queryByText('GEV-PROP-1772000000000-001')).toBeNull()
    expect(screen.getByText('GEV-VOTE-1772100000000-002')).toBeDefined()
  })

  it('filters events by event type dropdown', async () => {
    render(<GovernanceEventLogPanel events={mockEvents} />)
    const typeSelect = screen.getByLabelText(/Filter by Event Type/i)
    await userEvent.selectOptions(typeSelect, 'proposal_created')

    expect(screen.getByText('GEV-PROP-1772000000000-001')).toBeDefined()
    expect(screen.queryByText('GEV-VOTE-1772100000000-002')).toBeNull()
  })

  it('triggers CSV file download when Export CSV is clicked', async () => {
    const triggerSpy = vi.spyOn(eventUtils, 'triggerFileDownload').mockImplementation(() => {})
    render(<GovernanceEventLogPanel events={mockEvents} />)

    const exportCsvBtn = screen.getByRole('button', { name: /Export filtered governance event log as CSV/i })
    await userEvent.click(exportCsvBtn)

    expect(triggerSpy).toHaveBeenCalledTimes(1)
    expect(triggerSpy.mock.calls[0][1]).toContain('.csv')
    expect(triggerSpy.mock.calls[0][2]).toContain('text/csv')
    triggerSpy.mockRestore()
  })

  it('triggers JSON file download when Export JSON is clicked', async () => {
    const triggerSpy = vi.spyOn(eventUtils, 'triggerFileDownload').mockImplementation(() => {})
    render(<GovernanceEventLogPanel events={mockEvents} />)

    const exportJsonBtn = screen.getByRole('button', { name: /Export filtered governance event log as JSON/i })
    await userEvent.click(exportJsonBtn)

    expect(triggerSpy).toHaveBeenCalledTimes(1)
    expect(triggerSpy.mock.calls[0][1]).toContain('.json')
    expect(triggerSpy.mock.calls[0][2]).toContain('application/json')
    triggerSpy.mockRestore()
  })
})
