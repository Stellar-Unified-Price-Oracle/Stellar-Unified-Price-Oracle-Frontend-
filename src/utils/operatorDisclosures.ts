/**
 * @file Helper utilities for operator conflict-of-interest disclosures (#856).
 */

import type {
  ConflictCategory,
  MaterialityLevel,
  OperatorDisclosure,
  OperatorDisclosureSummary,
  ProvenanceStatus,
} from '../types/operatorDisclosures'

export const CONFLICT_CATEGORY_LABELS: Record<ConflictCategory, string> = {
  liquidity_provider: 'DEX Liquidity Provider',
  token_holder: 'Significant Token Holder',
  validator_operator: 'Stellar Validator Operator',
  protocol_advisor: 'Protocol Advisor / Investor',
  lending_market_maker: 'Lending Market Maker',
  other: 'Other Material Interest',
}

export const MATERIALITY_LABELS: Record<MaterialityLevel, string> = {
  high: 'High Impact',
  medium: 'Medium Impact',
  low: 'Low Impact',
}

export const MATERIALITY_STYLES: Record<MaterialityLevel, { badge: string; border: string }> = {
  high: { badge: 'bg-red-500/15 text-red-300 border-red-500/30', border: 'border-red-500/40' },
  medium: { badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30', border: 'border-amber-500/40' },
  low: { badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30', border: 'border-blue-500/40' },
}

export const PROVENANCE_STATUS_LABELS: Record<ProvenanceStatus, string> = {
  verified: 'Attestation Verified',
  unverified: 'Pending Verification',
  expired: 'Attestation Expired',
  disputed: 'Provenance Disputed',
}

export const PROVENANCE_STATUS_STYLES: Record<ProvenanceStatus, string> = {
  verified: 'bg-green-500/15 text-green-300 border-green-500/30',
  unverified: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  expired: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  disputed: 'bg-red-500/15 text-red-300 border-red-500/30',
}

export interface DisclosureFilters {
  searchQuery?: string
  category?: ConflictCategory | 'all'
  materiality?: MaterialityLevel | 'all'
  provenanceStatus?: ProvenanceStatus | 'all'
  assetPair?: string | 'all'
}

/**
 * Filters operator disclosures against search query, conflict category,
 * materiality level, provenance status, and affected asset pair.
 */
export function filterDisclosures(
  disclosures: readonly OperatorDisclosure[],
  filters: DisclosureFilters,
): OperatorDisclosure[] {
  const query = filters.searchQuery?.trim().toLowerCase() ?? ''

  return disclosures.filter((item) => {
    if (query) {
      const matchName = item.operatorName.toLowerCase().includes(query)
      const matchAddress = item.stellarAddress.toLowerCase().includes(query)
      const matchOrg = item.organization?.toLowerCase().includes(query) ?? false
      const matchDesc = item.description.toLowerCase().includes(query)
      const matchId = item.id.toLowerCase().includes(query)
      if (!matchName && !matchAddress && !matchOrg && !matchDesc && !matchId) {
        return false
      }
    }

    if (filters.category && filters.category !== 'all' && item.category !== filters.category) {
      return false
    }

    if (filters.materiality && filters.materiality !== 'all' && item.materiality !== filters.materiality) {
      return false
    }

    if (filters.provenanceStatus && filters.provenanceStatus !== 'all' && item.provenance.status !== filters.provenanceStatus) {
      return false
    }

    if (filters.assetPair && filters.assetPair !== 'all' && !item.affectedPairs.includes(filters.assetPair)) {
      return false
    }

    return true
  })
}

/**
 * Produces aggregate summary counts for operator disclosures.
 */
export function summarizeDisclosures(disclosures: readonly OperatorDisclosure[]): OperatorDisclosureSummary {
  const uniqueOperators = new Set(disclosures.map((d) => d.operatorId || d.stellarAddress))

  return {
    totalDisclosures: disclosures.length,
    verifiedCount: disclosures.filter((d) => d.provenance.status === 'verified').length,
    highMaterialityCount: disclosures.filter((d) => d.materiality === 'high').length,
    operatorsWithDisclosures: uniqueOperators.size,
  }
}

/**
 * Checks whether an attestation hash meets basic format (64-char hex string)
 * and has a valid verified status.
 */
export function isProvenanceVerified(disclosure: OperatorDisclosure): boolean {
  return (
    disclosure.provenance.status === 'verified' &&
    typeof disclosure.provenance.attestationHash === 'string' &&
    disclosure.provenance.attestationHash.length >= 32
  )
}

/**
 * Canonical sample disclosures published by known oracle network node runners.
 */
export const DEFAULT_OPERATOR_DISCLOSURES: readonly OperatorDisclosure[] = [
  {
    id: 'DISC-2026-001',
    operatorId: 'chainlink-node-alpha',
    operatorName: 'Chainlink Node Alpha',
    stellarAddress: 'GCHAI777777777777777777777777777777777777777777777777777',
    organization: 'Alpha Data Services AG',
    category: 'liquidity_provider',
    materiality: 'medium',
    affectedPairs: ['XLM/USD', 'USDC/USD'],
    description:
      'Operator maintains an automated market maker (AMM) LP position on the Stellar DEX for XLM/USDC to offset rebalancing gas overhead. Mitigation: Automated LP rebalancing is throttled to non-tick intervals.',
    financialInterestEstimate: '~ $120,000 USD TVL',
    disclosedAt: Date.parse('2026-06-01T00:00:00Z'),
    lastVerifiedAt: Date.parse('2026-09-15T12:00:00Z'),
    provenance: {
      attestationHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      signedBy: 'GCHAI777777777777777777777777777777777777777777777777777',
      provenanceUrl: 'https://stellar.expert/explorer/public/tx/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      status: 'verified',
      timestamp: Date.parse('2026-09-15T12:00:00Z'),
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
    affectedPairs: ['BTC/USD', 'ETH/USD'],
    description:
      'Operating team operates a top-20 consensus validator on the Stellar network and runs cross-chain bridges between Stellar and Ethereum. Mitigation: Price feeds use strict quorum consensus across 5 independent sources.',
    financialInterestEstimate: '> $500,000 staked bond',
    disclosedAt: Date.parse('2026-05-10T08:00:00Z'),
    lastVerifiedAt: Date.parse('2026-09-01T10:30:00Z'),
    provenance: {
      attestationHash: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
      signedBy: 'GBAND333333333333333333333333333333333333333333333333333',
      provenanceUrl: 'https://stellar.expert/explorer/public/tx/a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
      status: 'verified',
      timestamp: Date.parse('2026-09-01T10:30:00Z'),
      method: 'on_chain_attestation',
    },
  },
  {
    id: 'DISC-2026-003',
    operatorId: 'dia-stellar-relayer',
    operatorName: 'DIA Association Feed Runner',
    stellarAddress: 'GDIA5555555555555555555555555555555555555555555555555555',
    organization: 'DIA Data Association',
    category: 'protocol_advisor',
    materiality: 'low',
    affectedPairs: ['XLM/USD'],
    description:
      'Lead engineer acts as an unpaid technical advisor to a Stellar DeFi lending protocol integrating the oracle. Mitigation: Advisor holds no equity, tokens, or performance bonuses.',
    financialInterestEstimate: 'Advisory role (uncompensated)',
    disclosedAt: Date.parse('2026-07-20T14:15:00Z'),
    lastVerifiedAt: Date.parse('2026-08-20T09:00:00Z'),
    provenance: {
      attestationHash: 'c242f205a6f0d83b516840393ab5f93f1786f01f8ecfdeb2d772ac1b0cb64700',
      signedBy: 'GDIA5555555555555555555555555555555555555555555555555555',
      provenanceUrl: 'https://github.com/Stellar-Unified-Price-Oracle/operator-attestations/blob/main/attestations/DISC-2026-003.json',
      status: 'verified',
      timestamp: Date.parse('2026-08-20T09:00:00Z'),
      method: 'signed_payload',
    },
  },
]
