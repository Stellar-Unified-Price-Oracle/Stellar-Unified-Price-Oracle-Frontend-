import { describe, expect, it } from 'vitest'
import {
  getContractAddress,
  getContractRegistryEntry,
  isOracleNetwork,
  listRegisteredAssets,
  UnknownAssetError,
  UnknownNetworkError,
} from './contractRegistry'

describe('contractRegistry', () => {
  it('resolves a known network/asset pair to its registry entry', () => {
    const entry = getContractRegistryEntry('testnet', 'XLM')
    expect(entry).toEqual({
      network: 'testnet',
      asset: 'XLM',
      contractId: expect.stringMatching(/^C[A-Z0-9]{55}$/),
    })
  })

  it('is case-insensitive on the asset code', () => {
    const upper = getContractRegistryEntry('testnet', 'XLM')
    const lower = getContractRegistryEntry('testnet', 'xlm')
    expect(lower).toEqual(upper)
  })

  it('returns just the address via getContractAddress', () => {
    expect(getContractAddress('testnet', 'XLM')).toBe(getContractRegistryEntry('testnet', 'XLM').contractId)
  })

  it('throws a typed UnknownNetworkError for an unrecognised network', () => {
    expect(() => getContractRegistryEntry('devnet', 'XLM')).toThrow(UnknownNetworkError)
  })

  it('throws a typed UnknownAssetError for an asset with no registered contract', () => {
    expect(() => getContractRegistryEntry('testnet', 'DOGE')).toThrow(UnknownAssetError)
  })

  it('does not throw an uncaught/generic error for bad input — only the typed errors', () => {
    try {
      getContractRegistryEntry('nope', 'XLM')
    } catch (err) {
      expect(err).toBeInstanceOf(UnknownNetworkError)
      return
    }
    throw new Error('expected getContractRegistryEntry to throw')
  })

  it('lists registered assets per network', () => {
    expect(listRegisteredAssets('testnet')).toEqual(expect.arrayContaining(['XLM', 'USDC']))
    expect(listRegisteredAssets('futurenet')).toEqual(['XLM'])
  })

  it('rejects an unknown network when listing assets', () => {
    expect(() => listRegisteredAssets('devnet' as never)).toThrow(UnknownNetworkError)
  })

  it('identifies valid oracle network strings', () => {
    expect(isOracleNetwork('mainnet')).toBe(true)
    expect(isOracleNetwork('testnet')).toBe(true)
    expect(isOracleNetwork('futurenet')).toBe(true)
    expect(isOracleNetwork('devnet')).toBe(false)
  })
})
