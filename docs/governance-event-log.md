# Filterable Governance Event Log with Stable Identifiers (#858)

## Overview

The **Governance Event Log** subsystem delivers a complete, deterministic, and immutable audit trail of all governance interactions occurring across the Stellar Unified Price Oracle.

Every governance event—from proposal creation and quorum votes to on-chain execution, emergency parameter tuning, price dispute filing, and operator conflict disclosures—is assigned a collision-resistant **Stable Event Identifier (`GEV-*`)** and exposed in an interactive, accessible table equipped with multi-facet filtering and zero-dependency one-click CSV and JSON audit exports.

---

## Stable Identifier Schema

Every governance action receives a unique, predictable, human-readable identifier formatted as:

```text
GEV-{ACTION_PREFIX}-{TIMESTAMP_MS}-{SEQUENCE_NUMBER_3_DIGITS}
```

### Action Type Prefixes
- `proposal_created`: `GEV-PROP-{timestamp}-{seq}` (e.g. `GEV-PROP-1772000000000-001`)
- `vote_cast`: `GEV-VOTE-{timestamp}-{seq}`
- `proposal_passed`: `GEV-PASS-{timestamp}-{seq}`
- `proposal_executed`: `GEV-EXEC-{timestamp}-{seq}`
- `parameter_updated`: `GEV-PARM-{timestamp}-{seq}`
- `dispute_opened`: `GEV-DISP-{timestamp}-{seq}`
- `dispute_resolved`: `GEV-RSLV-{timestamp}-{seq}`
- `disclosure_registered`: `GEV-DISC-{timestamp}-{seq}`

### Identifier Invariants
1. **Deterministic & Monotonic**: Identifiers incorporate the exact millisecond epoch and an auto-incrementing 3-digit sequence counter (`001`, `002`, etc.) within that batch.
2. **Search-Optimized**: Prefixes allow instantaneous filtering of event categories directly in search queries (e.g., searching `GEV-VOTE` or `GEV-EXEC`).
3. **Audit Cross-Referencing**: Identifiers can be cited in compliance reports, dispute records, and multisig transaction notes.

---

## Data Model & Types

Defined in [`src/types/governanceEvents.ts`](../src/types/governanceEvents.ts):

```typescript
export interface GovernanceEvent {
  id: string                   // Stable event identifier (GEV-*)
  eventType: GovernanceEventType
  timestamp: number            // Unix millisecond timestamp
  actorAddress: string         // Validated 56-character Stellar public key (G...)
  actorRole: GovernanceRole    // 'admin' | 'proposer' | 'voter' | 'auditor' | 'public'
  targetEntityId: string       // Target proposal ID, parameter key, or dispute ID
  description: string          // Human-readable summary of the action taken
  network: NetworkId           // 'mainnet' | 'testnet' | 'futurenet'
  txHash: string | null        // Stellar transaction hash when anchored on-chain
  metadata?: Record<string, unknown>
}
```

---

## Export Formats

### 1. CSV Audit Export (`governanceEventsToCsv`)
Generates RFC 4180-compliant CSV format with full quote escaping and standard headers:
- `eventId`: Stable identifier
- `eventType`: Event category
- `timestampUtc`: ISO 8601 UTC timestamp
- `actorAddress`: Stellar public key
- `actorRole`: Assigned role
- `targetEntityId`: Target identifier
- `network`: Target Stellar network
- `txHash`: Transaction hash
- `description`: Action summary

### 2. JSON Audit Export (`governanceEventsToJson`)
Generates an audit-ready JSON payload matching schema version `1.0.0`:
```json
{
  "schemaVersion": "1.0.0",
  "exportedAtUtc": "2026-10-19T21:00:00.000Z",
  "source": "stellar-unified-price-oracle",
  "totalRecords": 6,
  "events": [ ... ]
}
```

---

## Interactive Governance Log Panel

- **Component**: [`GovernanceEventLogPanel`](../src/components/GovernanceEventLogPanel.tsx)
- **Features**:
  - **Live Filter Engine**: Real-time multi-facet filtering by free-text search (matching ID, actor address, target entity, description, and event label), event type selector, and network dropdown.
  - **Counter Badges**: Displays current filtered count vs total records.
  - **Explorer Links**: Provides direct links to Stellar.Expert for transaction hashes and truncated Stellar public addresses.
  - **Client-Side Trigger**: Uses `triggerFileDownload` with Object URLs, avoiding any external server dependencies for instantaneous data delivery.
  - **Accessibility**: Includes ARIA labels, semantic landmark tables (`<section>`, `<table>`, `<thead>`, `<tbody>`), and keyboard-navigable controls.

---

## Verification & Testing

- Unit tests in [`src/utils/governanceEvents.test.ts`](../src/utils/governanceEvents.test.ts) test ID generation, search filtering, network filtering, event type filtering, CSV serialization, and JSON schema output.
- Component tests in [`src/components/GovernanceEventLogPanel.test.tsx`](../src/components/GovernanceEventLogPanel.test.tsx) test rendering, empty states, error handling, live filtering, and file download triggers.
