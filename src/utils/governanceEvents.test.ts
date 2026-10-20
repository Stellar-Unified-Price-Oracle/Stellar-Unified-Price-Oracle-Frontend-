import { describe, it, expect } from 'vitest'
import {
  generateStableEventId,
  filterGovernanceEvents,
  governanceEventsToCsv,
  governanceEventsToJson,
  DEFAULT_GOVERNANCE_EVENTS,
  EVENT_TYPE_LABELS,
  GOVERNANCE_EVENT_CSV_HEADERS,
} from './governanceEvents'
import type { GovernanceEvent } from '../types/governanceEvents'

const mockEvents: GovernanceEvent[] = [
  {
    id: 'GEV-PROP-1772000000000-001',
    eventType: 'proposal_created',
    timestamp: 1772000000000,
    actorAddress: 'GCPROP11111111111111111111111111111111111111111111111111',
    actorRole: 'proposer',
    targetEntityId: 'GOV-2026-001',
    description: 'Introduced proposal to register Pyth Network.',
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
    id: 'GEV-PARM-1772200000000-003',
    eventType: 'parameter_updated',
    timestamp: 1772200000000,
    actorAddress: 'GAADMIN7777777777777777777777777777777777777777777777777',
    actorRole: 'admin',
    targetEntityId: 'max_staleness_seconds',
    description: 'Updated max staleness threshold on mainnet.',
    network: 'mainnet',
    txHash: null,
  },
]

describe('governanceEvents utils (#858)', () => {
  it('generates consistent and collision-resistant stable event identifiers', () => {
    const id1 = generateStableEventId('proposal_created', 1772000000000, 1)
    expect(id1).toBe('GEV-PROP-1772000000000-001')

    const id2 = generateStableEventId('vote_cast', 1772100000000, 42)
    expect(id2).toBe('GEV-VOTE-1772100000000-042')

    const id3 = generateStableEventId('parameter_updated', 1772200000000, 999)
    expect(id3).toBe('GEV-PARM-1772200000000-999')
  })

  it('filters events by search query across id, actor, target, and description', () => {
    const byId = filterGovernanceEvents(mockEvents, { searchQuery: 'GEV-VOTE' })
    expect(byId).toHaveLength(1)
    expect(byId[0].id).toBe('GEV-VOTE-1772100000000-002')

    const byActor = filterGovernanceEvents(mockEvents, { searchQuery: 'GAADMIN' })
    expect(byActor).toHaveLength(1)
    expect(byActor[0].actorRole).toBe('admin')

    const byTarget = filterGovernanceEvents(mockEvents, { searchQuery: 'max_staleness' })
    expect(byTarget).toHaveLength(1)
    expect(byTarget[0].targetEntityId).toBe('max_staleness_seconds')

    const byDesc = filterGovernanceEvents(mockEvents, { searchQuery: 'Pyth Network' })
    expect(byDesc).toHaveLength(1)
    expect(byDesc[0].eventType).toBe('proposal_created')
  })

  it('filters events by event type', () => {
    const votes = filterGovernanceEvents(mockEvents, { eventType: 'vote_cast' })
    expect(votes).toHaveLength(1)
    expect(votes[0].eventType).toBe('vote_cast')
  })

  it('filters events by network', () => {
    const mainnetEvents = filterGovernanceEvents(mockEvents, { network: 'mainnet' })
    expect(mainnetEvents).toHaveLength(1)
    expect(mainnetEvents[0].network).toBe('mainnet')

    const testnetEvents = filterGovernanceEvents(mockEvents, { network: 'testnet' })
    expect(testnetEvents).toHaveLength(2)
  })

  it('filters events by time window', () => {
    const now = 1772200000000 + 1000 // 1 second after event 3
    const last24h = filterGovernanceEvents(mockEvents, { timeWindow: '24h' }, now)
    // event 3 was 1s ago (within 24h), event 2 was 100,000s ago (~27h ago)
    expect(last24h).toHaveLength(1)
    expect(last24h[0].id).toBe('GEV-PARM-1772200000000-003')

    const allTime = filterGovernanceEvents(mockEvents, { timeWindow: 'all' }, now)
    expect(allTime).toHaveLength(3)
  })

  it('serializes events to CSV with required headers and escaped fields', () => {
    const csv = governanceEventsToCsv(mockEvents)
    expect(csv).toContain(GOVERNANCE_EVENT_CSV_HEADERS.join(','))
    expect(csv).toContain('GEV-PROP-1772000000000-001,proposal_created')
    expect(csv).toContain('GEV-PARM-1772200000000-003,parameter_updated')
    expect(csv).toContain('mainnet')
  })

  it('serializes events to structured audit JSON document', () => {
    const fixedExportTime = new Date('2026-10-19T12:00:00Z')
    const jsonStr = governanceEventsToJson(mockEvents, fixedExportTime)
    const parsed = JSON.parse(jsonStr)

    expect(parsed.schemaVersion).toBe('1.0.0')
    expect(parsed.source).toBe('stellar-unified-price-oracle')
    expect(parsed.totalRecords).toBe(3)
    expect(parsed.exportedAtUtc).toBe('2026-10-19T12:00:00.000Z')
    expect(parsed.events).toHaveLength(3)
    expect(parsed.events[0].id).toBe('GEV-PROP-1772000000000-001')
    expect(parsed.events[0].timestampIso).toBe(new Date(1772000000000).toISOString())
  })

  it('provides complete canonical default governance events', () => {
    expect(DEFAULT_GOVERNANCE_EVENTS.length).toBeGreaterThan(0)
    for (const ev of DEFAULT_GOVERNANCE_EVENTS) {
      expect(ev.id).toMatch(/^GEV-[A-Z]{4}-\d+-\d{3}$/)
      expect(EVENT_TYPE_LABELS[ev.eventType]).toBeDefined()
      expect(ev.actorAddress).toMatch(/^G[A-Z0-9]{55}$/)
    }
  })
})
