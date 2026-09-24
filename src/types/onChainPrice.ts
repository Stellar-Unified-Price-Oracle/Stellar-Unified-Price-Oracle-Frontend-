/**
 * Frontend mirrors of the Soroban oracle contract's data model.
 *
 * See {@link ../../docs/adr/0001-onchain-soroban-price-oracle.md} for the Rust
 * struct definitions these types map 1:1 to, and for why the price is carried
 * as a scaled integer (`priceScaled` / `priceDecimals`) rather than a float —
 * Soroban has no native floating point type.
 */
import type { PriceData } from './price'

/**
 * On-chain price record as read from the oracle contract's `get_price` entry
 * point. Structurally mirrors {@link PriceData}: `assetPair`, `timestamp`,
 * `confidence`, and `sources` line up field-for-field, so the UI can render
 * on-chain state with the same components used for the off-chain feed.
 *
 * `price` differs from {@link PriceData.price} only in representation: the
 * contract has no float type, so the ledger stores `priceScaled` (an integer)
 * and `priceDecimals`; `price` here is the already-divided, display-ready value.
 */
export interface OnChainPriceRecord {
  /** The asset pair (e.g. "XLM/USD"). Matches {@link PriceData.assetPair}. */
  assetPair: string
  /** The aggregated price in the quote currency, decoded from the ledger's scaled integer. */
  price: number
  /** Raw scaled integer as stored on-chain (`price === priceScaled / 10 ** priceDecimals`). */
  priceScaled: string
  /** Decimal places `priceScaled` is scaled by. */
  priceDecimals: number
  /** Unix timestamp in milliseconds, converted from the ledger close time. */
  timestamp: number
  /** Confidence score from 0.0 to 1.0, decoded from the contract's `confidence_bps` (basis points). */
  confidence: number
  /** Oracle sources that contributed to this record. */
  sources: string[]
  /** Monotonically incrementing record version (bumped on every `publish_price` call for this asset). */
  version: number
}

/** A single oracle source's signed contribution to an aggregated on-chain price record. */
export interface SourceContribution {
  /** The contributing oracle source. */
  source: string
  /** The price this source reported, before aggregation. */
  price: number
  /** Unix timestamp in milliseconds when this source's value was observed. */
  timestamp: number
  /** Hex-encoded Ed25519 signature over this contribution, verifiable against `publicKey`. */
  signature: string
  /** Hex-encoded public key identifying the signing oracle node. */
  publicKey: string
}

/**
 * Full verification payload for one published price record: the aggregated
 * record itself, every source contribution that fed the aggregate, and the
 * on-chain coordinates (contract, ledger, transaction) needed to look it up
 * independently on an explorer.
 */
export interface PriceProof {
  /** The aggregated price record this proof covers. */
  record: OnChainPriceRecord
  /** Per-source signed contributions that were aggregated into `record`. */
  contributions: SourceContribution[]
  /** Hex-encoded aggregate signature / commitment over `record`, produced by `publish_price`. */
  aggregateSignature: string
  /** Soroban contract ID (`C…`) that published this record. */
  contractId: string
  /** Ledger sequence number the publish transaction was included in. */
  ledgerSequence: number
  /** Hex-encoded hash of the `publish_price` transaction. */
  transactionHash: string
  /** Which Stellar network this proof was published to. */
  network: 'testnet' | 'mainnet'
}

/**
 * Converts an {@link OnChainPriceRecord} to the frontend's canonical
 * {@link PriceData} shape, so on-chain and off-chain records can be rendered
 * by the same UI components.
 */
export function onChainRecordToPriceData(record: OnChainPriceRecord): PriceData {
  return {
    assetPair: record.assetPair,
    price: record.price,
    timestamp: record.timestamp,
    confidence: record.confidence,
    sources: record.sources,
  }
}

/** Type guard that verifies an unknown value conforms to the {@link SourceContribution} shape. */
export function isSourceContribution(value: unknown): value is SourceContribution {
  if (value == null || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.source === 'string' &&
    typeof obj.price === 'number' &&
    !Number.isNaN(obj.price) &&
    typeof obj.timestamp === 'number' &&
    typeof obj.signature === 'string' &&
    typeof obj.publicKey === 'string'
  )
}

/**
 * Type guard that verifies an unknown value conforms to the {@link PriceProof}
 * shape at runtime, checking the nested record and every contribution.
 */
export function isPriceProof(value: unknown): value is PriceProof {
  if (value == null || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  const record = obj.record as Record<string, unknown> | undefined

  const hasValidRecord =
    record != null &&
    typeof record === 'object' &&
    typeof record.assetPair === 'string' &&
    typeof record.price === 'number' &&
    typeof record.priceScaled === 'string' &&
    typeof record.priceDecimals === 'number' &&
    typeof record.timestamp === 'number' &&
    typeof record.confidence === 'number' &&
    Array.isArray(record.sources) &&
    typeof record.version === 'number'

  return (
    hasValidRecord &&
    Array.isArray(obj.contributions) &&
    obj.contributions.every(isSourceContribution) &&
    typeof obj.aggregateSignature === 'string' &&
    typeof obj.contractId === 'string' &&
    typeof obj.ledgerSequence === 'number' &&
    typeof obj.transactionHash === 'string' &&
    (obj.network === 'testnet' || obj.network === 'mainnet')
  )
}
