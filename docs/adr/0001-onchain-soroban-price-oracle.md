# ADR 0001: On-chain Soroban Price Oracle Contract

- **Status:** Proposed
- **Date:** 2026-08-27
- **Related:** `src/types/price.ts`, `src/types/onChainPrice.ts`, `src/lib/stellarAssets.ts`, `src/components/PriceProofPanel.tsx`, `docs/env.md`

## Context

The Stellar Unified Price Oracle currently publishes aggregated prices only
off-chain, over REST (`GET /api/prices/:pair`) and WebSocket. Consumers must
trust the Aggregator API's HTTPS response — there is no way for a smart
contract, or a user with only a Stellar account, to read the current price or
verify how it was produced without going through that API.

To make the feed readable and verifiable entirely on-chain, we need a Soroban
contract that:

1. Stores the latest aggregated price (and enough history to verify past
   records) for any canonical Stellar asset the oracle tracks.
2. Exposes a read interface any contract or client can call without
   authentication.
3. Exposes a write interface, restricted to the Aggregator's signer(s), that
   publishes a new price only after verifying the aggregation is backed by
   real signed source contributions.
4. Produces a record shape the frontend can render with the _same_ components
   used for the off-chain feed, so on-chain and off-chain state are visually
   consistent (see [Frontend integration](#frontend-integration)).

This ADR does not cover the aggregation algorithm itself (median, weighted
mean, outlier rejection, etc.) — that's unchanged from the existing off-chain
Aggregator. It covers only how the _result_ of that aggregation gets published
to, and read from, Soroban.

## Decision

### Data model

Soroban has no native float type, so prices are stored as a scaled integer
(`i128`) plus a decimal-places count, following the same convention as the
existing [SEP-40](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0040.md)
oracle interface that other Stellar price oracles (e.g. Reflector) implement —
this contract is intentionally SEP-40-compatible so it can be consumed by any
client already written against that interface, while adding the richer proof
data this project's Proof tab needs.

```rust
use soroban_sdk::{contracttype, Address, BytesN, Symbol, Vec};

/// One oracle source's signed contribution to an aggregated price.
#[contracttype]
pub struct SourceContribution {
    pub source: Symbol,          // e.g. symbol_short!("chainlink")
    pub price: i128,             // scaled by `decimals`
    pub timestamp: u64,          // unix seconds when the source observed this price
    pub signature: BytesN<64>,   // Ed25519 signature over (source, price, timestamp)
    pub public_key: BytesN<32>,  // the source node's signing key
}

/// A single published, aggregated price record for one asset pair.
#[contracttype]
pub struct PriceRecord {
    pub asset_pair: Symbol,      // e.g. symbol_short!("XLM_USD")
    pub price: i128,             // aggregated price, scaled by `decimals`
    pub decimals: u32,           // fixed per contract instance; see below
    pub timestamp: u64,          // unix seconds, ledger close time when published
    pub confidence_bps: u32,     // confidence in basis points (0-10_000)
    pub sources: Vec<Symbol>,    // sources that contributed to this record
    pub version: u64,            // monotonically incrementing per asset_pair
}

/// Full verification payload for one published record.
#[contracttype]
pub struct PriceProof {
    pub record: PriceRecord,
    pub contributions: Vec<SourceContribution>,
    pub aggregate_signature: BytesN<64>, // aggregator's signature over `record`
}
```

`decimals` is fixed at contract deployment (we use `7`, matching Stellar's
native asset precision) rather than carried per-record, so every record for a
given contract instance is directly comparable without a per-read division.

### Read interface

```rust
pub trait PriceOracleTrait {
    /// Latest aggregated price for `asset_pair`. Panics if the asset has never been published.
    fn get_price(env: Env, asset_pair: Symbol) -> PriceRecord;

    /// Unix seconds of the latest record for `asset_pair`, or 0 if never published.
    fn get_last_updated(env: Env, asset_pair: Symbol) -> u64;

    /// Confidence (basis points) of the latest record for `asset_pair`.
    fn get_confidence(env: Env, asset_pair: Symbol) -> u32;

    /// The record at or immediately before `at_timestamp`, for historical verification.
    /// Returns None if no record exists at or before that time (see storage note below).
    fn get_price_at(env: Env, asset_pair: Symbol, at_timestamp: u64) -> Option<PriceRecord>;

    /// Full proof (record + signed contributions + aggregate signature) for the
    /// latest record, or for the record active at `at_timestamp` when provided.
    fn get_proof(env: Env, asset_pair: Symbol, at_timestamp: Option<u64>) -> Option<PriceProof>;

    /// Every asset pair this contract instance has ever published a price for.
    fn list_assets(env: Env) -> Vec<Symbol>;
}
```

All read methods are unauthenticated — any account or contract can invoke
them. `get_price` panics (rather than returning `Option`) to match the SEP-40
convention that callers rely on for "always up to date" price feeds; the
`_at`/`get_proof` variants return `Option` because "was this ever published"
is a normal, expected outcome for historical lookups, not an error.

### Write interface

```rust
pub trait PriceOracleAdminTrait {
    /// One-time setup: sets the admin address (the Aggregator's signer) and `decimals`.
    fn initialize(env: Env, admin: Address, decimals: u32);

    /// Publishes a new aggregated price record. Requires `admin.require_auth()`.
    /// Verifies every `SourceContribution` signature against its `public_key`
    /// before accepting the record — a record with an unverifiable or
    /// insufficient (< quorum) set of contributions is rejected.
    fn publish_price(env: Env, admin: Address, proof: PriceProof);

    /// Rotates the admin signer (key rotation without redeploying).
    fn set_admin(env: Env, admin: Address, new_admin: Address);
}
```

`publish_price` takes the _whole_ `PriceProof`, not just the aggregated
`PriceRecord`, so the contract itself — not just the frontend — can verify the
aggregate is backed by real, signed source data before committing it to
storage. This is what makes the Proof tab's guarantee meaningful: the
signatures a user copies from the UI are the same signatures the contract
checked before it accepted the price.

Quorum (how many of the four sources must sign) is a constructor parameter,
not hardcoded, so it can be tuned per asset without a contract upgrade.

### Storage approach

Three options were considered for how price data is organized across contract
instances:

| Approach                                                     | Description                                                                                            | Verdict    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ---------- |
| **A. Single shared instance, keyed by asset**                | One contract deployment; `PriceRecord`s stored in persistent storage keyed by `asset_pair`.            | **Chosen** |
| **B. One contract per asset**                                | Deploy a distinct contract instance per asset pair (e.g. separate `XLM/USD` and `USDC/USD` contracts). | Rejected   |
| **C. Single instance, only latest record kept (no history)** | Same as A, but overwrites the previous record instead of versioning it.                                | Rejected   |

**Why A over B:** per-asset contracts duplicate the admin/auth/signature-
verification logic across N deployments, multiplying upgrade and audit
surface for no isolation benefit — a compromised admin key compromises every
asset either way, since it's the same Aggregator signer. A single instance
also lets `list_assets` and cross-asset reads (e.g. a contract that wants
`XLM/USD` and `USDC/USD` in one call) work without knowing N contract
addresses ahead of time. The downside — one contract's storage growing with
every tracked asset — is small at our scale (4 sources × a handful of assets)
and is mitigated by the TTL strategy below.

**Why not C:** the Proof tab's core requirement is verifying **historical**
records, not just the latest tick. Overwriting loses that entirely. Instead,
each `publish_price` call writes a _new_ versioned entry (keyed by
`(asset_pair, version)`) and updates a `(asset_pair) -> version` pointer to
the latest. `get_price_at` binary-searches versions by timestamp.

**Bump / archival considerations:** Soroban persistent storage entries are
subject to TTL (time-to-live) and get archived if not bumped before
expiration. Given price records accumulate quickly (every aggregation cycle),
we do not bump every historical version indefinitely — that would grow
storage cost unbounded. Instead:

- The **latest** record per asset is bumped on every `publish_price` call
  (each publish naturally touches and re-bumps it), so it never expires while
  the oracle is active.
- **Historical** versions are written with a bounded TTL (e.g. 30 days via
  `extend_ttl`), long enough to cover the Proof tab's "verify a historical
  record" use case for recent history, after which they're eligible for
  archival. A record that has expired and been archived can still be restored
  on-chain (Soroban's restore mechanism) by anyone willing to pay the restore
  fee — the data isn't destroyed, just made temporarily more expensive to
  read, which is an acceptable tradeoff for old records.
- If unbounded historical retention is needed later (e.g. for a compliance
  audit trail), that's a separate concern better served by indexing published
  events off-chain (Soroban emits an event on every `publish_price`) rather
  than by keeping every version bumped in contract storage forever.

### Mapping to the frontend's `PriceData` type

The frontend's existing off-chain shape is `src/types/price.ts`'s `PriceData`:

```ts
interface PriceData {
  assetPair: string
  price: number
  timestamp: number // ms
  confidence: number // 0.0-1.0
  sources: string[]
}
```

`OnChainPriceRecord` (`src/types/onChainPrice.ts`) mirrors it field-for-field,
differing only where Soroban's type system forces a different representation:

| Rust (`PriceRecord`)           | Frontend (`OnChainPriceRecord`)                                 | Notes                                                                                                                                                   |
| ------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `asset_pair: Symbol`           | `assetPair: string`                                             | Decoded 1:1.                                                                                                                                            |
| `price: i128`, `decimals: u32` | `price: number`, `priceScaled: string`, `priceDecimals: number` | `price = priceScaled / 10 ** priceDecimals`, pre-divided for display; `priceScaled` kept as a string since `i128` can exceed `Number.MAX_SAFE_INTEGER`. |
| `timestamp: u64` (seconds)     | `timestamp: number` (ms)                                        | Multiplied by 1000 to match `PriceData.timestamp`'s existing ms convention.                                                                             |
| `confidence_bps: u32`          | `confidence: number`                                            | Divided by 10,000 to match `PriceData.confidence`'s existing 0.0-1.0 convention.                                                                        |
| `sources: Vec<Symbol>`         | `sources: SourceName[]`                                         | Decoded 1:1.                                                                                                                                            |
| `version: u64`                 | `version: number`                                               | New field — off-chain `PriceData` has no version; on-chain records are versioned so historical proof lookups are possible.                              |

Because every field `PriceData` has is present on `OnChainPriceRecord`,
`onChainRecordToPriceData()` converts one to the other losslessly, so
components built against `PriceData` (the price block, source badges,
`getConfidenceColor`) render on-chain records without modification. `PriceProof`
wraps `OnChainPriceRecord` with the verification-only fields (`contributions`,
`aggregateSignature`, `contractId`, `ledgerSequence`, `transactionHash`,
`network`) that have no off-chain equivalent and are only needed by the Proof
tab, not the main price display.

## Frontend integration

`PriceDetail` now has two tabs:

- **Overview** — the existing off-chain view: current price, sources,
  Stellar asset info, chart, and history table, all driven by the REST/WS
  feed exactly as before.
- **Proof** — on-chain verification, driven by `GET /api/prices/:pair/proof`
  (`fetchPriceProof` in `src/api/rest.ts`), rendered by
  `PriceProofPanel`. Shows the aggregate signature/commitment, the contract ID
  and transaction hash (each linking to a stellar.expert explorer for the
  configured network — see `VITE_STELLAR_NETWORK` in `docs/env.md`), and every
  source's individual signed contribution, each copyable to the clipboard.
  A record selector lets the user pick any timestamp from the pair's
  recently-fetched history to verify that specific historical record, not
  just the latest.

This tab split _is_ the "on-chain vs off-chain state" the dashboard needed:
Overview always reflects the off-chain aggregator (available for every
tracked pair today), while Proof reflects on-chain state and is only
populated for pairs with a canonical on-chain Stellar asset (see
`getStellarAssetForPair` in `src/lib/stellarAssets.ts`) — a pair like
`BTC/USD`, which has no canonical Stellar asset, has nothing to publish
on-chain, so its Proof tab shows a graceful "unavailable" state instead of an
error. As more assets get an on-chain representation and this contract is
deployed, their Proof tabs start resolving automatically — no frontend change
needed, since `fetchPriceProof` already treats "no proof yet" (HTTP 404) as a
normal, non-error outcome rather than a failure.

## Consequences

**Positive**

- Any Soroban contract can read a trusted price without depending on the
  Aggregator's REST API being reachable from on-chain logic (which it can't
  be) or trusting an off-chain oracle by reputation alone.
- SEP-40 compatibility means the contract slots into the existing Stellar
  oracle ecosystem's tooling and conventions.
- Versioned records make the Proof tab's historical verification possible
  without a separate indexing service.

**Negative / risks**

- `publish_price` gas/fee cost is paid per aggregation cycle, per asset —
  unlike the off-chain path, this is a recurring on-chain cost that scales
  with publish frequency and tracked-asset count.
- Signature verification inside the contract (four Ed25519 checks per
  publish) adds CPU-instruction cost to every write; this is a Soroban
  resource-limit consideration to validate against testnet before mainnet
  rollout.
- The admin key that authorizes `publish_price` is a single point of trust
  for on-chain data, same as the Aggregator's signer is for off-chain data
  today — this contract doesn't change that trust model, only makes it
  independently verifiable via `PriceProof`.

## Alternatives considered

- **Threshold multisig aggregation on-chain** (each source submits its
  signed contribution directly to the contract, which aggregates on-chain
  instead of trusting an off-chain Aggregator to aggregate first): rejected
  for v1 because it would require four separate on-chain transactions per
  aggregation cycle instead of one, at 4x the fee cost, for a trust
  improvement (not trusting the Aggregator's aggregation step) that
  `PriceProof`'s contract-side signature verification already delivers today
  — the contract still checks every source signature, it just does so within
  one `publish_price` call submitted by the Aggregator rather than four.
  Worth revisiting if the Aggregator itself is ever identified as a weak
  trust point.
- **Oracle-per-asset contracts (option B above):** see [Storage
  approach](#storage-approach).
