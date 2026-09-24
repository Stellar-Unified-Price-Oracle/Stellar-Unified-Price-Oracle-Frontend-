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

/** Human-readable label for a network, used in UI badges. */
export function networkLabel(network: StellarNetwork): string {
  return network === 'mainnet' ? 'Mainnet' : 'Testnet'
}
