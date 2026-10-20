import { describe, it, expect } from 'vitest'
import {
  explorerTxUrl,
  explorerContractUrl,
  explorerLedgerUrl,
  explorerAccountUrl,
  explorerClaimUrl,
  isValidClaimIdentifier,
  networkLabel,
} from './stellarExplorer'

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

  it('builds a testnet and mainnet ledger URL', () => {
    expect(explorerLedgerUrl('testnet', 1234567)).toBe('https://stellar.expert/explorer/testnet/ledger/1234567')
    expect(explorerLedgerUrl('mainnet', '9876543')).toBe('https://stellar.expert/explorer/public/ledger/9876543')
  })

  it('builds a testnet and mainnet account URL', () => {
    expect(explorerAccountUrl('testnet', 'GB123')).toBe('https://stellar.expert/explorer/testnet/account/GB123')
    expect(explorerAccountUrl('mainnet', 'GB123')).toBe('https://stellar.expert/explorer/public/account/GB123')
  })

  it('builds general claim URLs by claim type', () => {
    expect(explorerClaimUrl('testnet', 'ledger', 500)).toBe('https://stellar.expert/explorer/testnet/ledger/500')
    expect(explorerClaimUrl('testnet', 'tx', 'txhash')).toBe('https://stellar.expert/explorer/testnet/tx/txhash')
    expect(explorerClaimUrl('mainnet', 'contract', 'C123')).toBe('https://stellar.expert/explorer/public/contract/C123')
    expect(explorerClaimUrl('mainnet', 'account', 'G123')).toBe('https://stellar.expert/explorer/public/account/G123')
  })

  describe('isValidClaimIdentifier', () => {
    it('validates ledger sequences (positive integers)', () => {
      expect(isValidClaimIdentifier('ledger', 12345)).toBe(true)
      expect(isValidClaimIdentifier('ledger', '54321')).toBe(true)
      expect(isValidClaimIdentifier('ledger', 0)).toBe(false)
      expect(isValidClaimIdentifier('ledger', -5)).toBe(false)
      expect(isValidClaimIdentifier('ledger', 'abc')).toBe(false)
      expect(isValidClaimIdentifier('ledger', null)).toBe(false)
    })

    it('validates transaction hashes (64 hex characters)', () => {
      const validHash = 'a'.repeat(64)
      expect(isValidClaimIdentifier('tx', validHash)).toBe(true)
      expect(isValidClaimIdentifier('tx', 'short')).toBe(false)
      expect(isValidClaimIdentifier('tx', 'g'.repeat(64))).toBe(false) // non-hex
    })

    it('validates Soroban contract IDs (starts with C, 56 chars)', () => {
      const validContract = 'C' + 'A'.repeat(55)
      expect(isValidClaimIdentifier('contract', validContract)).toBe(true)
      expect(isValidClaimIdentifier('contract', 'C123')).toBe(false)
      expect(isValidClaimIdentifier('contract', 'G' + 'A'.repeat(55))).toBe(false)
    })

    it('validates Stellar account public keys (starts with G, 56 chars)', () => {
      const validAccount = 'G' + 'A'.repeat(55)
      expect(isValidClaimIdentifier('account', validAccount)).toBe(true)
      expect(isValidClaimIdentifier('account', 'GA123')).toBe(false)
      expect(isValidClaimIdentifier('account', 'C' + 'A'.repeat(55))).toBe(false)
    })
  })

  it('labels networks for display', () => {
    expect(networkLabel('testnet')).toBe('Testnet')
    expect(networkLabel('mainnet')).toBe('Mainnet')
  })
})

