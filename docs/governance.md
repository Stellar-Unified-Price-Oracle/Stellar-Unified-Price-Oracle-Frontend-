# Governance System & Parameter Diffs

The Governance dashboard (`/governance`) surfaces community-driven decisions, oracle parameter management, source performance, and integrity claims on the Stellar Unified Price Oracle.

## Proposed Parameter Changes & Side-by-Side Diffs (#851)

When community governance proposals propose modifications to system parameters (such as minimum active sources, deviation thresholds, heartbeat intervals, or provider weights), voters can inspect the exact changes using a side-by-side diff.

### Data Model

Proposals report proposed parameter changes via `proposedParameterChanges`:

```typescript
export interface ProposedParameterChange {
  /** Stable parameter key, e.g. "aggregator.minSources" */
  paramKey: string;
  /** Human-readable parameter label */
  paramName: string;
  /** Functional category, e.g. "aggregation", "thresholds", "weights" */
  category: string;
  /** Current value in the active registry, or null for new parameters */
  currentValue: string | null;
  /** Proposed new value if the proposal passes, or null for removals */
  proposedValue: string | null;
  /** Change classification: 'modify' | 'add' | 'remove' */
  diffType: ParameterDiffType;
  /** Rationale or governance note */
  rationale?: string | null;
  /** Measurement unit (e.g. "sources", "seconds", "%") */
  unit?: string | null;
}
```

### UI Features

- **Side-by-Side Diff View**: Side-by-side columns presenting the current registry value (highlighted with strike-through when modified or removed) against the proposed governance value.
- **Unified Diff Toggle**: An accessible view mode toggle allowing voters on mobile or narrow viewports to switch to an inline unified diff.
- **Delta Calculations**: Automatic calculation of numerical deltas and percentage changes (e.g., `+1 (+33.3%)` or `-30s (-50.0%)`).
- **Category Filtering**: Dropdown filter to inspect changes grouped by functional subsystem.
- **Explicit Missing States**: If a current parameter is not yet registered or unconfigured, the UI displays "None (new parameter)" rather than fabricating a default zero.
- **Accessibility**: Screen-reader labels (`<span className="sr-only">Old value:</span>`, `<span className="sr-only">New value:</span>`) and keyboard-operable view controls.

## Voting Quorum, Eligibility, and Deadlines (#853)

To ensure high voter comprehension and compliance with Stellar governance standards, proposal views incorporate an interactive voting rules explainer (`ProposalVotingRulesExplainer`):

### 1. Voting Quorum
- **Threshold Rules**: Quorum enforces the minimum total participating voting power (sum of For, Against, and Abstain votes) required for a ballot to be legally valid.
- **Progress Tracking**: Dynamic progress bar indicating percentage achieved toward quorum and exact remaining votes needed to validate the result.
- **Consequences**: If the deadline passes without achieving quorum, the proposal fails automatically, regardless of the majority ratio.

### 2. Voter Eligibility
- **Snapshot Policy**: Eligible voting power is frozen at proposal snapshot creation (`createdAt`). Tokens or oracle operator rights acquired after the snapshot timestamp do not grant voting power for the active ballot.
- **Turnout Percentage**: Real-time ratio of participating voting power relative to total eligible network voting power (`participationPercent`).
- **Unreported Handling**: When total voting power is unpopulated by the contract, the UI displays "Not reported by contract" rather than assuming 0% or 100%.

### 3. Deadlines & Timelines
- **Time Zones**: Deadlines are presented with full precision in both local user time and international UTC format.
- **Urgency Warning**: Active ballots closing in less than 24 hours display an animated urgent badge (`Closing in < 24h`).
- **Stale State Caveat**: If an active status persists after the deadline has elapsed, the UI flags the result as provisional pending on-chain reconciliation.
- **Execution Timelock**: Details the mandatory 24-hour grace/timelock period between a passed vote and execution of parameters on-chain.

## Source Certification Status, Evidence, and Expiry Dates (#855)

The Governance dashboard features a dedicated **Source certifications** panel (`SourceCertificationPanel`) providing visibility into the technical credentials, security audits, and regulatory certifications held by price oracle feed providers (e.g. Chainlink, Reflector, Binance, Coinbase, Kraken).

### Data Model

Source certifications are reported via `SourceCertification`:

```typescript
export interface SourceCertification {
  /** Stable identifier for the certificate, e.g. "cert-chainlink-soc2-2026" */
  id: string;
  /** Target oracle source name */
  source: string;
  /** Name of the certification (e.g. "SOC 2 Type II", "ISO 27001", "Stellar Attestation") */
  name: string;
  /** Functional category, e.g. "security", "infrastructure", "compliance" */
  category: string;
  /** Certifying body or independent auditor */
  issuer: string;
  /** Operational status: 'active' | 'expiring-soon' | 'expired' | 'revoked' | 'suspended' */
  status: CertificationStatus;
  /** Issue timestamp (ms) */
  issuedAt: number;
  /** Expiration timestamp (ms), or null for perpetual attestations */
  expiresAt: number | null;
  /** Verifiable audit documents, links, and SHA-256 digests */
  evidence: CertificationEvidence[];
  /** Optional summary of audit scope */
  description?: string | null;
  /** Optional revocation timestamp (ms) */
  revokedAt?: number | null;
  /** Reason recorded if certification was revoked */
  revocationReason?: string | null;
}
```

### UI & Verification Features

- **Status Derivation**: Operational status is dynamically derived based on the current timestamp, remaining days to expiry, and revocation flags.
- **Expiry Tracking & Warnings**:
  - Expiries within 30 days are highlighted with an `Expiring Soon` badge and amber countdown (e.g. `Expires in 10d`).
  - Lapsed certifications display an `Expired` badge with elapsed duration (e.g. `Expired 3d ago`).
  - Perpetual certifications without expiration dates display `Perpetual (No Expiry)`.
- **Verifiable Evidence & Audit Proofs**:
  - Each certificate contains an expandable evidence list with links to public audit reports or attestations (`rel="noopener noreferrer"`, `target="_blank"`).
  - Evidence items include cryptographic SHA-256 digests with a one-click copy button for tamper-proof verification.
- **Revocation Transparency**:
  - Explicit revocation notices display the date of revocation and reason (e.g. "Infrastructure key migration failed"), preventing compromised credentials from appearing valid.
- **Search & Filters**:
  - Instant client-side search across source names, certification titles, issuers, and descriptions.
  - Multi-dimensional filtering by derived status and functional category.


