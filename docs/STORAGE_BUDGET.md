# Client Storage Budget & Eviction (#510)

This documents the storage budget, eviction behavior, and write-batching
strategy for the client-side persistence layer used by preferences, saved
views, scheduled exports, column selections, price/history caching, and alert
history.

## Layers

| Data                                     | Engine                            | Module                           |
| ---------------------------------------- | --------------------------------- | -------------------------------- |
| Alert events, export runs, price history | IndexedDB (`tsPoints`/`tsSeries`) | `src/storage/timeseries`         |
| Prices / price history (response cache)  | IndexedDB                         | `src/hooks/useIndexedDB.ts`      |
| Preferences, saved views, etc.           | IndexedDB                         | `useIdbQuery` / `useIdbMutation` |
| Alert history (boot cache + full log)    | `localStorage`                    | `src/services/alertHistory.ts`   |

## Time-series engine (`src/storage/timeseries`)

Append-only data (fired alerts, export runs, fetched price history) lives in a
purpose-built time-series engine rather than as a growing settings blob. Every
series is kept in up to three resolution tiers and is answered by a query
planner, so a boot read or an export never has to walk the whole history.

- **Stores:** `tsPoints` (one row per `(series, tier, t)`, keyed by that compound
  key so a range scan is a single primary-key `getAll`) and `tsSeries` (each
  series' resolved retention, so maintained series are still trimmed after a
  descriptor is removed). Added by migration **v4**.
- **Retention:** each tier is trimmed to a window, independently per series
  (`enforceRetention`). Defaults are 24h raw → 30d hourly → 1y daily, overridable
  per descriptor. Alert events keep 30d raw, export runs 90d raw, price history
  7d raw — chosen per dataset in `config.ts`.
- **Compaction:** complete raw buckets roll into hourly, hourly into daily
  (`compactSeries`). Each tier is streamed inside a single transaction — the
  aggregated bucket is written and its source rows deleted atomically, so an
  aborted pass leaves the source intact and a re-run recomputes the identical
  bucket (idempotent). Rollups are weighted by observation count `n`, so an
  average of averages stays correct.
- **Query planner:** `planQuery` picks the cheapest tier for a range — raw for
  short windows, hourly/daily for longer ones — and coarsens further to honour a
  `maxPoints` budget. Callers never read raw points just to draw a year-long
  chart.
- **Maintenance cadence:** writes schedule a debounced (2s) maintenance pass; a
  pass also runs once at `initialize()` so retention is enforced even when
  nothing is written.
- **Writes are best-effort:** a failed append/compaction resolves quietly rather
  than throwing into a render, matching the rest of the storage layer.

### Migrated datasets

| Series                 | Source of truth                                                      | Rollup         |
| ---------------------- | -------------------------------------------------------------------- | -------------- |
| `alert-events`         | mirrored from `localStorage` alert log; imported once                | count of fires |
| `export-runs`          | was a `preferences` blob; migrated + legacy blob imported once       | run count      |
| `price-history:<pair>` | projected from fetched history responses; legacy blobs imported once | avg price      |

`localStorage` remains the synchronous boot cache for the alert _log UI_ (the
provider reads it once on mount); the engine is the durable, retained, queryable
copy. The price-history **response cache** stays in the `history` store for fast
2-minute repeat reads — the engine series is what gives that history long-term
retention and rollups.

## IndexedDB budget & eviction

- **Budget:** `MAX_BYTES = 50 MB` per object store (`prices`, `history`,
  `preferences`), tracked via a `size` field computed from
  `JSON.stringify` byte length at write time.
- **Eviction policy:** LRU — when a store exceeds budget, entries are sorted
  by `accessedAt` ascending and deleted oldest-first until back under budget.
- **TTL:** reads via `idbCache.get`/`useIdbQuery` also expire entries older
  than a per-call TTL (default 5 minutes), independent of the size budget.
- **Debounced eviction:** eviction (`idbGetAll` + sort + delete loop) is the
  most expensive part of a write. Instead of running it after every `set()`,
  it is scheduled on a 500ms trailing debounce per store
  (`scheduleEvict` in `useIndexedDB.ts`), so a burst of writes pays the scan
  cost once instead of once per write.
- **Batched writes:** `idbCache.setMany` / `useIdbMutation().setMany` write a
  list of entries in a single IndexedDB transaction, instead of one
  transaction per entry. Prefer this for any bulk or bursty write (e.g.
  replaying a backlog, importing saved views).

## Alert history (`localStorage`)

- **Cap:** capped at `HISTORY_LIMIT = 500` entries (oldest dropped first),
  enforced in `appendHistoryEntries`.
- **Debounced writes:** escalation steps and fast alert conditions can fire
  many times per second (simulation replay, retest detection on volatile
  pairs). Persisting the full log on every single fire blocks the main thread
  once per fire. `saveAlertHistoryDebounced` coalesces bursts into a single
  `localStorage` write per 400ms window; `flushAlertHistory` flushes any
  pending write immediately (called on unmount) so the last burst is never
  lost.
- Cross-tab sync (`BroadcastChannel`) still fires on every state update —
  only the storage write is debounced.

## Durable writes (recovery for failed `localStorage` writes)

The `localStorage` layers above are written with React state as the source of
truth, and `setItem` throws under conditions the app has to survive — Safari
private mode, blocked cookies, and a full quota. Swallowing that throw left
state the user could see and act on that was never actually persisted.

`src/utils/durableWrites.ts` closes that gap for the alerts and alert-history
keys:

- Every write goes through `persistDurable(key, value)`. It attempts the write
  and, on failure, records the serialized payload in a **durable outbox**,
  retrying with exponential backoff (1s base, doubling, 60s ceiling).
- The outbox is **one entry per key, last-write-wins** — matching the shape of
  the data (each key holds the whole value), so there is no cross-key ordering
  to preserve. A successful write to a key clears any pending entry for it, so
  a stale queued value can never clobber a newer one.
- It is flushed on startup (recovering writes a previous session lost), when the
  tab becomes visible, when the browser comes back online, and synchronously on
  `pagehide`. Startup recovery is armed by `installDurableWriteListeners()`, which
  `src/main.tsx` calls alongside the other `install*()` startup hooks — importing
  the module itself starts no I/O.
- The outbox is best-effort. If it cannot be read or written, retries continue in
  memory for the rest of the session and the failure is logged, so a broken
  IndexedDB narrows the recovery window instead of breaking the write path.
- Recovery is **silent**: failures are logged and reported through `reportError`
  for the debug overlay and analytics, not surfaced as user prompts.

### Why the outbox is in IndexedDB

The dominant failure it recovers from is a full `localStorage` quota, so the
recovery record cannot live in the medium that is out of space. It is stored in
the `preferences` object store under the `durable-writes` key — that store
accepts arbitrary keys and is already the home of non-cache data — so no schema
migration is needed.

Note this layer only covers the `localStorage` keys. It is not a transaction log
and cannot reconcile the IndexedDB-backed layers (preferences, export schedules)
with their React state.

## Benchmarking

`npm run bench:idb` (`scripts/bench-idb.mjs`) benchmarks a burst of IndexedDB
writes against `fake-indexeddb`, comparing one-transaction-per-entry against a
single batched transaction, and fails if either exceeds a sane threshold or if
batching regresses to be slower than the sequential path. It runs in CI as an
advisory job (`idb-benchmark` in `.github/workflows/ci.yml`) so runner timing
variance doesn't block merges, but regressions are visible in the job output.
