# Reading the Oracle On-Chain

This guide is for a Soroban dApp developer who wants to read the Stellar Unified
Price Oracle directly from its on-chain contract, rather than (or in addition to)
the off-chain REST/WebSocket API this dashboard consumes.

By the end of this guide you should be able to read a live price from **testnet**
in under 30 minutes.

## 1. Contract addresses

Every network/asset pair the oracle publishes on-chain has one Soroban contract.
This frontend never hardcodes a contract address — it resolves every lookup
through a single typed registry:

```
src/lib/contractRegistry.ts
```

```ts
import { getContractRegistryEntry } from './src/lib/contractRegistry'

const entry = getContractRegistryEntry('testnet', 'XLM')
// { network: 'testnet', asset: 'XLM', contractId: 'CA7FLK2OZ...' }
```

An unknown network or asset throws a typed error (`UnknownNetworkError` /
`UnknownAssetError`) instead of returning `undefined` or crashing — check for
these if you're adapting this pattern in your own client.

| Network | Asset | Contract |
|---|---|---|
| testnet | XLM | `CA7FLK2OZGSPYFBYXDWCNMSWG7GRZSYDN4OASS4VJXGW3SX3G3GZASP6` |
| testnet | USDC | `CCIIMAO7NGSL7YPKWVGO3QCNFPKMC4JP6BYQRSCOPRQKGQMVZHR5OZ7N` |
| mainnet | XLM | `CDSMIA7DB32IJCS6LHH3FWGVERQI7O3MSMEVB5YGGH5PCAQZOD7UIOGA` |
| mainnet | USDC | `CANJKZBHN7SXCGI3NI5RNU2VZX4OTSICETFNHCU3QQWRL4GAPB6MDBJJ` |
| futurenet | XLM | `CARBBKWKGW5DKZTHXHZPSDLGBKNVIN3E2QY5ULOVRPADEKEZZRULHEG2` |

These addresses are also the current source of truth in
[`contractRegistry.ts`](../src/lib/contractRegistry.ts) — treat that file as
canonical if this table ever drifts.

> **Status:** on-chain publishing is on the [README roadmap](../README.md#roadmap)
> and not yet live — the addresses above are placeholders reserved in the
> registry ahead of deployment, not contracts with real price history yet.
> Section 3 below still runs end-to-end against them on testnet today: the
> simulated call succeeds, and `lastprice()` returns the "not yet published"
> error described in [§6](#6-common-failure-modes) rather than price data.
> Once the publisher is live, swap in its real contract ID here (or via
> `VITE_ORACLE_CONTRACT_OVERRIDES` while testing) and the same code returns
> live prices unchanged.

For a **local or custom deployment**, override any entry at runtime instead of
editing the registry:

```bash
# .env
VITE_ORACLE_CONTRACT_OVERRIDES={"testnet":{"XLM":"C...YOUR_LOCAL_CONTRACT"}}
```

## 2. Read interface

The oracle publisher contract exposes a single read-only entry point:

```rust
// Simplified Soroban contract interface
pub trait PriceOracle {
    /// Returns the last price this contract published, or None if it has
    /// never published.
    fn lastprice(env: Env) -> Option<PriceData>;
}

pub struct PriceData {
    pub price: i128,      // fixed-point, scaled by `decimals`
    pub timestamp: u64,   // ledger close time (unix seconds) of the publish
    pub decimals: u32,    // typically 7, matching Stellar's native precision
}
```

Reading `lastprice` is a **simulated (read-only) call** — it costs no fees and
requires no signature, since it doesn't mutate contract state.

## 3. Example client code (testnet)

```ts
import {
  Account,
  Contract,
  rpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Keypair,
  scValToNative,
} from '@stellar/stellar-sdk'

const CONTRACT_ID = 'CA7FLK2OZGSPYFBYXDWCNMSWG7GRZSYDN4OASS4VJXGW3SX3G3GZASP6' // XLM, testnet
const RPC_URL = 'https://soroban-testnet.stellar.org'

async function readLastPrice() {
  const server = new rpc.Server(RPC_URL)
  const contract = new Contract(CONTRACT_ID)

  // Reads don't need a funded account with a real balance — any keypair works
  // as the simulation's "source", since `lastprice` never touches state.
  const source = Keypair.random()
  const account = await server.getAccount(source.publicKey()).catch(
    // Unfunded accounts 404 on getAccount; a zero-sequence account is fine
    // for simulation purposes.
    () => new Account(source.publicKey(), '0'),
  )

  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(contract.call('lastprice'))
    .setTimeout(30)
    .build()

  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`)
  }

  const result = scValToNative(sim.result!.retval) as
    | { price: bigint; timestamp: bigint; decimals: number }
    | undefined

  if (!result) {
    throw new Error('Contract has never published a price')
  }

  const price = Number(result.price) / 10 ** result.decimals
  console.log(`XLM/USD (on-chain): $${price}`, 'published at', new Date(Number(result.timestamp) * 1000))
  return { price, publishedAt: Number(result.timestamp) * 1000 }
}

