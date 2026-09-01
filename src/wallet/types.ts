/** Lifecycle of the wallet connection. */
export type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

/** Machine-readable reason a wallet operation failed, for UI-level guidance. */
export type WalletErrorCode =
  | 'not-installed'
  | 'user-rejected'
  | 'not-connected'
  | 'unknown'

export interface WalletState {
  status: WalletStatus
  /** Connected Stellar public key (G...), or null when disconnected. */
  address: string | null
  /** Freighter's reported network name, e.g. "TESTNET", "PUBLIC". */
  network: string | null
  /** Passphrase identifying the network the connected wallet is using. */
  networkPassphrase: string | null
  /** Native XLM balance as a decimal string, or null while unknown/unfunded. */
  balance: string | null
  balanceLoading: boolean
  /** Human-readable message describing the last error, or null. */
  error: string | null
  errorCode: WalletErrorCode | null
}

export interface WalletContextValue extends WalletState {
  connect: () => Promise<void>
  disconnect: () => void
  refreshBalance: () => Promise<void>
  /** Signs a transaction XDR with the connected wallet. Throws if not connected. */
  signTransaction: (transactionXdr: string) => Promise<string>
}
