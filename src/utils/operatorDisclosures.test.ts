import { describe, it, expect } from 'vitest'
import {
  filterDisclosures,
  summarizeDisclosures,
  isProvenanceVerified,
  DEFAULT_OPERATOR_DISCLOSURES,
  CONFLICT_CATEGORY_LABELS,
  MATERIALITY_LABELS,
  PROVENANCE_STATUS_LABELS,
} from './operatorDisclosures'
import type { OperatorDisclosure } from '../types/operatorDisclosures'

const mockDisclosures: OperatorDisclosure[] = [
  {
    id: 'DISC-001',
    operatorId: 'op-stellar-pulse',
    operatorName: 'Stellar Pulse Validator Node',
    stellarAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFOGKEYZTOWR4FHCEDGTO',
    organization: 'Pulse Data Labs',
    category: 'liquidity_provider',
    materiality: 'high',
    affectedPairs: ['XLM/USD'],
    description: 'Operator entity commits liquidity to Stellar DEX AMM pool.',
    financialInterestEstimate: '$50,000 AMM Pool',
    disclosedAt: 1704067200000,
    lastVerifiedAt: 1704153600000,
    provenance: {
      attestationHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
      signedBy: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFOGKEYZTOWR4FHCEDGTO',
      provenanceUrl: 'https://stellar.expert/explorer/public/tx/mock-tx-1',
      status: 'verified',
      timestamp: 1704067200000,
      method: 'on_chain_attestation',
    },
  },
  {
    id: 'DISC-002',
    operatorId: 'op-lumens-feed',
    operatorName: 'Lumens Direct Feed',
    stellarAddress: 'GAHK7EEG2WWHVKDNT4CEQFZGKF2LGDSW2IVM4S5DP42RBW3K6BTODB4A',
    organization: null,
    category: 'token_holder',
    materiality: 'low',
    affectedPairs: ['BTC/USD'],
    description: 'Operator treasury holds non-voting digital asset reserves.',
    financialInterestEstimate: '1.2 BTC',
    disclosedAt: 1709251200000,
    lastVerifiedAt: null,
    provenance: {
      attestationHash: 'b2c3d4e5f6a10718293a4b5c6d7e8f90123456789abcdef0123456789abcdef1',
      signedBy: 'GAHK7EEG2WWHVKDNT4CEQFZGKF2LGDSW2IVM4S5DP42RBW3K6BTODB4A',
      provenanceUrl: 'https://stellar.expert/explorer/public/tx/mock-tx-2',
      status: 'unverified',
      timestamp: 1709251200000,
      method: 'signed_payload',
    },
  },
  {
    id: 'DISC-003',
    operatorId: 'op-anchor-bridge',
    operatorName: 'Anchor Bridge Node',
    stellarAddress: 'GCFXHS4GMXTGVCYA7ABS3BJLVHGOSSGS2WIGZAOFD7XMZLTVDTWJYZAH',
    organization: 'Anchor FinTech Ltd',
    category: 'validator_operator',
    materiality: 'medium',
    affectedPairs: ['EUR/USD', 'XLM/USD'],
    description: 'Node operator acts as quorum set validator.',
    financialInterestEstimate: null,
    disclosedAt: 1711929600000,
    lastVerifiedAt: 1712016000000,
    provenance: {
      attestationHash: 'c3d4e5f6a1b20718293a4b5c6d7e8f90123456789abcdef0123456789abcdef2',
      signedBy: 'GCFXHS4GMXTGVCYA7ABS3BJLVHGOSSGS2WIGZAOFD7XMZLTVDTWJYZAH',
      provenanceUrl: null,
      status: 'verified',
      timestamp: 1711929600000,
      method: 'registry_submission',
    },
  },
]

describe('operatorDisclosures utils (#856)', () => {
  it('has valid labels for categories, materiality, and provenance status', () => {
    expect(CONFLICT_CATEGORY_LABELS.liquidity_provider).toBe('DEX Liquidity Provider')
    expect(MATERIALITY_LABELS.high).toBe('High Impact')
    expect(PROVENANCE_STATUS_LABELS.verified).toBe('Attestation Verified')
  })

  it('correctly validates provenance status with isProvenanceVerified', () => {
    expect(isProvenanceVerified(mockDisclosures[0])).toBe(true)
    expect(isProvenanceVerified(mockDisclosures[1])).toBe(false)
  })

  it('correctly calculates summary metrics', () => {
    const summary = summarizeDisclosures(mockDisclosures)
    expect(summary.totalDisclosures).toBe(3)
    expect(summary.verifiedCount).toBe(2)
    expect(summary.highMaterialityCount).toBe(1)
    expect(summary.operatorsWithDisclosures).toBe(3)
  })

  it('filters disclosures by search query across name, description, address, and hash', () => {
    const byName = filterDisclosures(mockDisclosures, { searchQuery: 'Pulse' })
    expect(byName).toHaveLength(1)
    expect(byName[0].id).toBe('DISC-001')

    const byAddr = filterDisclosures(mockDisclosures, { searchQuery: 'GAHK7EEG' })
    expect(byAddr).toHaveLength(1)
    expect(byAddr[0].id).toBe('DISC-002')

    const byOrg = filterDisclosures(mockDisclosures, { searchQuery: 'Anchor FinTech' })
    expect(byOrg).toHaveLength(1)
    expect(byOrg[0].id).toBe('DISC-003')

    const byDesc = filterDisclosures(mockDisclosures, { searchQuery: 'AMM pool' })
    expect(byDesc).toHaveLength(1)
    expect(byDesc[0].id).toBe('DISC-001')
  })

  it('filters disclosures by category', () => {
    const res = filterDisclosures(mockDisclosures, { category: 'liquidity_provider' })
    expect(res).toHaveLength(1)
    expect(res[0].category).toBe('liquidity_provider')
  })

  it('filters disclosures by materiality', () => {
    const res = filterDisclosures(mockDisclosures, { materiality: 'high' })
    expect(res).toHaveLength(1)
    expect(res[0].id).toBe('DISC-001')
  })

  it('filters disclosures by provenance status', () => {
    const res = filterDisclosures(mockDisclosures, { provenanceStatus: 'verified' })
    expect(res).toHaveLength(2)
    expect(res.map((d) => d.id)).toEqual(['DISC-001', 'DISC-003'])
  })

  it('filters disclosures by affected asset pair', () => {
    const res = filterDisclosures(mockDisclosures, { assetPair: 'XLM/USD' })
    expect(res).toHaveLength(2)
    expect(res.map((d) => d.id)).toEqual(['DISC-001', 'DISC-003'])
  })

  it('returns canonical default operator disclosures', () => {
    expect(DEFAULT_OPERATOR_DISCLOSURES.length).toBeGreaterThan(0)
    for (const d of DEFAULT_OPERATOR_DISCLOSURES) {
      expect(d.id).toBeDefined()
      expect(d.stellarAddress).toMatch(/^G[A-Z0-9]{55}$/)
      expect(d.provenance.attestationHash).toMatch(/^[0-9a-f]{64}$/i)
      expect(d.provenance.status).toBe('verified')
    }
  })
})
