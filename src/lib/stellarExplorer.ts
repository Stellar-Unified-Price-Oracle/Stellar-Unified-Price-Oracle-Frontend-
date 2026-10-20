/**
 * Stellar block explorer link builders for the price Proof tab.
 *
 * Uses stellar.expert, which serves both networks under distinct path
 * prefixes (`public` for mainnet, `testnet` for testnet) — no API key or
 * network-specific base domain required.
 */

export type StellarNetwork = 'testnet' | 'mainnet'

const EXPLORER_NETWORK_SEGMENT: Record<StellarNetwork, string> = {
  testnet: 'testnet',
  mainnet: 'public',
}

function explorerBase(network: StellarNetwork): string {
  return `https://stellar.expert/explorer/${EXPLORER_NETWORK_SEGMENT[network]}`
}

/** Explorer URL for a transaction hash on the given network. */
export function explorerTxUrl(network: StellarNetwork, txHash: string): string {
  return `${explorerBase(network)}/tx/${txHash}`
}

/** Explorer URL for a Soroban contract (`C…`) on the given network. */
export function explorerContractUrl(network: StellarNetwork, contractId: string): string {
  return `${explorerBase(network)}/contract/${contractId}`
}

/** Explorer URL for a ledger sequence on the given network (#854). */
export function explorerLedgerUrl(network: StellarNetwork, ledgerSequence: number | string): string {
  return `${explorerBase(network)}/ledger/${ledgerSequence}`
}

/** Explorer URL for a Stellar account on the given network (#854). */
export function explorerAccountUrl(network: StellarNetwork, accountId: string): string {
  return `${explorerBase(network)}/account/${accountId}`
}

export type OnChainClaimType = 'ledger' | 'tx' | 'contract' | 'account'

/**
 * Builds an explorer URL for any on-chain integrity claim type (#854).
 */
export function explorerClaimUrl(
  network: StellarNetwork,
  type: OnChainClaimType,
  identifier: string | number,
): string {
  switch (type) {
    case 'ledger':
      return explorerLedgerUrl(network, identifier)
    case 'tx':
      return explorerTxUrl(network, String(identifier))
    case 'contract':
      return explorerContractUrl(network, String(identifier))
    case 'account':
      return explorerAccountUrl(network, String(identifier))
    default:
      return `${explorerBase(network)}`
  }
}

/**
 * Validates whether an identifier is structurally valid for an on-chain integrity claim.
 */
export function isValidClaimIdentifier(type: OnChainClaimType, identifier: unknown): boolean {
  if (identifier === null || identifier === undefined || identifier === '') return false
  const str = String(identifier).trim()
  if (str === '') return false

  switch (type) {
    case 'ledger': {
      const num = Number(str)
      return Number.isInteger(num) && num > 0
    }
    case 'tx':
      // 64-char hex transaction hash
      return /^[0-9a-fA-F]{64}$/.test(str)
    case 'contract':
      // Soroban contract ID starts with 'C' (56 chars)
      return /^C[A-Z0-9]{55}$/.test(str)
    case 'account':
      // Stellar public key starts with 'G' (56 chars)
      return /^G[A-Z0-9]{55}$/.test(str)
    default:
      return true
  }
}

/** Human-readable label for a network, used in UI badges. */
export function networkLabel(network: StellarNetwork): string {
  return network === 'mainnet' ? 'Mainnet' : 'Testnet'
}

