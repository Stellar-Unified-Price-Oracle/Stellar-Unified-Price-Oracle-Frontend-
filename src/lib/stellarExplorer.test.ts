import { describe, it, expect } from 'vitest'
import { explorerTxUrl, explorerContractUrl, networkLabel } from './stellarExplorer'

describe('stellarExplorer', () => {
  it('builds a testnet transaction URL', () => {
    expect(explorerTxUrl('testnet', 'abc123')).toBe('https://stellar.expert/explorer/testnet/tx/abc123')
  })

  it('builds a mainnet transaction URL under the "public" segment', () => {
    expect(explorerTxUrl('mainnet', 'abc123')).toBe('https://stellar.expert/explorer/public/tx/abc123')
  })

  it('builds a testnet contract URL', () => {
    expect(explorerContractUrl('testnet', 'CABC123')).toBe('https://stellar.expert/explorer/testnet/contract/CABC123')
  })

  it('builds a mainnet contract URL', () => {
    expect(explorerContractUrl('mainnet', 'CABC123')).toBe('https://stellar.expert/explorer/public/contract/CABC123')
  })

  it('labels networks for display', () => {
    expect(networkLabel('testnet')).toBe('Testnet')
    expect(networkLabel('mainnet')).toBe('Mainnet')
  })
})
