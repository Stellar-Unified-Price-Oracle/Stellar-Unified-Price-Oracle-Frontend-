import { describe, it, expect } from 'vitest'
import { Asset, StrKey } from '@stellar/stellar-sdk'
import { getStellarAssetForPair, resolveStellarAsset, shortenAccount } from './stellarAssets'

// The Circle USDC issuer — the one hardcoded address in the module.
const USDC_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'

describe('resolveStellarAsset', () => {
  it('resolves XLM to the native asset', () => {
    const info = resolveStellarAsset('XLM')
    expect(info).not.toBeNull()
    expect(info!.code).toBe('XLM')
    expect(info!.isNative).toBe(true)
    expect(info!.issuer).toBeNull()
    expect(info!.canonical).toBe('native')
    expect(info!.asset).toBeInstanceOf(Asset)
    expect(info!.asset.isNative()).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(resolveStellarAsset('xlm')?.canonical).toBe('native')
    expect(resolveStellarAsset('  usdc  ')?.code).toBe('USDC')
  })

  it('resolves USDC to the Circle-issued asset with a structurally valid issuer', () => {
    const info = resolveStellarAsset('USDC')
    expect(info).not.toBeNull()
    expect(info!.code).toBe('USDC')
    expect(info!.isNative).toBe(false)
    expect(info!.issuer).toBe(USDC_ISSUER)
    expect(info!.canonical).toBe(`USDC:${USDC_ISSUER}`)
    // The SDK itself must consider the address valid.
    expect(StrKey.isValidEd25519PublicKey(info!.issuer!)).toBe(true)
    expect(info!.asset.getCode()).toBe('USDC')
    expect(info!.asset.getIssuer()).toBe(USDC_ISSUER)
  })

  it('returns null for codes with no canonical on-chain asset', () => {
    expect(resolveStellarAsset('BTC')).toBeNull()
    expect(resolveStellarAsset('ETH')).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(resolveStellarAsset('')).toBeNull()
    expect(resolveStellarAsset('   ')).toBeNull()
  })
})

describe('getStellarAssetForPair', () => {
  it('parses XLM/USD feeds', () => {
    const info = getStellarAssetForPair('XLM/USD')
    expect(info?.code).toBe('XLM')
    expect(info?.isNative).toBe(true)
  })

  it('parses USDC-USD feeds', () => {
    const info = getStellarAssetForPair('USDC-USD')
    expect(info?.code).toBe('USDC')
    expect(info?.issuer).toBe(USDC_ISSUER)
  })

  it('returns null for off-chain majors like BTC/USD', () => {
    expect(getStellarAssetForPair('BTC/USD')).toBeNull()
  })

  it('returns null for malformed pairs', () => {
    expect(getStellarAssetForPair('')).toBeNull()
    expect(getStellarAssetForPair('/USD')).toBeNull()
  })
})

describe('shortenAccount', () => {
  it('shortens long addresses for display', () => {
    expect(shortenAccount(USDC_ISSUER)).toBe('GA5Z…KZVN')
  })

  it('leaves short values unchanged', () => {
    expect(shortenAccount('GABC')).toBe('GABC')
  })
})
