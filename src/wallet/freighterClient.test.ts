import { describe, it, expect, vi, beforeEach } from 'vitest'
import freighterApi from '@stellar/freighter-api'
import {
  WalletError,
  connectFreighter,
  getFreighterNetwork,
  isFreighterAllowed,
  isFreighterInstalled,
  signTransactionWithFreighter,
} from './freighterClient'

vi.mock('@stellar/freighter-api', () => ({
  default: {
    isConnected: vi.fn(),
    isAllowed: vi.fn(),
    requestAccess: vi.fn(),
    getNetwork: vi.fn(),
    signTransaction: vi.fn(),
  },
}))

const mockedApi = vi.mocked(freighterApi)

const TEST_ADDRESS = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('isFreighterInstalled', () => {
  it('returns true when Freighter reports connected', async () => {
    mockedApi.isConnected.mockResolvedValue({ isConnected: true })
    await expect(isFreighterInstalled()).resolves.toBe(true)
  })

  it('returns false when the API returns an error', async () => {
    mockedApi.isConnected.mockResolvedValue({
      isConnected: false,
      error: { message: 'boom', code: -1 },
    })
    await expect(isFreighterInstalled()).resolves.toBe(false)
  })
})

describe('connectFreighter', () => {
  it('resolves with the address on success', async () => {
    mockedApi.isConnected.mockResolvedValue({ isConnected: true })
    mockedApi.requestAccess.mockResolvedValue({ address: TEST_ADDRESS })

    await expect(connectFreighter()).resolves.toBe(TEST_ADDRESS)
  })

  it('throws a not-installed WalletError when the extension is absent', async () => {
    mockedApi.isConnected.mockResolvedValue({ isConnected: false })

    await expect(connectFreighter()).rejects.toMatchObject({
      name: 'WalletError',
      code: 'not-installed',
    })
    expect(mockedApi.requestAccess).not.toHaveBeenCalled()
  })

  it('throws a user-rejected WalletError when the user declines', async () => {
    mockedApi.isConnected.mockResolvedValue({ isConnected: true })
    mockedApi.requestAccess.mockResolvedValue({
      address: '',
      error: { message: 'User declined access', code: -4 },
    })

    await expect(connectFreighter()).rejects.toMatchObject({
      name: 'WalletError',
      code: 'user-rejected',
    })
  })

  it('wraps unrecognized errors as unknown', async () => {
    mockedApi.isConnected.mockResolvedValue({ isConnected: true })
    mockedApi.requestAccess.mockResolvedValue({
      address: '',
      error: { message: 'something odd happened', code: -99 },
    })

    await expect(connectFreighter()).rejects.toMatchObject({
      name: 'WalletError',
      code: 'unknown',
      message: 'something odd happened',
    })
  })
})

describe('isFreighterAllowed', () => {
  it('returns the isAllowed flag', async () => {
    mockedApi.isAllowed.mockResolvedValue({ isAllowed: true })
    await expect(isFreighterAllowed()).resolves.toBe(true)
  })

  it('returns false on error', async () => {
    mockedApi.isAllowed.mockResolvedValue({ isAllowed: false, error: { message: 'x', code: -1 } })
    await expect(isFreighterAllowed()).resolves.toBe(false)
  })
})

describe('getFreighterNetwork', () => {
  it('resolves network and passphrase', async () => {
    mockedApi.getNetwork.mockResolvedValue({
      network: 'TESTNET',
      networkPassphrase: 'Test SDF Network ; September 2015',
    })
    await expect(getFreighterNetwork()).resolves.toEqual({
      network: 'TESTNET',
      networkPassphrase: 'Test SDF Network ; September 2015',
    })
  })

  it('throws WalletError on failure', async () => {
    mockedApi.getNetwork.mockResolvedValue({
      network: '',
      networkPassphrase: '',
      error: { message: 'nope', code: -1 },
    })
    await expect(getFreighterNetwork()).rejects.toBeInstanceOf(WalletError)
  })
})

describe('signTransactionWithFreighter', () => {
  it('returns the signed XDR', async () => {
    mockedApi.signTransaction.mockResolvedValue({
      signedTxXdr: 'signed-xdr',
      signerAddress: TEST_ADDRESS,
    })
    await expect(
      signTransactionWithFreighter('xdr', {
        address: TEST_ADDRESS,
        networkPassphrase: 'Test SDF Network ; September 2015',
      }),
    ).resolves.toBe('signed-xdr')
  })

  it('throws WalletError on failure', async () => {
    mockedApi.signTransaction.mockResolvedValue({
      signedTxXdr: '',
      signerAddress: '',
      error: { message: 'rejected', code: -1 },
    })
    await expect(
      signTransactionWithFreighter('xdr', {
        address: TEST_ADDRESS,
        networkPassphrase: 'Test SDF Network ; September 2015',
      }),
    ).rejects.toBeInstanceOf(WalletError)
  })
})
