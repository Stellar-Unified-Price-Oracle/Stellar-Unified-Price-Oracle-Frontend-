import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import type { PriceProof } from '../types'
import { PriceProofPanel } from './PriceProofPanel'

afterEach(cleanup)

const addToast = vi.fn()
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ addToast }) }))

const refetch = vi.fn()
vi.mock('../hooks/usePriceProof', () => ({ usePriceProof: vi.fn() }))

const mockProof: PriceProof = {
  record: {
    assetPair: 'XLM/USD',
    price: 0.12,
    priceScaled: '1200000',
    priceDecimals: 7,
    timestamp: 1700000000000,
    confidence: 0.95,
    sources: ['chainlink', 'reflector'],
    version: 5,
  },
  contributions: [
    {
      source: 'chainlink',
      price: 0.1199,
      timestamp: 1699999999000,
      signature: 'aa'.repeat(32),
      publicKey: 'bb'.repeat(16),
    },
    {
      source: 'reflector',
      price: 0.1201,
      timestamp: 1699999998000,
      signature: 'cc'.repeat(32),
      publicKey: 'dd'.repeat(16),
    },
  ],
  aggregateSignature: 'ee'.repeat(32),
  contractId: `C${'f'.repeat(55)}`,
  ledgerSequence: 987654,
  transactionHash: 'ab'.repeat(32),
  network: 'testnet',
}

describe('PriceProofPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  it('shows a loading skeleton while the proof is being fetched', async () => {
    const { usePriceProof } = await import('../hooks/usePriceProof')
    vi.mocked(usePriceProof).mockReturnValue({ proof: undefined, loading: true, error: null, refetch })

    render(<PriceProofPanel pair="XLM/USD" latestTimestamp={1700000000000} />)
    expect(screen.getByRole('status', { name: 'Loading on-chain proof' })).toBeInTheDocument()
  })

  it('shows a graceful empty state when no on-chain proof is available', async () => {
    const { usePriceProof } = await import('../hooks/usePriceProof')
    vi.mocked(usePriceProof).mockReturnValue({ proof: null, loading: false, error: null, refetch })

    render(<PriceProofPanel pair="BTC/USD" latestTimestamp={1700000000000} />)
    expect(screen.getByText('On-chain proof unavailable')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an error banner with a retry button on failure', async () => {
    const { usePriceProof } = await import('../hooks/usePriceProof')
    vi.mocked(usePriceProof).mockReturnValue({
      proof: undefined,
      loading: false,
      error: new Error('Network error'),
      refetch,
    })

    render(<PriceProofPanel pair="XLM/USD" latestTimestamp={1700000000000} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Network error')

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('renders the aggregate commitment, explorer links, and per-source contributions', async () => {
    const { usePriceProof } = await import('../hooks/usePriceProof')
    vi.mocked(usePriceProof).mockReturnValue({ proof: mockProof, loading: false, error: null, refetch })

    render(<PriceProofPanel pair="XLM/USD" latestTimestamp={1700000000000} />)

    expect(screen.getByText('Aggregate Commitment')).toBeInTheDocument()
    expect(screen.getByText('Source Contributions')).toBeInTheDocument()
    expect(screen.getByText('chainlink')).toBeInTheDocument()
    expect(screen.getByText('reflector')).toBeInTheDocument()

    const explorerLinks = screen.getAllByRole('link', { name: 'View on explorer' })
    expect(explorerLinks).toHaveLength(2)
    expect(explorerLinks[0]).toHaveAttribute(
      'href',
      expect.stringContaining('stellar.expert/explorer/testnet/contract/'),
    )
    expect(explorerLinks[1]).toHaveAttribute('href', expect.stringContaining('stellar.expert/explorer/testnet/tx/'))
  })

  it('copies the full proof payload to the clipboard', async () => {
    const { usePriceProof } = await import('../hooks/usePriceProof')
    vi.mocked(usePriceProof).mockReturnValue({ proof: mockProof, loading: false, error: null, refetch })

    render(<PriceProofPanel pair="XLM/USD" latestTimestamp={1700000000000} />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy proof payload' }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(JSON.stringify(mockProof, null, 2))
  })

  it('shows a historical record selector when history timestamps are provided', async () => {
    const { usePriceProof } = await import('../hooks/usePriceProof')
    vi.mocked(usePriceProof).mockReturnValue({ proof: mockProof, loading: false, error: null, refetch })

    render(
      <PriceProofPanel
        pair="XLM/USD"
        latestTimestamp={1700000000000}
        historyTimestamps={[1700000000000, 1699999000000, 1699998000000]}
      />,
    )

    expect(screen.getByLabelText('Verify record')).toBeInTheDocument()
  })

  it('does not show a historical record selector with no history to pick from', async () => {
    const { usePriceProof } = await import('../hooks/usePriceProof')
    vi.mocked(usePriceProof).mockReturnValue({ proof: mockProof, loading: false, error: null, refetch })

    render(<PriceProofPanel pair="XLM/USD" latestTimestamp={1700000000000} />)
    expect(screen.queryByLabelText('Verify record')).not.toBeInTheDocument()
  })
})
