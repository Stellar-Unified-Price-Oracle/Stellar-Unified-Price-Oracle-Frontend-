/**
 * @file Operator conflict-of-interest disclosures types (#856).
 *
 * Defines the contract for operator disclosures, conflict categories,
 * materiality classifications, and cryptographic/audit provenance records.
 */

export type ConflictCategory =
  | 'liquidity_provider'
  | 'token_holder'
  | 'validator_operator'
  | 'protocol_advisor'
  | 'lending_market_maker'
  | 'other'

export type MaterialityLevel = 'low' | 'medium' | 'high'

export type ProvenanceStatus = 'verified' | 'unverified' | 'expired' | 'disputed'

export type ProvenanceMethod = 'on_chain_attestation' | 'signed_payload' | 'registry_submission'

export interface ProvenanceRecord {
  /** Cryptographic hash of the disclosure document or contract event. */
  attestationHash: string
  /** Stellar address of the key that signed or recorded the attestation. */
  signedBy: string
  /** URL or CID pointing to the full raw disclosure document or tx proof. */
  provenanceUrl: string | null
  /** Current verification status of the provenance record. */
  status: ProvenanceStatus
  /** Unix timestamp (ms) when the attestation was anchored or recorded. */
  timestamp: number
  /** Attestation mechanism used to establish provenance. */
  method: ProvenanceMethod
}

export interface OperatorDisclosure {
  /** Stable identifier for this disclosure, e.g. `"DISC-2026-001"`. */
  id: string
  /** Operator identifier or source ID, e.g. `"chainlink"`, `"band"`, `"dia"`. */
  operatorId: string
  /** Human-readable operator or node runner name. */
  operatorName: string
  /** Stellar public key of the operator. */
  stellarAddress: string
  /** Sponsoring or operating entity/company, or null for independent individuals. */
  organization: string | null
  /** Primary category of the conflict of interest. */
  category: ConflictCategory
  /** Assessed impact/materiality level on price reporting. */
  materiality: MaterialityLevel
  /** Asset pairs potentially affected by this conflict, e.g. `["XLM/USD", "BTC/USD"]`. */
  affectedPairs: string[]
  /** Clear human-readable description of the conflict and mitigating policies. */
  description: string
  /** Optional estimated financial interest or exposure magnitude. */
  financialInterestEstimate: string | null
  /** Unix timestamp (ms) when this disclosure was first registered. */
  disclosedAt: number
  /** Unix timestamp (ms) of the most recent independent review or re-verification. */
  lastVerifiedAt: number | null
  /** Cryptographic and audit provenance metadata. */
  provenance: ProvenanceRecord
}

export interface OperatorDisclosureSummary {
  totalDisclosures: number
  verifiedCount: number
  highMaterialityCount: number
  operatorsWithDisclosures: number
}
