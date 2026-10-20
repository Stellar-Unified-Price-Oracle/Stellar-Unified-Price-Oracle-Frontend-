# Operator Conflict-of-Interest Disclosures with Clear Provenance (#856)

## Overview

Oracle feed operators and node runners frequently engage in secondary market activity—such as providing liquidity to decentralized exchange (DEX) pools, running consensus validators, managing digital asset reserves, or advising integrated protocols. When undisclosed, these positions create perceived or actual conflicts of interest that could influence reporting integrity.

The **Operator Conflict-of-Interest Disclosures** subsystem exposes formal, auditable disclosures published by feed operators with verifiable cryptographic and on-chain provenance.

---

## Data Model

The schema is defined in [`src/types/operatorDisclosures.ts`](../src/types/operatorDisclosures.ts) and validated in [`src/api/schemas.ts`](../src/api/schemas.ts).

### Conflict Categories
- `liquidity_provider`: Automated Market Maker (AMM) LP or order-book liquidity provisioning on the Stellar DEX.
- `token_holder`: Significant treasury holding or non-voting digital asset reserves in tracked assets.
- `validator_operator`: Operation of a core tier-1 or quorum-set consensus validator on the Stellar network.
- `protocol_advisor`: Formal advisory, governance, or consulting arrangement with protocols consuming the feed.
- `lending_market_maker`: Market making on lending, borrowing, or perpetual derivative platforms.
- `other`: Other material financial exposure.

### Materiality Classifications
- `high`: Substantial capital commitment (> $250k equivalent) or direct consensus voting influence.
- `medium`: Moderate exposure ($50k–$250k equivalent) with operational mitigation safeguards.
- `low`: Minor exposure (< $50k equivalent) or uncompensated technical advisory.

### Cryptographic Provenance Record
Each disclosure is anchored with an immutable cryptographic record:
```typescript
export interface ProvenanceRecord {
  attestationHash: string // SHA-256 hash of the signed disclosure document
  signedBy: string        // Stellar public key (G...) of the operator's attestation key
  provenanceUrl: string | null // External link to on-chain transaction or ledger proof
  status: 'verified' | 'unverified' | 'expired' | 'disputed'
  timestamp: number       // Unix timestamp (ms) when the attestation was anchored
  method: 'on_chain_attestation' | 'signed_payload' | 'registry_submission'
}
```

---

## UI Components & Integration

- **[`OperatorDisclosuresPanel`](../src/components/OperatorDisclosuresPanel.tsx)**:
  - Mounted directly within the **Governance Dashboard** ([`src/pages/Governance.tsx`](../src/pages/Governance.tsx)).
  - Includes real-time search across operator name, Stellar address, organization, description, and attestation hashes.
  - Multi-facet filters for Conflict Category, Materiality Level, Provenance Status, and Affected Asset Pair.
  - Aggregated metric counters: Total Disclosures, Verified On-Chain percentage, and High Materiality items.
  - Expandable drawer on each disclosure to inspect the full raw cryptographic attestation hash, signer key, and Stellar expert/explorer link.

---

## API Endpoints & Resilience

- **REST Endpoint**: `GET /api/governance/operator-disclosures`
- **Fallback**: In air-gapped, offline, or newly launched environments where the API endpoint is not yet live, [`fetchOperatorDisclosures`](../src/api/rest.ts) gracefully serves the canonical registered operator disclosures (`DEFAULT_OPERATOR_DISCLOSURES`), ensuring that users always have visibility into active oracle node runner attestations.

---

## Verification & Testing

- Unit tests for filtering, summary derivation, and verification logic: [`src/utils/operatorDisclosures.test.ts`](../src/utils/operatorDisclosures.test.ts)
- Component integration and accessibility tests: [`src/components/OperatorDisclosuresPanel.test.tsx`](../src/components/OperatorDisclosuresPanel.test.tsx)
- Governance dashboard integration tests: [`src/pages/Governance.test.tsx`](../src/pages/Governance.test.tsx)
