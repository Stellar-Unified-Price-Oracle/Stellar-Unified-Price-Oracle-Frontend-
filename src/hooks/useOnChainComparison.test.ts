import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useOnChainComparison } from './useOnChainComparison'

vi.mock('./useSwr', () => ({ useSwr: vi.fn() }))
vi.mock('../lib/onChainClient', () => ({
  fetchOnChainPrice: vi.fn(),
  getActiveRegistryEntry: vi.fn(),
}))

describe('useOnChainComparison', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports unsupported for an asset with no registered contract, without throwing', async () => {
    const { getActiveRegistryEntry } = await import('../lib/onChainClient')
    const { UnknownAssetError } = await import('../lib/contractRegistry')
    vi.mocked(getActiveRegistryEntry).mockImplementation(() => {
      throw new UnknownAssetError('testnet', 'BTC')
    })
    const { useSwr } = await import('./useSwr')
    vi.mocked(useSwr).mockReturnValue({
      data: undefined,
      loading: false,
      error: null,
      errorMessage: null,
      isValidating: false,
      refetch: vi.fn(),
    })

    const { result } = renderHook(() => useOnChainComparison('BTC/USD', 65000, 1))

    expect(result.current.supported).toBe(false)
    expect(result.current.registryEntry).toBeNull()
    expect(result.current.divergence).toBeNull()
  })

  it('computes divergence once the on-chain price is loaded', async () => {
    const { getActiveRegistryEntry } = await import('../lib/onChainClient')
    vi.mocked(getActiveRegistryEntry).mockReturnValue({
      network: 'testnet',
      asset: 'XLM',
      contractId: 'CA7FLK2OZGSPYFBYXDWCNMSWG7GRZSYDN4OASS4VJXGW3SX3G3GZASP6',
    })
    const { useSwr } = await import('./useSwr')
    vi.mocked(useSwr).mockReturnValue({
      data: {
        asset: 'XLM',
        network: 'testnet',
        contractId: 'CA7FLK2OZGSPYFBYXDWCNMSWG7GRZSYDN4OASS4VJXGW3SX3G3GZASP6',
        price: 0.1,
        publishedAt: Date.now() - 60_000,
        ledger: 52_000_100,
      },
      loading: false,
      error: null,
      errorMessage: null,
      isValidating: false,
      refetch: vi.fn(),
    })

    const { result } = renderHook(() => useOnChainComparison('XLM/USD', 0.12, 1))

    expect(result.current.supported).toBe(true)
    expect(result.current.divergence).not.toBeNull()
    expect(result.current.divergence?.status).toBe('breached')
    expect(result.current.onChainLedger).toBe(52_000_100)
  })

  it('does not fetch on-chain data (enabled: false) when the asset is unsupported', async () => {
    const { getActiveRegistryEntry } = await import('../lib/onChainClient')
    const { UnknownAssetError } = await import('../lib/contractRegistry')
    vi.mocked(getActiveRegistryEntry).mockImplementation(() => {
      throw new UnknownAssetError('testnet', 'BTC')
    })
    const { useSwr } = await import('./useSwr')
    vi.mocked(useSwr).mockReturnValue({
      data: undefined,
      loading: false,
      error: null,
      errorMessage: null,
      isValidating: false,
      refetch: vi.fn(),
    })

    renderHook(() => useOnChainComparison('BTC/USD', 65000, 1))

    expect(vi.mocked(useSwr)).toHaveBeenCalledWith(
      '',
      expect.any(Function),
      expect.objectContaining({ enabled: false }),
    )
  })
})
