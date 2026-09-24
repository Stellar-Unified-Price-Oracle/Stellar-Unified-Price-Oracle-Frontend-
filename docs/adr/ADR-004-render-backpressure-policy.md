# ADR-004: Renderer Backpressure Policy for the Live Price Feed

## Status

Accepted

## Context

The realtime feed can deliver substantially more ticks per second than React can
commit and the browser can paint. A concrete worst case: **200 ticks/sec inbound
into a renderer painting at 30 Hz.**

Before this decision there was no explicit policy for that mismatch. Every
`price_update` arriving from `RealtimeClient` (WebSocket, its SSE fallback, or a
BroadcastChannel relay from the leader tab) ran the full pipeline synchronously in
the `onmessage` handler:

1. compute per-source move attribution and commit `attributionHistory`,
2. commit `livePrices` (a new `Map`) and synchronously emit to every
   per-pair subscriber,
3. fire a REST revalidation of that pair.

That is two React state updates and one network request **per tick**. At 200
ticks/sec it is ~400 state updates and ~200 REST requests per second, each tick
arriving in its own task so React cannot batch across them. Two implicit failure
modes follow, and which one you get is an accident of scheduling:

- **Queue** — inbound work is buffered and consumed slower than it arrives. The
  backlog grows without bound, memory grows with it, and the prices on screen
  drift further behind real time every frame, eventually by minutes.
- **Drop** — ticks are discarded with no bookkeeping, so the UI freezes on an
  arbitrary stale value with nothing to alert on.

`WebSocketClient` already carries a transport-level valve (#469): it asks the
server to pause the subscription once inbound traffic exceeds a rate ceiling, and
the wire-level state surfaces as the `paused` connection status. That protects
the socket, but it is a blunt instrument for the _renderer_ problem — a full pause
trades jank for a frozen feed.

ADR-002 also recorded this cost explicitly as a known drawback: _"Revalidation
cost — every WebSocket update triggers a REST call (could be optimized)."_

## Decision

**Latest-wins coalescing per asset pair, applied on the paint cadence.**

The policy is implemented in
[`src/utils/tickCoalescer.ts`](../../src/utils/tickCoalescer.ts) and wired into
`PriceContext`.

### Rules

1. **Key by asset pair, keep only the newest tick.** A tick that arrives for a
   pair already buffered _replaces_ it rather than queueing behind it. Pending
   memory is therefore bounded at O(distinct pairs) regardless of arrival rate —
   200 ticks/sec across 20 pairs never buffers more than 20 entries.

2. **Every superseded tick is counted, not silently lost.** `coalesced` is the
   difference between "sampled down to the paint cadence" and "dropped data".

3. **Flush at most once per animation frame.** `requestAnimationFrame` is the
   authority on how fast the display actually refreshes. When the arrival rate is
   _below_ the frame budget the first tick is applied synchronously, so a slow
   feed pays no added latency — coalescing engages only under overload.

4. **Hard ceiling with an explicit overflow rule.** If the feed presents more
   _distinct_ pairs than `TICK_POLICY.maxPendingPairs`, the overflow is dropped
   and counted — never by evicting a pair the UI is already tracking.

5. **REST revalidation is rate-limited per pair.** At most one request per pair
   per `TICK_POLICY.revalidateIntervalMs` (1 s), and never two in flight for the
   same pair. "REST is canonical" (ADR-002) is preserved; the confirmation
   _interval_ is now bounded instead of unbounded.

6. **Attribution is computed per raw tick, before coalescing.** Attribution is
   pure arithmetic with no React commit, so the render policy must not skip it.
   Only the resulting _state commit_ is batched to the paint cadence, so the
   attribution ring buffer is not decimated.

### Why latest-wins is safe here

A price is last-writer-wins state. An intermediate price that was never painted
had no observer, so no consumer can distinguish "we skipped it" from "it never
arrived" — except via the counters, which is why they exist. This is _not_ true of
a time series: chart and attribution history do care about every point, which is
rule 6.

### Rejected alternatives

- **Bounded FIFO with drop-oldest.** Preserves ordering and history, but lets the
  UI fall behind by the queue depth — precisely the "prices from minutes ago"
  failure. It also spends memory on ticks that can never be painted.
- **Keep every tick, only throttle REST.** Fixes network load but not render
  cost; the jank and the unbounded commit rate remain.
- **`useTransition` / concurrent rendering only.** Deprioritizes the update but
  does not bound the buffer or the request rate, and gives no counter to alert on.

## Implementation

```ts
const coalescer = new TickCoalescer<WsPriceUpdate>()
const pump = createFlushPump(coalescer, applyBatch)

// per incoming tick — ingest path, unchanged in shape
coalescer.enqueue(msg.assetPair, msg)
pump.request() // applies now, or schedules the next frame
```

`applyBatch` performs every `setState` in the same tick, so React commits the
whole batch as **one render**. Counters are exposed to the UI as
`PriceContextValue.tickPolicy`.

## Trade-Offs

### Pro

1. **Memory is bounded by the tracked pair set**, independent of tick rate.
2. **Commit count is decoupled from tick rate** — it tracks the display, not the
   feed. A 30 Hz renderer does ~30 commits/sec whether it receives 30 or 200
   ticks/sec.
3. **Latency stays bounded at one frame** on the screen, and zero extra latency
   below the overload threshold.
4. **Load is observable.** `received`, `coalesced`, `dropped`, `flushes`,
   `peakPending` and `coalesceRatio` make sustained overload alertable, rather
   than an invisible degradation.
5. **REST pressure drops by orders of magnitude** under a flood.

### Con

1. **A pair can stay `optimistic` for up to the revalidation interval** after its
   last tick, because confirmations are now rate-limited. The value shown is still
   the newest tick; only the "confirmed" badge is delayed.
2. **Intermediate prices are not painted.** For a price display this is
   unobservable; for anything that needs the full tick sequence it is not — use a
   path that does not go through this policy.
3. **One more moving part in the ingest path**, with its own counters to watch.

## Rationale

The mismatch between feed rate and paint rate is structural, not a bug to be
optimized away. The system needs to state what it does with the excess, and the
statement needs to be true under load and visible when it happens. Latest-wins
coalescing is the only option that bounds memory, bounds latency, keeps the newest
data on screen, and loses nothing silently — the alternatives each sacrifice one
of those.

## Related Decisions

- **ADR-002**: Data Fetching Strategy — this refines its `Revalidation cost`
  trade-off and preserves its "REST is canonical" invariant.
- **ADR-001**: State Management — where the coalesced state lives.
- **ADR-003**: Component Architecture — the memoization rules that determine how
  expensive one commit is.

## Further Reading

- [`src/utils/tickCoalescer.ts`](../../src/utils/tickCoalescer.ts) — the policy and its counters
- [`src/utils/tickCoalescer.test.ts`](../../src/utils/tickCoalescer.test.ts) — load simulations at 200 ticks/sec
- [`src/context/PriceContext.test.tsx`](../../src/context/PriceContext.test.tsx) — the policy under load through the real provider
- [React: `requestAnimationFrame` and batching](https://react.dev/learn/queueing-a-series-of-state-updates)
- [Coalescing updates (Dan Abramov)](https://overreacted.io/a-complete-guide-to-useeffect/)
