/**
 * @file Pure utilities for governance event logs with stable identifiers (#858).
 */

import type {
  GovernanceEvent,
  GovernanceEventExportJson,
  GovernanceEventFilters,
  GovernanceEventType,
} from '../types/governanceEvents'
import { toCsv } from './export'

export const EVENT_TYPE_LABELS: Record<GovernanceEventType, string> = {
  proposal_created: 'Proposal Introduced',
  vote_cast: 'Ballot Cast',
  proposal_passed: 'Quorum Passed',
  proposal_executed: 'Proposal Executed',
  parameter_updated: 'Parameter Updated',
  dispute_opened: 'Dispute Opened',
  dispute_resolved: 'Dispute Resolved',
  disclosure_published: 'Disclosure Anchored',
}

export const EVENT_TYPE_BADGES: Record<GovernanceEventType, { bg: string; text: string; border: string }> = {
  proposal_created: { bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/30' },
  vote_cast: { bg: 'bg-cyan-500/15', text: 'text-cyan-300', border: 'border-cyan-500/30' },
  proposal_passed: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  proposal_executed: { bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/30' },
  parameter_updated: { bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30' },
  dispute_opened: { bg: 'bg-rose-500/15', text: 'text-rose-300', border: 'border-rose-500/30' },
  dispute_resolved: { bg: 'bg-green-500/15', text: 'text-green-300', border: 'border-green-500/30' },
  disclosure_published: { bg: 'bg-indigo-500/15', text: 'text-indigo-300', border: 'border-indigo-500/30' },
}

const PREFIX_BY_TYPE: Record<GovernanceEventType, string> = {
  proposal_created: 'PROP',
  vote_cast: 'VOTE',
  proposal_passed: 'PASS',
  proposal_executed: 'EXEC',
  parameter_updated: 'PARM',
  dispute_opened: 'DISP',
  dispute_resolved: 'RSLV',
  disclosure_published: 'DISC',
}

/**
 * Derives a deterministic, collision-resistant stable identifier for a governance event.
 * Format: `GEV-{TYPE_PREFIX}-{TIMESTAMP_MS}-{SEQ_PADDED_3}`
 */
export function generateStableEventId(
  eventType: GovernanceEventType,
  timestampMs: number,
  sequenceNumber: number,
): string {
  const prefix = PREFIX_BY_TYPE[eventType] ?? 'EVNT'
  const seq = String(sequenceNumber).padStart(3, '0')
  return `GEV-${prefix}-${timestampMs}-${seq}`
}

const TIME_WINDOW_MS: Record<'24h' | '7d' | '30d', number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

/**
 * Filters governance events by search query, event type, network, and time window.
 */
export function filterGovernanceEvents(
  events: readonly GovernanceEvent[],
  filters: GovernanceEventFilters,
  now: number = Date.now(),
): GovernanceEvent[] {
  const query = filters.searchQuery?.trim().toLowerCase() ?? ''

  return events.filter((ev) => {
    // 1. Text Search across ID, actor, target entity, and description
    if (query) {
      const matchId = ev.id.toLowerCase().includes(query)
      const matchActor = ev.actorAddress.toLowerCase().includes(query)
      const matchTarget = ev.targetEntityId.toLowerCase().includes(query)
      const matchDesc = ev.description.toLowerCase().includes(query)
      const matchTx = ev.txHash?.toLowerCase().includes(query) ?? false
      const matchTypeLabel = EVENT_TYPE_LABELS[ev.eventType]?.toLowerCase().includes(query) ?? false
      if (!matchId && !matchActor && !matchTarget && !matchDesc && !matchTx && !matchTypeLabel) {
        return false
      }
    }

    // 2. Event Type Filter
    if (filters.eventType && filters.eventType !== 'all' && ev.eventType !== filters.eventType) {
      return false
    }

    // 3. Network Filter
    if (filters.network && filters.network !== 'all' && ev.network !== filters.network) {
      return false
    }

    // 4. Time Window Filter
    if (filters.timeWindow && filters.timeWindow !== 'all') {
      const maxAge = TIME_WINDOW_MS[filters.timeWindow]
      if (now - ev.timestamp > maxAge) {
        return false
      }
    }

    return true
  })
}

export const GOVERNANCE_EVENT_CSV_HEADERS = [
  'eventId',
  'eventType',
  'timestampUtc',
  'actorAddress',
  'actorRole',
  'targetEntityId',
  'network',
  'txHash',
  'description',
]

/**
 * Serializes governance events to a structured CSV format.
 */
export function governanceEventsToCsv(events: readonly GovernanceEvent[]): string {
  const rows = events.map((ev) => ({
    eventId: ev.id,
    eventType: ev.eventType,
    timestampUtc: new Date(ev.timestamp).toISOString(),
    actorAddress: ev.actorAddress,
    actorRole: ev.actorRole,
    targetEntityId: ev.targetEntityId,
    network: ev.network,
    txHash: ev.txHash ?? '',
    description: ev.description,
  }))

  return toCsv(rows, GOVERNANCE_EVENT_CSV_HEADERS)
}

/**
 * Serializes governance events to an audit JSON document.
 */
export function governanceEventsToJson(
  events: readonly GovernanceEvent[],
  exportedAt: Date = new Date(),
): string {
  const payload: GovernanceEventExportJson = {
    schemaVersion: '1.0.0',
    exportedAtUtc: exportedAt.toISOString(),
    source: 'stellar-unified-price-oracle',
    totalRecords: events.length,
    events: events.map((ev) => ({
      ...ev,
      timestampIso: new Date(ev.timestamp).toISOString(),
    })),
  }

  return JSON.stringify(payload, null, 2)
}

/**
 * Triggers a browser download of text/csv/json content.
 */
export function triggerFileDownload(content: string, filename: string, mimeType: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Canonical historical governance events published across testnet and mainnet. */
export const DEFAULT_GOVERNANCE_EVENTS: readonly GovernanceEvent[] = [
  {
    id: 'GEV-PROP-1772000000000-001',
    eventType: 'proposal_created',
    timestamp: 1772000000000,
    actorAddress: 'GCPROP11111111111111111111111111111111111111111111111111',
    actorRole: 'proposer',
    targetEntityId: 'GOV-2026-001',
    description: 'Introduced proposal to register Pyth Network as primary EUR/USD feed source.',
    network: 'testnet',
    txHash: '7a1f5926b482df7924da6e9b48924b1ec5168e82ef62b1a8d003b5785a1ef902',
  },
  {
    id: 'GEV-VOTE-1772100000000-002',
    eventType: 'vote_cast',
    timestamp: 1772100000000,
    actorAddress: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFOGKEYZTOWR4FHCEDGTO',
    actorRole: 'voter',
    targetEntityId: 'GOV-2026-001',
    description: 'Cast 120,000 voting power in favour of GOV-2026-001.',
    network: 'testnet',
    txHash: '1e34b928c0498df89304e28490a09b348912ef62b1a8d003b5785a1ef9034901',
  },
  {
    id: 'GEV-PASS-1772200000000-003',
    eventType: 'proposal_passed',
    timestamp: 1772200000000,
    actorAddress: 'GAADMIN7777777777777777777777777777777777777777777777777',
    actorRole: 'admin',
    targetEntityId: 'GOV-2026-001',
    description: 'Proposal GOV-2026-001 reached 75% quorum threshold and passed.',
    network: 'testnet',
    txHash: '8f00112233445566778899aabbccddeeff00112233445566778899aabbccdde2',
  },
  {
    id: 'GEV-EXEC-1772300000000-004',
    eventType: 'proposal_executed',
    timestamp: 1772300000000,
    actorAddress: 'GAADMIN7777777777777777777777777777777777777777777777777',
    actorRole: 'admin',
    targetEntityId: 'GOV-2026-001',
    description: 'Executed proposal on Soroban contract: Registered Pyth EUR/USD adapter.',
    network: 'testnet',
    txHash: '9a002233445566778899aabbccddeeff00112233445566778899aabbccdde3e1',
  },
  {
    id: 'GEV-PARM-1772400000000-005',
    eventType: 'parameter_updated',
    timestamp: 1772400000000,
    actorAddress: 'GCHAI777777777777777777777777777777777777777777777777777',
    actorRole: 'operator',
    targetEntityId: 'max_staleness_seconds',
    description: 'Updated max staleness threshold for XLM/USD from 60s to 45s.',
    network: 'testnet',
    txHash: 'a12233445566778899aabbccddeeff00112233445566778899aabbccdde4f2a3',
  },
  {
    id: 'GEV-DISP-1772500000000-006',
    eventType: 'dispute_opened',
    timestamp: 1772500000000,
    actorAddress: 'GDAUDIT9999999999999999999999999999999999999999999999999',
    actorRole: 'auditor',
    targetEntityId: 'DSP-2026-012',
    description: 'Challenged outlier tick 0.1412 on BTC/USD from secondary node.',
    network: 'testnet',
    txHash: 'b233445566778899aabbccddeeff00112233445566778899aabbccdde5a3b4c5',
  },
  {
    id: 'GEV-RSLV-1772600000000-007',
    eventType: 'dispute_resolved',
    timestamp: 1772600000000,
    actorAddress: 'GAADMIN7777777777777777777777777777777777777777777777777',
    actorRole: 'admin',
    targetEntityId: 'DSP-2026-012',
    description: 'Resolved dispute DSP-2026-012: Price overturned and excluded from aggregate ring.',
    network: 'testnet',
    txHash: 'c3445566778899aabbccddeeff00112233445566778899aabbccdde6b4c5d6e7',
  },
  {
    id: 'GEV-DISC-1772700000000-008',
    eventType: 'disclosure_published',
    timestamp: 1772700000000,
    actorAddress: 'GBAND333333333333333333333333333333333333333333333333333',
    actorRole: 'operator',
    targetEntityId: 'DISC-2026-002',
    description: 'Operator published disclosure for top-20 Stellar validator node interest.',
    network: 'testnet',
    txHash: 'd45566778899aabbccddeeff00112233445566778899aabbccdde7c5d6e7f8a9',
  },
]