readLastPrice()
```

Run it with `npx tsx read-price.ts` (or compile with `tsc`) against
`@stellar/stellar-sdk@^16`. This is the same SDK and network defaults this
frontend itself depends on (see `package.json` and `src/lib/stellarAssets.ts`).

## 4. End-to-end flow

```
Aggregator API (off-chain)                Soroban contract (on-chain)
        │                                          │
        │ 1. aggregates Chainlink/Redstone/        │
        │    Band/Reflector into one price          │
        │                                          │
        │ 2. periodically publishes the             │
        │    aggregated price ─────────────────────►│  lastprice() updated
        │                                          │
   GET /api/prices/:pair                     lastprice() (read-only call)
        │                                          │
        ▼                                          ▼
  Off-chain dashboard                    On-chain comparison panel
  (this app, live/polled)                (PriceDetail → OnChainComparisonPanel)
        │                                          │
        └───────────────── compared ───────────────┘
                     divergence % + status
```

In this app, `PriceDetail` renders both sides of that comparison via
[`OnChainComparisonPanel`](../src/components/OnChainComparisonPanel.tsx),
which reads on-chain data through
[`lib/onChainClient.ts`](../src/lib/onChainClient.ts) — the same small client
module every on-chain panel in the app goes through, so the network default
and registry lookups stay consistent everywhere. Divergence is computed by
[`utils/divergence.ts`](../src/utils/divergence.ts) against a threshold
persisted in user preferences (`onChainDivergenceThresholdPercent`).

## 5. Verification steps

Before trusting an on-chain read in your own client:

1. **Confirm the contract ID against the registry** (or your own source of
   truth) — never hardcode an address copied from a block explorer without
   cross-checking it against a canonical list.
2. **Check `timestamp` freshness.** A `lastprice()` read can succeed while
   returning a stale value if the publisher stopped publishing — always
   compare `timestamp` against `Date.now()` and flag anything older than your
   application's staleness tolerance (this app uses
   `preferences.staleThresholdMinutes` for the off-chain side and surfaces
   `publishedAt` directly for the on-chain side).
3. **Compare against the off-chain feed.** A price that has drifted from every
   off-chain source by more than a few basis points is a signal to
   investigate before acting on it — see the divergence threshold above.
4. **Validate ledger sequence monotonicity** if you're polling repeatedly: the
   `ledger` number returned alongside a publish should never decrease between
   reads from the same contract.

## 6. Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| `UnknownAssetError` / `UnknownNetworkError` thrown | Asset or network has no registered contract yet | Check `contractRegistry.ts`, or supply `VITE_ORACLE_CONTRACT_OVERRIDES` for a local deployment |
| Simulation returns `None`, or errors with `Error(Storage, MissingValue)` / "non-existing value for contract instance" | Contract deployed but has never received a publish, or (currently, for the placeholder addresses in §1) not deployed at all yet | Confirm the publisher process is running against the same contract ID and network; see the status note in §1 |
| `getAccount` 404s for the simulation source | Using a freshly generated keypair with no ledger entry | Harmless for reads — build the transaction with a zero-sequence `Account` instead, as shown above |
| RPC request times out / connection refused | Wrong `RPC_URL` for the network, or Soroban RPC rate limiting | Double-check the network passphrase matches the RPC endpoint; back off and retry on `429`s |
| On-chain price way outside recent history | Publisher misconfiguration, or you're pointed at the wrong contract/network | Cross-check the contract ID against the table in §1 before assuming an oracle fault |

## See also

- [`src/lib/contractRegistry.ts`](../src/lib/contractRegistry.ts) — the registry itself, plus its unit tests
- [`src/lib/onChainClient.ts`](../src/lib/onChainClient.ts) — the on-chain client module the UI uses
- [`src/components/OnChainComparisonPanel.tsx`](../src/components/OnChainComparisonPanel.tsx) — the divergence UI
- [Soroban docs: Reading contract data](https://developers.stellar.org/docs/build/smart-contracts/getting-started/data-storage)
- [`/api-docs`](/api-docs) in this app — the off-chain REST/WebSocket API this guide's on-chain reads are compared against
