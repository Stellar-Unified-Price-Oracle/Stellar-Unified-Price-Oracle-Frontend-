import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GovernanceActionGate, GovernanceRoleBadge } from './GovernanceActionGate'
import * as walletHook from '../wallet/WalletContext'
import { NETWORK_PASSPHRASES } from '../lib/networkRegistry'

vi.mock('../wallet/WalletContext', () => ({
  useWallet: vi.fn(),
}))

const mockedUseWallet = vi.mocked(walletHook.useWallet)

describe('GovernanceActionGate (#857)', () => {
  it('renders disabled button with warning explainer when wallet is disconnected', () => {
    mockedUseWallet.mockReturnValue({
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
    })

    render(
      <GovernanceActionGate action="proposal:vote" targetNetwork="testnet">
        {({ allowed, disabledReason }) => (
          <button type="button" disabled={!allowed} title={disabledReason ?? ''}>
            Vote Now
          </button>
        )}
      </GovernanceActionGate>,
    )

    const btn = screen.getByRole('button', { name: 'Vote Now' })
    expect(btn).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(/Wallet connection required to cast ballot/i)
  })

  it('renders network switch warning when wallet is on the wrong network', () => {
    mockedUseWallet.mockReturnValue({
      status: 'connected',
      address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFOGKEYZTOWR4FHCEDGTO',
      network: 'PUBLIC',
      networkPassphrase: NETWORK_PASSPHRASES.mainnet,
      balance: '100',
      balanceLoading: false,
      error: null,
      errorCode: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      refreshBalance: vi.fn(),
      signTransaction: vi.fn(),
    })

    render(
      <GovernanceActionGate action="proposal:vote" targetNetwork="testnet">
        {({ allowed, disabledReason }) => (
          <button type="button" disabled={!allowed} title={disabledReason ?? ''}>
            Vote Now
          </button>
        )}
      </GovernanceActionGate>,
    )

    const btn = screen.getByRole('button', { name: 'Vote Now' })
    expect(btn).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(/Network mismatch/i)
  })

  it('renders role upgrade warning when connected on correct network but lacking role', () => {
    // Normal voter tries to execute proposal (requires admin)
    mockedUseWallet.mockReturnValue({
      status: 'connected',
      address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFOGKEYZTOWR4FHCEDGTO', // voter
      network: 'TESTNET',
      networkPassphrase: NETWORK_PASSPHRASES.testnet,
      balance: '100',
      balanceLoading: false,
      error: null,
      errorCode: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      refreshBalance: vi.fn(),
      signTransaction: vi.fn(),
    })

    render(
      <GovernanceActionGate action="proposal:execute" targetNetwork="testnet">
        {({ allowed, disabledReason }) => (
          <button type="button" disabled={!allowed} title={disabledReason ?? ''}>
            Execute Proposal
          </button>
        )}
      </GovernanceActionGate>,
    )

    const btn = screen.getByRole('button', { name: 'Execute Proposal' })
    expect(btn).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(/Role restriction.*Requires: System Administrator/i)
  })

  it('renders enabled button and hides explainer when role and network are valid', () => {
    mockedUseWallet.mockReturnValue({
      status: 'connected',
      address: 'GAADMIN7777777777777777777777777777777777777777777777777', // admin
      network: 'TESTNET',
      networkPassphrase: NETWORK_PASSPHRASES.testnet,
      balance: '500',
      balanceLoading: false,
      error: null,
      errorCode: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      refreshBalance: vi.fn(),
      signTransaction: vi.fn(),
    })

    render(
      <GovernanceActionGate action="proposal:execute" targetNetwork="testnet">
        {({ allowed }) => (
          <button type="button" disabled={!allowed}>
            Execute Proposal
          </button>
        )}
      </GovernanceActionGate>,
    )

    const btn = screen.getByRole('button', { name: 'Execute Proposal' })
    expect(btn).not.toBeDisabled()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('renders GovernanceRoleBadge correctly', () => {
    const { rerender } = render(<GovernanceRoleBadge role="admin" />)
    expect(screen.getByText('System Administrator')).toBeInTheDocument()

    rerender(<GovernanceRoleBadge role="operator" />)
    expect(screen.getByText('Feed Operator')).toBeInTheDocument()

    rerender(<GovernanceRoleBadge role="voter" />)
    expect(screen.getByText('Eligible Voter')).toBeInTheDocument()
  })
})
