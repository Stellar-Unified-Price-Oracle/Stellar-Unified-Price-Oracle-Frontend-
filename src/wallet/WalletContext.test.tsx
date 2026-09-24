import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  WalletError,
  connectFreighter,
  getFreighterNetwork,
  isFreighterAllowed,
  signTransactionWithFreighter,
} from './freighterClient'
import { fetchNativeBalance } from './horizon'
import { WalletProvider, useWallet } from './WalletContext'

vi.mock('./freighterClient', async () => {
  const actual = await vi.importActual<typeof import('./freighterClient')>('./freighterClient')
  return {
    ...actual,
    connectFreighter: vi.fn(),
    getFreighterNetwork: vi.fn(),
    isFreighterAllowed: vi.fn(),
    signTransactionWithFreighter: vi.fn(),
  }
})
vi.mock('./horizon', () => ({
  fetchNativeBalance: vi.fn(),
}))

const mockedConnect = vi.mocked(connectFreighter)
const mockedGetNetwork = vi.mocked(getFreighterNetwork)
const mockedIsAllowed = vi.mocked(isFreighterAllowed)
const mockedSign = vi.mocked(signTransactionWithFreighter)
const mockedBalance = vi.mocked(fetchNativeBalance)

const TEST_ADDRESS = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015'

function Consumer() {
  const wallet = useWallet()
  return (
    <div>
      <div data-testid="status">{wallet.status}</div>
      <div data-testid="address">{wallet.address ?? ''}</div>
      <div data-testid="balance">{wallet.balance ?? ''}</div>
      <div data-testid="error">{wallet.error ?? ''}</div>
      <button onClick={() => void wallet.connect()}>connect</button>
      <button onClick={() => wallet.disconnect()}>disconnect</button>
    </div>
  )
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.clearAllMocks()
})

beforeEach(() => {
  mockedIsAllowed.mockResolvedValue(false)
})

describe('WalletContext', () => {
  it('useWallet throws outside a WalletProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Consumer />)).toThrow('useWallet must be used within a WalletProvider')
    consoleSpy.mockRestore()
  })

  it('connect() populates address, network, and balance', async () => {
    mockedConnect.mockResolvedValue(TEST_ADDRESS)
    mockedGetNetwork.mockResolvedValue({ network: 'TESTNET', networkPassphrase: TESTNET_PASSPHRASE })
    mockedBalance.mockResolvedValue('123.4567890')

    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>,
    )

    await userEvent.click(screen.getByText('connect'))

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('connected'))
    expect(screen.getByTestId('address')).toHaveTextContent(TEST_ADDRESS)
    await waitFor(() => expect(screen.getByTestId('balance')).toHaveTextContent('123.4567890'))
  })

  it('surfaces a connect failure as an error state', async () => {
    mockedConnect.mockRejectedValue(new WalletError('not-installed', 'Freighter not found.'))

    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>,
    )

    await userEvent.click(screen.getByText('connect'))

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'))
    expect(screen.getByTestId('error')).toHaveTextContent('Freighter not found.')
  })

  it('disconnect() clears all on-chain state', async () => {
    mockedConnect.mockResolvedValue(TEST_ADDRESS)
    mockedGetNetwork.mockResolvedValue({ network: 'TESTNET', networkPassphrase: TESTNET_PASSPHRASE })
    mockedBalance.mockResolvedValue('50')

    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>,
    )

    await userEvent.click(screen.getByText('connect'))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('connected'))

    await userEvent.click(screen.getByText('disconnect'))

    expect(screen.getByTestId('status')).toHaveTextContent('disconnected')
    expect(screen.getByTestId('address')).toHaveTextContent('')
    expect(screen.getByTestId('balance')).toHaveTextContent('')
  })

  it('silently reconnects on mount when a prior session was authorized', async () => {
    localStorage.setItem('stellar-oracle:wallet-was-connected', 'true')
    mockedIsAllowed.mockResolvedValue(true)
    mockedConnect.mockResolvedValue(TEST_ADDRESS)
    mockedGetNetwork.mockResolvedValue({ network: 'TESTNET', networkPassphrase: TESTNET_PASSPHRASE })
    mockedBalance.mockResolvedValue('10')

    await act(async () => {
      render(
        <WalletProvider>
          <Consumer />
        </WalletProvider>,
      )
    })

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('connected'))
  })

  it('signTransaction rejects when not connected', async () => {
    let caught: unknown = null
    function SignConsumer() {
      const wallet = useWallet()
      return (
        <button
          onClick={async () => {
            try {
              await wallet.signTransaction('xdr')
            } catch (e) {
              caught = e
            }
          }}
        >
          sign
        </button>
      )
    }

    render(
      <WalletProvider>
        <SignConsumer />
      </WalletProvider>,
    )

    await userEvent.click(screen.getByText('sign'))
    expect(caught).toBeInstanceOf(WalletError)
    expect(mockedSign).not.toHaveBeenCalled()
  })
})
