import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OperatorDisclosuresPanel } from './OperatorDisclosuresPanel'
import type { OperatorDisclosure } from '../types/operatorDisclosures'

const mockDisclosures: OperatorDisclosure[] = [
  {
    id: 'DISC-2026-001',
    operatorId: 'chainlink-node-alpha',
    operatorName: 'Chainlink Node Alpha',
    stellarAddress: 'GCHAI777777777777777777777777777777777777777777777777777',
    organization: 'Alpha Data Services AG',
    category: 'liquidity_provider',
    materiality: 'medium',
    affectedPairs: ['XLM/USD', 'USDC/USD'],
    description: 'Operator maintains an AMM LP position on Stellar DEX for XLM/USDC.',
    financialInterestEstimate: '~ $120,000 USD TVL',
    disclosedAt: 1770000000000,
    lastVerifiedAt: 1775000000000,
    provenance: {
      attestationHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      signedBy: 'GCHAI777777777777777777777777777777777777777777777777777',
      provenanceUrl: 'https://stellar.expert/explorer/public/tx/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      status: 'verified',
      timestamp: 1775000000000,
      method: 'on_chain_attestation',
    },
  },
  {
    id: 'DISC-2026-002',
    operatorId: 'band-validator-core',
    operatorName: 'Band Protocol Node 3',
    stellarAddress: 'GBAND333333333333333333333333333333333333333333333333333',
    organization: 'Band Infrastructure Ltd',
    category: 'validator_operator',
    materiality: 'high',
    affectedPairs: ['BTC/USD'],
    description: 'Operating team operates a top-20 consensus validator on Stellar.',
    financialInterestEstimate: '> $500,000 staked bond',
    disclosedAt: 1769000000000,
    lastVerifiedAt: 1774000000000,
    provenance: {
      attestationHash: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
      signedBy: 'GBAND333333333333333333333333333333333333333333333333333',
      provenanceUrl: 'https://stellar.expert/explorer/public/tx/a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
      status: 'verified',
      timestamp: 1774000000000,
      method: 'on_chain_attestation',
    },
  },
]

describe('OperatorDisclosuresPanel (#856)', () => {
  it('renders heading and summary cards', () => {
    render(<OperatorDisclosuresPanel disclosures={mockDisclosures} />)
    expect(screen.getByRole('heading', { name: /Operator Conflict-of-Interest Disclosures/i })).toBeDefined()
    expect(screen.getByText('Total Disclosures')).toBeDefined()
    expect(screen.getByText('Verified On-Chain')).toBeDefined()
    expect(screen.getByText('High Materiality')).toBeDefined()
  })

  it('renders loading state when loading is true and disclosures are empty', () => {
    render(<OperatorDisclosuresPanel disclosures={[]} loading={true} />)
    expect(screen.getByText(/Loading operator disclosures/i)).toBeDefined()
  })

  it('renders error banner and invokes retry callback', async () => {
    const handleRetry = vi.fn()
    render(<OperatorDisclosuresPanel disclosures={[]} error="Network unreachable" onRetry={handleRetry} />)
    expect(screen.getByText(/Failed to load operator disclosures: Network unreachable/i)).toBeDefined()

    const retryBtn = screen.getByRole('button', { name: /Retry/i })
    await userEvent.click(retryBtn)
    expect(handleRetry).toHaveBeenCalledTimes(1)
  })

  it('renders empty state when no disclosures match', () => {
    render(<OperatorDisclosuresPanel disclosures={[]} />)
    expect(screen.getByText(/No operator disclosures are on record/i)).toBeDefined()
  })

  it('renders disclosure cards with operator details', () => {
    render(<OperatorDisclosuresPanel disclosures={mockDisclosures} />)
    expect(screen.getByText('Chainlink Node Alpha')).toBeDefined()
    expect(screen.getByText('Band Protocol Node 3')).toBeDefined()
    expect(screen.getByText(/Alpha Data Services AG/)).toBeDefined()
    expect(screen.getAllByText('High Impact').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Medium Impact').length).toBeGreaterThan(0)
  })

  it('filters disclosures by search query', async () => {
    render(<OperatorDisclosuresPanel disclosures={mockDisclosures} />)
    const searchInput = screen.getByPlaceholderText(/Search operator or address/i)
    await userEvent.type(searchInput, 'Band')

    expect(screen.getByText('Band Protocol Node 3')).toBeDefined()
    expect(screen.queryByText('Chainlink Node Alpha')).toBeNull()
  })

  it('filters disclosures by category dropdown', async () => {
    render(<OperatorDisclosuresPanel disclosures={mockDisclosures} />)
    const categorySelect = screen.getByLabelText(/Filter by Category/i)
    await userEvent.selectOptions(categorySelect, 'validator_operator')

    expect(screen.getByText('Band Protocol Node 3')).toBeDefined()
    expect(screen.queryByText('Chainlink Node Alpha')).toBeNull()
  })

  it('expands disclosure card to reveal cryptographic provenance details', async () => {
    render(<OperatorDisclosuresPanel disclosures={mockDisclosures} />)
    const expandButtons = screen.getAllByRole('button', { name: /View audit details/i })
    await userEvent.click(expandButtons[0])

    expect(screen.getByText('Full Attestation Hash:')).toBeDefined()
    expect(screen.getByText('Signed By (Stellar Public Key):')).toBeDefined()
    expect(screen.getByRole('link', { name: mockDisclosures[0].provenance.provenanceUrl! })).toBeDefined()
  })
})
