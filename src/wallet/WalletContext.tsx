import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  WalletError,
  connectFreighter,
  getFreighterNetwork,
  isFreighterAllowed,
  signTransactionWithFreighter,
} from './freighterClient'
import { fetchNativeBalance } from './horizon'
import type { WalletContextValue, WalletErrorCode, WalletState } from './types'

const INITIAL_STATE: WalletState = {
  status: 'disconnected',
  address: null,
  network: null,
  networkPassphrase: null,
  balance: null,
  balanceLoading: false,
  error: null,
  errorCode: null,
}

/** Remembers that the user connected before, so a reload can reconnect silently. */
const WAS_CONNECTED_KEY = 'stellar-oracle:wallet-was-connected'

const WalletContext = createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>(INITIAL_STATE)
  // Avoids setting state after unmount if a connect/balance fetch is still in flight.
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const loadBalance = useCallback(async (address: string, networkPassphrase: string) => {
    setState((prev) => ({ ...prev, balanceLoading: true }))
    try {
      const balance = await fetchNativeBalance(address, networkPassphrase)
      if (mountedRef.current) {
        setState((prev) => ({ ...prev, balance, balanceLoading: false }))
      }
    } catch {
      if (mountedRef.current) {
        setState((prev) => ({ ...prev, balance: null, balanceLoading: false }))
      }
    }
  }, [])

  const connect = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'connecting', error: null, errorCode: null }))
    try {
      const address = await connectFreighter()
      const { network, networkPassphrase } = await getFreighterNetwork()
      if (!mountedRef.current) return

      localStorage.setItem(WAS_CONNECTED_KEY, 'true')
      setState({
        status: 'connected',
        address,
        network,
        networkPassphrase,
        balance: null,
        balanceLoading: false,
        error: null,
        errorCode: null,
      })
      void loadBalance(address, networkPassphrase)
    } catch (err) {
      if (!mountedRef.current) return
      const code: WalletErrorCode = err instanceof WalletError ? err.code : 'unknown'
      const message = err instanceof Error ? err.message : 'Failed to connect wallet.'
      setState({ ...INITIAL_STATE, status: 'error', error: message, errorCode: code })
    }
  }, [loadBalance])

  const disconnect = useCallback(() => {
    localStorage.removeItem(WAS_CONNECTED_KEY)
    setState(INITIAL_STATE)
  }, [])

  const refreshBalance = useCallback(async () => {
    if (!state.address || !state.networkPassphrase) return
    await loadBalance(state.address, state.networkPassphrase)
  }, [state.address, state.networkPassphrase, loadBalance])

  const signTransaction = useCallback(
    async (transactionXdr: string): Promise<string> => {
      if (!state.address || !state.networkPassphrase) {
        throw new WalletError('not-connected', 'Connect a wallet before signing a transaction.')
      }
      return signTransactionWithFreighter(transactionXdr, {
        address: state.address,
        networkPassphrase: state.networkPassphrase,
      })
    },
    [state.address, state.networkPassphrase],
  )

  // On mount, silently restore a prior session if this site is still authorized
  // in Freighter — otherwise leave the user in the disconnected empty state.
  useEffect(() => {
    if (localStorage.getItem(WAS_CONNECTED_KEY) !== 'true') return
    let cancelled = false
    void (async () => {
      const allowed = await isFreighterAllowed().catch(() => false)
      if (cancelled || !allowed) return
      await connect()
    })()
    return () => {
      cancelled = true
    }
    // Runs once on mount; `connect` is stable across the component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <WalletContext.Provider value={{ ...state, connect, disconnect, refreshBalance, signTransaction }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used within a WalletProvider')
  return ctx
}
