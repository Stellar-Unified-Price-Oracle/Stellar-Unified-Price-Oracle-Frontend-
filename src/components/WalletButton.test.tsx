import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useWallet } from '../wallet/WalletContext'
import type { WalletContextValue } from '../wallet/types'
import { WalletButton } from './WalletButton'

vi.mock('../wallet/WalletContext', () => ({
  useWallet: vi.fn(),
}))

const mockedUseWallet = vi.mocked(useWallet)
const TEST_ADDRESS = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'

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

describe('WalletButton', () => {
  it('shows a Connect Wallet button when disconnected', async () => {
    const connect = vi.fn()
    mockedUseWallet.mockReturnValue(walletValue({ status: 'disconnected', connect }))

    render(<WalletButton />)
    await userEvent.click(screen.getByRole('button', { name: 'Connect Wallet' }))

    expect(connect).toHaveBeenCalledTimes(1)
  })

  it('shows a status chip with network, address, and balance when connected', async () => {
    mockedUseWallet.mockReturnValue(
      walletValue({
        status: 'connected',
        address: TEST_ADDRESS,
        network: 'TESTNET',
        balance: '100.0000000',
      }),
    )

    render(<WalletButton />)
    await userEvent.click(screen.getByRole('button', { name: /Wallet connected/ }))

    const menu = screen.getByRole('menu')
    expect(within(menu).getByText('TESTNET')).toBeInTheDocument()
    expect(within(menu).getByText('100.0000000 XLM')).toBeInTheDocument()
  })

  it('disconnect button clears the wallet', async () => {
    const disconnect = vi.fn()
    mockedUseWallet.mockReturnValue(
      walletValue({ status: 'connected', address: TEST_ADDRESS, network: 'TESTNET', disconnect }),
    )

    render(<WalletButton />)
    await userEvent.click(screen.getByRole('button', { name: /Wallet connected/ }))
    await userEvent.click(screen.getByText('Disconnect'))

    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  it('links to freighter.app when not installed', () => {
    mockedUseWallet.mockReturnValue(
      walletValue({
        status: 'error',
        errorCode: 'not-installed',
        error: 'Freighter wallet extension not found. Install it from freighter.app and reload the page.',
      }),
    )

    render(<WalletButton />)
    expect(screen.getByRole('link', { name: 'Install Freighter' })).toHaveAttribute(
      'href',
      'https://www.freighter.app/',
    )
  })
})
