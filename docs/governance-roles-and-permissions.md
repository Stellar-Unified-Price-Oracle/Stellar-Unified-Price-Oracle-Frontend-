# Governance Roles & Network Permissions Gating (#857)

## Overview

Governance actions on the Stellar Unified Price Oracle (submitting community proposals, voting on active ballots, executing approved parameter upgrades, and raising or resolving disputes) require strict access control. Operating on the wrong network or allowing unverified accounts to trigger governance actions risks state desynchronization and unauthorized operations.

Issue #857 introduces **Role-Based and Network-Gated Access Control (RBAC)** across the governance subsystem, ensuring that:
1. **Network Passphrase Matches**: The connected wallet's live network passphrase must match the application's active network (`mainnet`, `testnet`, or `futurenet`) verified via `assertWalletOnAppNetwork`.
2. **Explicit Role Eligibility**: The connected address must hold the explicit role required for the requested action.
3. **Accessible Gating Guidance**: Prohibited actions render clear accessible guidance (`aria-disabled="true"`, reason messages for disconnected wallets, network mismatches, and insufficient roles).

---

## Role & Permission Matrix

| Role | Label | Description | Permitted Governance Actions |
|---|---|---|---|
| `admin` | System Administrator | Core oracle governors with multisig / contract execution authority. | `proposal:create`, `proposal:vote`, `proposal:execute`, `parameter:update`, `dispute:raise`, `dispute:resolve` |
| `operator` | Feed Operator | Registered node runner publishing ticks or AMM liquidity. | `proposal:create`, `proposal:vote`, `parameter:update`, `dispute:raise` |
| `proposer` | Governance Proposer | Account with required stake/reputation to introduce community motions. | `proposal:create`, `proposal:vote`, `dispute:raise` |
| `voter` | Eligible Voter | Connected account holding voting balance on the current network. | `proposal:vote`, `dispute:raise` |
| `auditor` | Dispute Auditor | Independent dispute reviewer qualified to assess price challenges. | `dispute:raise`, `dispute:resolve` |
| `guest` | Guest (Read-Only) | Disconnected or unverified session. | None (Read-only observation) |

---

## Network Pinning Safeguards

All governance mutations enforce network alignment:
- The wallet network passphrase is read via Freighter API (`getFreighterNetwork`).
- Compared against the canonical `NETWORK_PASSPHRASES[expectedNetwork]`.
- If a mismatch occurs, the action is disabled and displays:
  > *"Network mismatch: Action requires Stellar [network], but wallet is connected to [other network]. Switch network in Freighter."*

---

## Developer API & Components

### `useGovernancePermissions(targetNetwork?)`
React hook located at [`src/hooks/useGovernancePermissions.ts`](../src/hooks/useGovernancePermissions.ts):
```typescript
const { currentRole, activeNetwork, isWalletConnected, evaluateAction, canPerform } = useGovernancePermissions()
```

### `<GovernanceActionGate>`
Component wrapper at [`src/components/GovernanceActionGate.tsx`](../src/components/GovernanceActionGate.tsx):
```tsx
<GovernanceActionGate action="proposal:vote">
  {({ allowed, disabledReason }) => (
    <button type="button" disabled={!allowed} title={disabledReason ?? ''}>
      Vote
    </button>
  )}
</GovernanceActionGate>
```

### `<GovernanceRoleBadge>`
Visual indicator displaying the user's active role with distinct color coding:
```tsx
<GovernanceRoleBadge role={currentRole} />
```

---

## Testing & Quality Assurance

- **Unit tests**: [`src/utils/governancePermissions.test.ts`](../src/utils/governancePermissions.test.ts)
- **Hook tests**: [`src/hooks/useGovernancePermissions.test.ts`](../src/hooks/useGovernancePermissions.test.ts)
- **Component gate tests**: [`src/components/GovernanceActionGate.test.tsx`](../src/components/GovernanceActionGate.test.tsx)
- **Governance dashboard integration**: [`src/pages/Governance.test.tsx`](../src/pages/Governance.test.tsx)
