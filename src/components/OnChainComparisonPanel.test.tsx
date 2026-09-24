import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { useOnChainComparison } from '../hooks/useOnChainComparison'
import { OnChainComparisonPanel } from './OnChainComparisonPanel'

vi.mock('../hooks/useOnChainComparison', () => ({ useOnChainComparison: vi.fn() }))

afterEach(cleanup)

const registryEntry = {
  network: 'testnet' as const,
  asset: 'XLM',
  contractId: 'CA7FLK2OZGSPYFBYXDWCNMSWG7GRZSYDN4OASS4VJXGW3SX3G3GZASP6',
}

describe('OnChainComparisonPanel', () => {
  it('shows an explanatory state instead of crashing when the asset is unsupported', () => {
    vi.mocked(useOnChainComparison).mockReturnValue({
      supported: false,
      registryEntry: null,
      loading: false,
      error: null,
      divergence: null,
      onChainPublishedAt: null,
      onChainLedger: null,
    })

    render(<OnChainComparisonPanel pair="BTC/USD" offChainPrice={65000} thresholdPercent={1} />)
    expect(screen.getByText(/No on-chain oracle contract is registered/)).toBeInTheDocument()
  })

  it('shows an alert when the on-chain fetch fails', () => {
    vi.mocked(useOnChainComparison).mockReturnValue({
      supported: true,
      registryEntry,
      loading: false,
      error: new Error('boom'),
      divergence: null,
      onChainPublishedAt: null,
      onChainLedger: null,
    })

    render(<OnChainComparisonPanel pair="XLM/USD" offChainPrice={0.12} thresholdPercent={1} />)
    expect(screen.getByRole('alert')).toHaveTextContent('boom')
  })

  it('shows a loading placeholder while the on-chain price loads', () => {
    vi.mocked(useOnChainComparison).mockReturnValue({
      supported: true,
      registryEntry,
      loading: true,
      error: null,
      divergence: null,
      onChainPublishedAt: null,
      onChainLedger: null,
    })

    render(<OnChainComparisonPanel pair="XLM/USD" offChainPrice={0.12} thresholdPercent={1} />)
    expect(screen.getByRole('status', { name: 'Loading on-chain comparison' })).toBeInTheDocument()
  })

  it('renders an in-sync status with no aria-live announcement', () => {
    vi.mocked(useOnChainComparison).mockReturnValue({
      supported: true,
      registryEntry,
      loading: false,
      error: null,
      divergence: {
        offChainPrice: 0.12,
        onChainPrice: 0.12,
        absoluteDelta: 0,
        percentageDelta: 0,
        status: 'in-sync',
      },
      onChainPublishedAt: Date.now() - 30_000,
      onChainLedger: 52_000_100,
    })

    render(<OnChainComparisonPanel pair="XLM/USD" offChainPrice={0.12} thresholdPercent={1} />)
    expect(screen.getByText('In sync')).toBeInTheDocument()
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('')
  })

  it('announces via aria-live and shows a breached badge when the threshold is exceeded', () => {
    vi.mocked(useOnChainComparison).mockReturnValue({
      supported: true,
      registryEntry,
      loading: false,
      error: null,
      divergence: {
        offChainPrice: 0.13,
        onChainPrice: 0.12,
        absoluteDelta: 0.01,
        percentageDelta: 8.33,
        status: 'breached',
      },
      onChainPublishedAt: Date.now() - 30_000,
      onChainLedger: 52_000_100,
    })

    render(<OnChainComparisonPanel pair="XLM/USD" offChainPrice={0.13} thresholdPercent={1} />)
    expect(screen.getByText('Threshold breached')).toBeInTheDocument()
    const liveRegion = screen.getByRole('status', { hidden: true })
    expect(liveRegion).toHaveAttribute('aria-live', 'polite')
    expect(liveRegion.textContent).toMatch(/breached the configured threshold/)
    expect(screen.getByText(/8\.330%/)).toBeInTheDocument()
  })

  it('renders the active registry entry — network, contract, and asset', () => {
    vi.mocked(useOnChainComparison).mockReturnValue({
      supported: true,
      registryEntry,
      loading: false,
      error: null,
      divergence: {
        offChainPrice: 0.12,
        onChainPrice: 0.12,
        absoluteDelta: 0,
        percentageDelta: 0,
        status: 'in-sync',
      },
      onChainPublishedAt: Date.now() - 30_000,
      onChainLedger: 52_000_100,
    })

    render(<OnChainComparisonPanel pair="XLM/USD" offChainPrice={0.12} thresholdPercent={1} />)
    expect(screen.getByText('testnet')).toBeInTheDocument()
    expect(screen.getByText('52,000,100')).toBeInTheDocument()
  })
})
