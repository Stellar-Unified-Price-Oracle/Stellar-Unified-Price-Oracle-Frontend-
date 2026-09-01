import { Horizon, Networks } from '@stellar/stellar-sdk'

const HORIZON_URLS: Record<string, string> = {
  [Networks.PUBLIC]: 'https://horizon.stellar.org',
  [Networks.TESTNET]: 'https://horizon-testnet.stellar.org',
  [Networks.FUTURENET]: 'https://horizon-futurenet.stellar.org',
}

/** Resolves the public Horizon endpoint for a network passphrase, or null if unknown. */
export function getHorizonUrl(networkPassphrase: string): string | null {
  return HORIZON_URLS[networkPassphrase] ?? null
}

/**
 * Fetches the native XLM balance for an account.
 *
 * Returns `null` for an account that doesn't exist on the ledger yet (unfunded —
 * the common state for a freshly generated testnet keypair), rather than throwing,
 * so callers can render a "needs funding" state instead of an error.
 */
export async function fetchNativeBalance(
  address: string,
  networkPassphrase: string,
): Promise<string | null> {
  const horizonUrl = getHorizonUrl(networkPassphrase)
  if (!horizonUrl) {
    throw new Error(`No Horizon endpoint known for network passphrase "${networkPassphrase}".`)
  }

  const server = new Horizon.Server(horizonUrl)
  try {
    const account = await server.loadAccount(address)
    const native = account.balances.find((b) => b.asset_type === 'native')
    return native?.balance ?? null
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 404) return null
    throw err
  }
}
