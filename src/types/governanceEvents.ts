/**
 * @file Governance Event Log Types with Stable Identifiers (#858).
 */

import type { OracleNetwork } from '../lib/contractRegistry'
import type { GovernanceRole } from './governancePermissions'

export type GovernanceEventType =
  | 'proposal_created'
  | 'vote_cast'
  | 'proposal_passed'
  | 'proposal_executed'
  | 'parameter_updated'
  | 'dispute_opened'
  | 'dispute_resolved'
  | 'disclosure_published'

export interface GovernanceEvent {
  /** Stable, deterministic identifier, e.g. "GEV-PROP-1770000000000-001". */
  id: string
  /** Classification of the governance lifecycle event. */
  eventType: GovernanceEventType
  /** Unix timestamp (ms) when the event occurred. */
  timestamp: number
  /** Stellar address of the initiator or contract caller. */
  actorAddress: string
  /** Effective role of the actor at the time of the event. */
  actorRole: GovernanceRole
  /** Identifier of the target proposal, parameter key, dispute ID, or disclosure ID. */
  targetEntityId: string
  /** Human-readable event description. */
  description: string
  /** Network where the event transpired. */
  network: OracleNetwork
  /** Stellar transaction hash or ledger sequence proof if applicable. */
  txHash: string | null
  /** Optional auxiliary payload attributes. */
  metadata?: Record<string, string | number | boolean | null>
}

export interface GovernanceEventFilters {
  searchQuery?: string
  eventType?: GovernanceEventType | 'all'
  network?: OracleNetwork | 'all'
  timeWindow?: '24h' | '7d' | '30d' | 'all'
}

export interface GovernanceEventExportJson {
  schemaVersion: string
  exportedAtUtc: string
  source: string
  totalRecords: number
  events: Array<GovernanceEvent & { timestampIso: string }>
}
