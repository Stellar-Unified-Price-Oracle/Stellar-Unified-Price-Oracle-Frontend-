/**
 * @file GovernanceActionGate (#857).
 *
 * Gating wrapper that protects governance actions by explicit role and network
 * permissions. Renders actionable feedback (connect wallet, switch network, role upgrade)
 * when criteria are not met.
 */

import { memo, type ReactElement, type ReactNode } from 'react'
import type { GovernanceAction, GovernanceRole } from '../types/governancePermissions'
import { useGovernancePermissions } from '../hooks/useGovernancePermissions'
import {
  GOVERNANCE_ACTION_LABELS,
  GOVERNANCE_ROLE_BADGES,
  GOVERNANCE_ROLE_LABELS,
} from '../utils/governancePermissions'
import type { OracleNetwork } from '../lib/contractRegistry'

export interface GovernanceRoleBadgeProps {
  role: GovernanceRole
  className?: string
}

export const GovernanceRoleBadge = memo(function GovernanceRoleBadge({
  role,
  className = '',
}: GovernanceRoleBadgeProps): ReactElement {
  const badgeStyle = GOVERNANCE_ROLE_BADGES[role]
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border} ${className}`}
      title={`Current Governance Role: ${GOVERNANCE_ROLE_LABELS[role]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {GOVERNANCE_ROLE_LABELS[role]}
    </span>
  )
})

export interface GovernanceActionGateProps {
  action: GovernanceAction
  targetNetwork?: OracleNetwork
  simulatedRole?: GovernanceRole
  children: (props: {
    allowed: boolean
    disabledReason: string | null
    currentRole: GovernanceRole
  }) => ReactNode
  showExplainer?: boolean
  className?: string
}

export const GovernanceActionGate = memo(function GovernanceActionGate({
  action,
  targetNetwork,
  simulatedRole,
  children,
  showExplainer = true,
  className = '',
}: GovernanceActionGateProps): ReactElement {
  const { evaluateAction } = useGovernancePermissions(targetNetwork)
  const evaluation = evaluateAction(action)
  const effectiveAllowed = simulatedRole ? evaluation.requiredRoles.includes(simulatedRole) : evaluation.allowed
  const effectiveRole = simulatedRole ?? evaluation.currentRole

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {children({
        allowed: effectiveAllowed,
        disabledReason: effectiveAllowed ? null : evaluation.reason,
        currentRole: effectiveRole,
      })}

      {!effectiveAllowed && showExplainer && evaluation.reason && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-800/80 border border-gray-700/60 rounded px-2.5 py-1"
        >
          <svg
            className="w-3.5 h-3.5 text-amber-400 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="leading-tight">{evaluation.reason}</span>
        </div>
      )}
    </div>
  )
})
