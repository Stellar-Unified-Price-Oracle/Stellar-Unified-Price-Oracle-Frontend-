import freighterApi from '@stellar/freighter-api'
import type { WalletErrorCode } from './types'

/** Thrown by every wrapper below so callers get a single error shape to handle. */
export class WalletError extends Error {
  code: WalletErrorCode

  constructor(code: WalletErrorCode, message: string) {
    super(message)
    this.name = 'WalletError'
    this.code = code
  }
}

/** Freighter reports "not installed" via free-form error messages, not a code. */
function isNotInstalledMessage(message: string | undefined): boolean {
  if (!message) return false
  const normalized = message.toLowerCase()
  return normalized.includes('freighter is not installed') || normalized.includes('not available')
}

function isUserRejectedMessage(message: string | undefined): boolean {
  if (!message) return false
  const normalized = message.toLowerCase()
  return normalized.includes('user declined') || normalized.includes('rejected')
}

function toWalletError(message: string | undefined, fallback: string): WalletError {
  if (isNotInstalledMessage(message)) {
    return new WalletError(
      'not-installed',
      'Freighter wallet extension not found. Install it from freighter.app and reload the page.',
    )
  }
  if (isUserRejectedMessage(message)) {
    return new WalletError('user-rejected', 'Connection request was declined in Freighter.')
  }
  return new WalletError('unknown', message || fallback)
}

/** Whether the Freighter browser extension is present and reachable. */
export async function isFreighterInstalled(): Promise<boolean> {
  const result = await freighterApi.isConnected()
  if (result.error) return false
  return result.isConnected
}

/**
 * Requests account access from Freighter, prompting the user if the site
 * hasn't previously been authorized. Resolves with the connected address.
 */
export async function connectFreighter(): Promise<string> {
  const installed = await isFreighterInstalled()
  if (!installed) {
    throw new WalletError(
      'not-installed',
      'Freighter wallet extension not found. Install it from freighter.app and reload the page.',
    )
  }

  const result = await freighterApi.requestAccess()
  if (result.error) {
    throw toWalletError(result.error.message, 'Failed to connect to Freighter.')
  }
  return result.address
}

/** True when this site was previously granted access, without prompting the user. */
export async function isFreighterAllowed(): Promise<boolean> {
  const result = await freighterApi.isAllowed()
  if (result.error) return false
  return result.isAllowed
}

export interface FreighterNetwork {
  network: string
  networkPassphrase: string
}

export async function getFreighterNetwork(): Promise<FreighterNetwork> {
  const result = await freighterApi.getNetwork()
  if (result.error) {
    throw toWalletError(result.error.message, 'Failed to read the wallet network.')
  }
  return { network: result.network, networkPassphrase: result.networkPassphrase }
}

/** Signs a transaction XDR with the currently connected Freighter account. */
export async function signTransactionWithFreighter(
  transactionXdr: string,
  opts: { networkPassphrase: string; address: string },
): Promise<string> {
  const result = await freighterApi.signTransaction(transactionXdr, opts)
  if (result.error) {
    throw toWalletError(result.error.message, 'Failed to sign the transaction.')
  }
  return result.signedTxXdr
}
