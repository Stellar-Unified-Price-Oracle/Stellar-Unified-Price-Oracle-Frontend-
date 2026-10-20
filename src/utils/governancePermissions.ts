/**
 * @file Helper utilities and permission evaluator for Governance Roles & Network Gating (#857).
 */

import { NETWORK_PASSPHRASES, networkFromPassphrase } from '../lib/networkRegistry'
import type { OracleNetwork } from '../lib/contractRegistry'
import type {
  ActionGateEvaluation,
  GovernanceAction,
  GovernanceRole,
} from '../types/governancePermissions'

export const GOVERNANCE_ROLE_LABELS: Record<GovernanceRole, string> = {
  admin: 'System Administrator',
  operator: 'Feed Operator',
  proposer: 'Governance Proposer',
  voter: 'Eligible Voter',
  auditor: 'Dispute Auditor',
  guest: 'Guest (Read Only)',
}

export const GOVERNANCE_ROLE_BADGES: Record<GovernanceRole, { bg: string; text: string; border: string }> = {
  admin: { bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/30' },
  operator: { bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/30' },
  proposer: { bg: 'bg-cyan-500/15', text: 'text-cyan-300', border: 'border-cyan-500/30' },
  voter: { bg: 'bg-green-500/15', text: 'text-green-300', border: 'border-green-500/30' },
  auditor: { bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30' },
  guest: { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' },
}

export const GOVERNANCE_ACTION_LABELS: Record<GovernanceAction, string> = {
  'proposal:create': 'Create Proposal',
  'proposal:vote': 'Cast Ballot',
  'proposal:execute': 'Execute Proposal',
  'parameter:update': 'Update Parameter',
  'dispute:raise': 'Raise Price Dispute',
  'dispute:resolve': 'Resolve Dispute',
}

export const ACTION_REQUIRED_ROLES: Record<GovernanceAction, readonly GovernanceRole[]> = {
  'proposal:create': ['admin', 'operator', 'proposer'],
  'proposal:vote': ['admin', 'operator', 'proposer', 'voter'],
  'proposal:execute': ['admin'],
  'parameter:update': ['admin', 'operator'],
  'dispute:raise': ['admin', 'operator', 'proposer', 'voter', 'auditor'],
  'dispute:resolve': ['admin', 'auditor'],
}

/** Pre-registered test and canonical oracle addresses mapped to explicit roles */
export const CANONICAL_ROLE_REGISTRY: Record<string, GovernanceRole> = {
  // Admin keys
  GAADMIN7777777777777777777777777777777777777777777777777: 'admin',
  // Operator keys
  GCHAI777777777777777777777777777777777777777777777777777: 'operator',
  GBAND333333333333333333333333333333333333333333333333333: 'operator',
  GDIA5555555555555555555555555555555555555555555555555555: 'operator',
  // Proposer keys
  GCPROP11111111111111111111111111111111111111111111111111: 'proposer',
  // Auditor keys
  GDAUDIT9999999999999999999999999999999999999999999999999: 'auditor',
}

/**
 * Resolves the governance role for a given public Stellar address.
 * By default, any connected address without a higher grant receives 'voter' status.
 * Disconnected addresses return 'guest'.
 */
export function resolveUserRole(address: string | null | undefined): GovernanceRole {
  if (!address || address.trim() === '') return 'guest'
  return CANONICAL_ROLE_REGISTRY[address] ?? 'voter'
}

export interface WalletStateCheck {
  address: string | null
  networkPassphrase: string | null
  status?: string
}

export interface PermissionEvaluationOptions {
  simulatedRole?: GovernanceRole
}

/**
 * Evaluates whether the active wallet and role permissions permit a specific governance action.
 */
export function evaluateGovernanceActionPermission(
  action: GovernanceAction,
  walletState: WalletStateCheck,
  expectedNetwork: OracleNetwork,
  options: PermissionEvaluationOptions = {},
): ActionGateEvaluation {
  const currentNetwork = networkFromPassphrase(walletState.networkPassphrase)
  const isConnected = Boolean(walletState.address && walletState.status !== 'disconnected')
  const baseRole = resolveUserRole(walletState.address)
  const currentRole = options.simulatedRole ?? (isConnected ? baseRole : 'guest')
  const requiredRoles = ACTION_REQUIRED_ROLES[action]

  // 1. Check wallet connection
  if (!isConnected || !walletState.address) {
    return {
      allowed: false,
      reason: `Wallet connection required to ${GOVERNANCE_ACTION_LABELS[action].toLowerCase()}. Connect your Stellar wallet to continue.`,
      requiresWallet: true,
      requiresNetworkSwitch: false,
      requiresRoleUpgrade: false,
      requiredRoles,
      currentRole: 'guest',
      currentNetwork,
      expectedNetwork,
    }
  }

  // 2. Check network passphrase matching
  const expectedPassphrase = NETWORK_PASSPHRASES[expectedNetwork]
  if (!walletState.networkPassphrase || walletState.networkPassphrase !== expectedPassphrase) {
    const networkName = currentNetwork ? `Stellar ${currentNetwork}` : 'unsupported network'
    return {
      allowed: false,
      reason: `Network mismatch: Action requires Stellar ${expectedNetwork}, but wallet is connected to ${networkName}. Switch network in Freighter.`,
      requiresWallet: false,
      requiresNetworkSwitch: true,
      requiresRoleUpgrade: false,
      requiredRoles,
      currentRole,
      currentNetwork,
      expectedNetwork,
    }
  }

  // 3. Check role eligibility
  if (!requiredRoles.includes(currentRole)) {
    const roleTitle = GOVERNANCE_ROLE_LABELS[currentRole]
    const allowedTitles = requiredRoles.map((r) => GOVERNANCE_ROLE_LABELS[r]).join(' or ')
    return {
      allowed: false,
      reason: `Role restriction: Current role "${roleTitle}" does not have permission to ${GOVERNANCE_ACTION_LABELS[action].toLowerCase()}. Requires: ${allowedTitles}.`,
      requiresWallet: false,
      requiresNetworkSwitch: false,
      requiresRoleUpgrade: true,
      requiredRoles,
      currentRole,
      currentNetwork,
      expectedNetwork,
    }
  }

  // All checks satisfied
  return {
    allowed: true,
    reason: null,
    requiresWallet: false,
    requiresNetworkSwitch: false,
    requiresRoleUpgrade: false,
    requiredRoles,
    currentRole,
    currentNetwork,
    expectedNetwork,
  }
}
