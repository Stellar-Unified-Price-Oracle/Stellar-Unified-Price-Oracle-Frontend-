import { describe, it, expect, vi, afterEach } from 'vitest'
import { Horizon, Networks } from '@stellar/stellar-sdk'
import { fetchNativeBalance, getHorizonUrl } from './horizon'

const TEST_ADDRESS = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getHorizonUrl', () => {
  it('resolves the testnet Horizon endpoint', () => {
    expect(getHorizonUrl(Networks.TESTNET)).toBe('https://horizon-testnet.stellar.org')
  })

  it('returns null for an unknown passphrase', () => {
    expect(getHorizonUrl('not a real network')).toBeNull()
  })
})

describe('fetchNativeBalance', () => {
  it('returns the native balance for a funded account', async () => {
    vi.spyOn(Horizon.Server.prototype, 'loadAccount').mockResolvedValue({
      balances: [
        { asset_type: 'credit_alphanum4', balance: '1.0' },
        { asset_type: 'native', balance: '42.5000000' },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    await expect(fetchNativeBalance(TEST_ADDRESS, Networks.TESTNET)).resolves.toBe('42.5000000')
  })

  it('returns null when the account is not yet funded (404)', async () => {
    vi.spyOn(Horizon.Server.prototype, 'loadAccount').mockRejectedValue({
      response: { status: 404 },
    })

    await expect(fetchNativeBalance(TEST_ADDRESS, Networks.TESTNET)).resolves.toBeNull()
  })

  it('rethrows non-404 errors', async () => {
    vi.spyOn(Horizon.Server.prototype, 'loadAccount').mockRejectedValue({
      response: { status: 500 },
    })

    await expect(fetchNativeBalance(TEST_ADDRESS, Networks.TESTNET)).rejects.toBeDefined()
  })

  it('throws for an unrecognized network passphrase', async () => {
    await expect(fetchNativeBalance(TEST_ADDRESS, 'bogus')).rejects.toThrow(
      'No Horizon endpoint known',
    )
  })
})
