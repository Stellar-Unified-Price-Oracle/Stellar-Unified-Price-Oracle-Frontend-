/**
 * @file useGovernancePermissions hook (#857).
 *
 * Provides real-time governance action gate evaluation based on connected
 * wallet address, active network passphrase, and assigned governance roles.
 */

import { useCallback, useMemo, useState } from 'react'
import { useWallet } from '../wallet/WalletContext'
import { getActiveNetwork } from '../lib/onChainClient'
import { networkFromPassphrase } from '../lib/networkRegistry'
import type { OracleNetwork } from '../lib/contractRegistry'
import type { ActionGateEvaluation, GovernanceAction, GovernanceRole } from '../types/governancePermissions'
import { evaluateGovernanceActionPermission, resolveUserRole } from '../utils/governancePermissions'

export interface UseGovernancePermissionsResult {
  /** The effective role of the user (resolved from address or simulated). */
  currentRole: GovernanceRole
  /** The configured target network for the oracle frontend. */
  activeNetwork: OracleNetwork
  /** The network the user's wallet is currently pointing to. */
  walletNetwork: OracleNetwork | null
  /** The connected wallet address or null. */
  walletAddress: string | null
  /** Whether the user has an active, connected wallet session. */
  isWalletConnected: boolean
  /** Evaluates permissions for a specific governance action. */
  evaluateAction: (action: GovernanceAction) => ActionGateEvaluation
  /** Quick boolean check whether an action is permitted. */
  canPerform: (action: GovernanceAction) => boolean
  /** Optional override to simulate different roles for testing / demonstration. */
  setSimulatedRole: (role: GovernanceRole | null) => void
  /** The simulated role override currently in effect, if any. */
  simulatedRole: GovernanceRole | null
}

export function useGovernancePermissions(targetNetwork?: OracleNetwork): UseGovernancePermissionsResult {
  const [simulatedRole, setSimulatedRole] = useState<GovernanceRole | null>(null)

  // Safe access to wallet context; falls back to disconnected state if outside provider
  let walletAddress: string | null = null
  let walletPassphrase: string | null = null
  let walletStatus: string = 'disconnected'

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const wallet = useWallet()
    walletAddress = wallet.address
    walletPassphrase = wallet.networkPassphrase
    walletStatus = wallet.status
  } catch {
    // Graceful fallback for test environments or isolated component renders
    walletAddress = null
    walletPassphrase = null
    walletStatus = 'disconnected'
  }

  const activeNetwork = targetNetwork ?? getActiveNetwork()
  const walletNetwork = networkFromPassphrase(walletPassphrase)
  const isWalletConnected = Boolean(walletAddress && walletStatus === 'connected')

  const currentRole = useMemo(() => {
    if (simulatedRole) return simulatedRole
    if (!isWalletConnected || !walletAddress) return 'guest'
    return resolveUserRole(walletAddress)
  }, [simulatedRole, isWalletConnected, walletAddress])

  const evaluateAction = useCallback(
    (action: GovernanceAction): ActionGateEvaluation => {
      return evaluateGovernanceActionPermission(
        action,
        {
          address: walletAddress,
          networkPassphrase: walletPassphrase,
          status: walletStatus,
        },
        activeNetwork,
        { simulatedRole: simulatedRole ?? undefined },
      )
    },
    [walletAddress, walletPassphrase, walletStatus, activeNetwork, simulatedRole],
  )

  const canPerform = useCallback(
    (action: GovernanceAction): boolean => {
      return evaluateAction(action).allowed
    },
    [evaluateAction],
  )

  return {
    currentRole,
    activeNetwork,
    walletNetwork,
    walletAddress,
    isWalletConnected,
    evaluateAction,
    canPerform,
    setSimulatedRole,
    simulatedRole,
  }
}
