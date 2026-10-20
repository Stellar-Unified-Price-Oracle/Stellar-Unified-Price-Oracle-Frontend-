/**
 * @file Governance Roles & Network Permission Types (#857).
 *
 * Defines explicit governance roles, gated actions, and evaluation result models.
 */

import type { OracleNetwork } from '../lib/contractRegistry'

export type GovernanceRole =
  | 'admin'
  | 'operator'
  | 'proposer'
  | 'voter'
  | 'auditor'
  | 'guest'

export type GovernanceAction =
  | 'proposal:create'
  | 'proposal:vote'
  | 'proposal:execute'
  | 'parameter:update'
  | 'dispute:raise'
  | 'dispute:resolve'

export interface ActionGateEvaluation {
  /** True if the user meets all network and role requirements. */
  allowed: boolean
  /** Human-readable explanation if action is prohibited. */
  reason: string | null
  /** True if connecting a wallet is required to unlock this action. */
  requiresWallet: boolean
  /** True if user's wallet is connected but on the wrong network passphrase. */
  requiresNetworkSwitch: boolean
  /** True if user's wallet is connected on the correct network, but lacks necessary role. */
  requiresRoleUpgrade: boolean
  /** Roles that permit this action. */
  requiredRoles: readonly GovernanceRole[]
  /** Current effective role of the user. */
  currentRole: GovernanceRole
  /** Current network observed from wallet or null if disconnected. */
  currentNetwork: OracleNetwork | null
  /** Expected target network for the application. */
  expectedNetwork: OracleNetwork
}

export interface RoleRegistryEntry {
  address: string
  role: GovernanceRole
  grantedAt: number
  expiresAt: number | null
}
