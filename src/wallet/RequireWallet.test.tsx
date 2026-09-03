import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { RequireWallet } from './RequireWallet'
import { useWallet } from './WalletContext'
import type { WalletContextValue } from './types'

vi.mock('./WalletContext', () => ({
  useWallet: vi.fn(),
}))

const mockedUseWallet = vi.mocked(useWallet)

function walletValue(overrides: Partial<WalletContextValue>): WalletContextValue {
  return {
    status: 'disconnected',
    address: null,
    network: null,
    networkPassphrase: null,
    balance: null,
    balanceLoading: false,
    error: null,
    errorCode: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    refreshBalance: vi.fn(),
    signTransaction: vi.fn(),
    ...overrides,
  }
}

afterEach(cleanup)

describe('RequireWallet', () => {
  it('renders the gated content when connected', () => {
    mockedUseWallet.mockReturnValue(walletValue({ status: 'connected', address: 'GABC' }))

    render(
      <RequireWallet>
        <div>secret on-chain panel</div>
      </RequireWallet>,
    )

    expect(screen.getByText('secret on-chain panel')).toBeInTheDocument()
  })

  it('renders a connect empty state when disconnected', () => {
    mockedUseWallet.mockReturnValue(walletValue({ status: 'disconnected' }))

    render(
      <RequireWallet>
        <div>secret on-chain panel</div>
      </RequireWallet>,
    )

    expect(screen.queryByText('secret on-chain panel')).not.toBeInTheDocument()
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument()
  })

  it('shows the wallet error message alongside the connect action', () => {
    mockedUseWallet.mockReturnValue(
      walletValue({ status: 'error', error: 'Freighter wallet extension not found.' }),
    )

    render(
      <RequireWallet>
        <div>secret on-chain panel</div>
      </RequireWallet>,
    )

    expect(screen.getByText('Freighter wallet extension not found.')).toBeInTheDocument()
  })
})
