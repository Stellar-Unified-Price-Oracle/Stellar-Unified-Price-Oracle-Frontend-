import type { OracleNetwork } from '../lib/contractRegistry'

export type { OracleNetwork }

/**
 * The latest price a Soroban oracle contract has published on-chain for one asset.
 *
 * Distinct from {@link import('./price').PriceData} — that type is the off-chain
 * aggregated feed; this is what a client would read back from the contract itself
 * (or, here, from the API surface that indexes it).
 */
export interface OnChainPriceRecord {
  /** Base asset code, e.g. `XLM`, `USDC`. */
  asset: string
  network: OracleNetwork
  /** Soroban contract address (StrKey `C...`) that published this price. */
  contractId: string
  price: number
  /** Unix timestamp in milliseconds when the contract last published a price. */
  publishedAt: number
  /** Ledger sequence number of the publish transaction. */
  ledger: number
}

/** Divergence status derived from comparing an off-chain price to its on-chain counterpart. */
export type DivergenceStatus = 'in-sync' | 'warning' | 'breached'

/** Computed comparison between an off-chain feed price and its latest on-chain publish. */
export interface PriceDivergence {
  offChainPrice: number
  onChainPrice: number
  /** `offChainPrice - onChainPrice`, signed. */
  absoluteDelta: number
  /** `absoluteDelta / onChainPrice * 100`, signed. */
  percentageDelta: number
  /** Status against the configured threshold — see `computeDivergence` in `utils/divergence.ts`. */
  status: DivergenceStatus
}
