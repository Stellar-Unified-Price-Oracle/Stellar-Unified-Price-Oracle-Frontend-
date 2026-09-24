import { Asset, StrKey } from '@stellar/stellar-sdk'

/**
 * Canonical, on-chain representation of a Stellar asset.
 *
 * Built with the official `@stellar/stellar-sdk` so every value the UI displays
 * (`canonical`, `asset`) is produced and validated by the SDK itself rather than
 * hand-rolled string logic.
 */
export interface StellarAssetInfo {
  /** Asset code (1–12 chars), e.g. `XLM`, `USDC`. */
  code: string
  /** `true` for the native lumen (XLM). */
  isNative: boolean
  /** Issuing account for issued assets, `null` for native XLM. */
  issuer: string | null
  /** Canonical string form used across the Stellar ecosystem, e.g. `native` or `USDC:GA5Z…`. */
  canonical: string
  /** Human-readable label, e.g. `USDC (Circle)`. */
  label: string
  /** The `@stellar/stellar-sdk` `Asset` instance (SDK-validated code + issuer). */
  asset: Asset
}

/**
 * Well-known issued assets on the Stellar network, keyed by asset code.
 *
 * Issuer addresses are public constants that exist on the ledger (verifiable on
 * stellar.expert). Only widely canonical issuers are listed: unknown codes resolve
 * to `null` instead of guessing, so the UI never makes an unverifiable on-chain claim.
 *
 * Deliberately NOT listed (researched, no single canonical issuer exists):
 *  - USDT — no native Tether issuance on Stellar; top holders are bridge/wrapped
 *    variants (e.g. Allbridge `apUSDT`) with different issuers.
 *  - EURT — multiple issuers, none publish a verifiable domain/TOML.
 *  - BTC / ETH — wrapped by several independent anchors (Ultra Capital, StellarPort,
 *    plus impersonation attempts); there is no canonical on-chain representation.
 * Those feeds still render — with the explicit “no canonical on-chain asset” state.
 */
const KNOWN_ISSUERS: Readonly<Record<string, { issuer: string; label: string }>> = {
  USDC: {
    // Circle's USDC issuer on Stellar — the dominant stablecoin on the network.
    // Verified against stellar.expert (asset `USDC-GA5Z…-credit_alphanum4`, domain circle.com).
    issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    label: 'USDC (Circle)',
  },
}

/**
 * Fail-fast guard: every hardcoded issuer must be a structurally valid Stellar
 * account address (G…). Runs once at module load so a typo breaks tests/CI
 * immediately instead of silently rendering a corrupt asset.
 */
for (const [code, { issuer }] of Object.entries(KNOWN_ISSUERS)) {
  if (!StrKey.isValidEd25519PublicKey(issuer)) {
    throw new Error(`[stellarAssets] Invalid Stellar issuer address for ${code}: ${issuer}`)
  }
}

/** Feed pairs use `XLM/USD` or `XLM-USD`; both separators are accepted. */
const PAIR_SEPARATOR = /[/-]/

/**
 * Resolves a base asset code to its canonical on-chain Stellar representation.
 *
 * @param baseCode - Base code from a price feed pair (e.g. `XLM`, `usdc`). Case-insensitive.
 * @returns Asset info, or `null` when the code has no canonical on-chain Stellar asset.
 */
export function resolveStellarAsset(baseCode: string): StellarAssetInfo | null {
  const code = baseCode.trim().toUpperCase()
  if (!code) return null

  // Native lumen — the asset the Stellar network itself runs on.
  if (code === 'XLM') {
    return {
      code,
      isNative: true,
      issuer: null,
      canonical: Asset.native().toString(),
      label: 'XLM (native)',
      asset: Asset.native(),
    }
  }

  const known = KNOWN_ISSUERS[code]
  if (known) {
    // `Asset` validates the code format and issuer address; throws if malformed.
    const asset = new Asset(code, known.issuer)
    return {
      code,
      isNative: false,
      issuer: known.issuer,
      canonical: asset.toString(),
      label: known.label,
      asset,
    }
  }

  return null
}

/**
 * Resolves the on-chain Stellar asset for a price feed pair.
 *
 * @param pair - Feed identifier, e.g. `XLM/USD` or `USDC-USD`.
 * @returns Asset info for the feed's base asset, or `null` when the feed has no
 * canonical on-chain representation (e.g. `BTC/USD` is aggregated off-chain today).
 */
export function getStellarAssetForPair(pair: string): StellarAssetInfo | null {
  const base = pair.split(PAIR_SEPARATOR)[0]?.trim()
  return base ? resolveStellarAsset(base) : null
}

/**
 * Shrinks a Stellar account address for compact display, e.g. `GA5Z…BOYSC`.
 * Short or malformed input is returned unchanged.
 */
export function shortenAccount(address: string): string {
  return address.length <= 13 ? address : `${address.slice(0, 4)}…${address.slice(-4)}`
}
