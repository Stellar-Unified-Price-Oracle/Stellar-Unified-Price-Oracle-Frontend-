import { describe, it, expect } from 'vitest'
import { isPriceProof, isSourceContribution, onChainRecordToPriceData } from './onChainPrice'
import type { OnChainPriceRecord, PriceProof } from './onChainPrice'

const record: OnChainPriceRecord = {
  assetPair: 'XLM/USD',
  price: 0.12,
  priceScaled: '1200000',
  priceDecimals: 7,
  timestamp: 1700000000000,
  confidence: 0.95,
  sources: ['chainlink', 'reflector'],
  version: 42,
}

const proof: PriceProof = {
  record,
  contributions: [{ source: 'chainlink', price: 0.1199, timestamp: 1699999999000, signature: 'ab', publicKey: 'cd' }],
  aggregateSignature: 'deadbeef',
  contractId: 'CABCDEF',
  ledgerSequence: 123456,
  transactionHash: 'feedface',
  network: 'testnet',
}

describe('onChainRecordToPriceData', () => {
  it('maps an on-chain record onto the frontend PriceData shape', () => {
    expect(onChainRecordToPriceData(record)).toEqual({
      assetPair: 'XLM/USD',
      price: 0.12,
      timestamp: 1700000000000,
      confidence: 0.95,
      sources: ['chainlink', 'reflector'],
    })
  })
})

describe('isSourceContribution', () => {
  it('accepts a well-formed contribution', () => {
    expect(isSourceContribution(proof.contributions[0])).toBe(true)
  })

  it('rejects a contribution missing a signature', () => {
    const { signature, ...rest } = proof.contributions[0]
    void signature
    expect(isSourceContribution(rest)).toBe(false)
  })

  it('rejects non-objects', () => {
    expect(isSourceContribution(null)).toBe(false)
    expect(isSourceContribution('nope')).toBe(false)
  })
})

describe('isPriceProof', () => {
  it('accepts a well-formed proof', () => {
    expect(isPriceProof(proof)).toBe(true)
  })

  it('rejects a proof with a malformed nested record', () => {
    expect(isPriceProof({ ...proof, record: { ...record, price: 'not-a-number' } })).toBe(false)
  })

  it('rejects a proof with an invalid contribution', () => {
    expect(isPriceProof({ ...proof, contributions: [{ source: 'chainlink' }] })).toBe(false)
  })

  it('rejects a proof with an unknown network', () => {
    expect(isPriceProof({ ...proof, network: 'devnet' })).toBe(false)
  })

  it('rejects non-objects', () => {
    expect(isPriceProof(undefined)).toBe(false)
  })
})
