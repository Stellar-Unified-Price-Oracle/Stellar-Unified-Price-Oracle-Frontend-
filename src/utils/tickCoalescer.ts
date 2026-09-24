/**
 * Renderer-side backpressure policy for the live price feed (#469).
 *
 * ## The problem
 *
 * The feed can deliver far more ticks per second than React can paint. Without
 * an explicit policy there are two silent failure modes:
 *
 * 1. **Queue everything** — buffer every tick and fall further behind each
 *    frame. Memory grows without bound and the UI eventually shows prices that
 *    are minutes stale.
 * 2. **Drop blindly** — discard the excess with no bookkeeping, so the UI
 *    freezes on an arbitrary stale value and nothing can alert on it.
 *
 * `WebSocketClient` already has a *transport-level* valve for this: it asks the
 * server to pause the subscription once inbound traffic exceeds a rate ceiling
 * (see the `paused` connection status). That protects the wire, but it is a
 * blunt instrument — a full pause trades jank for a frozen feed. This module is
 * the *renderer-level* complement: it accepts the flood and reduces it to what
 * the display can actually consume.
 *
 * ## The policy
 *
 * **Latest-wins coalescing per asset pair, flushed on the paint cadence.**
 *
 * - Ticks are keyed by asset pair. A newer tick for a pair **replaces** the
 *   buffered one instead of queueing behind it, so pending memory is bounded at
 *   O(distinct pairs) regardless of inbound rate — 200 ticks/sec across 20
 *   pairs never buffers more than 20 entries.
 * - Superseded ticks are not silently discarded: they are counted
 *   (`coalesced`), which is what distinguishes "we sampled to the paint
 *   cadence" from "we lost data".
 * - The buffer is drained at most once per animation frame, and the drain is
 *   capped by {@link TICK_POLICY.maxPendingPairs}. If the feed somehow presents
 *   more *distinct* pairs than the cap, the overflow is dropped and counted
 *   (`dropped`) rather than evicting a pair the UI is already tracking.
 * - When the arrival rate is **below** the paint cadence, the zero-latency path
 *   applies each tick immediately — coalescing only engages under overload, so
 *   a slow feed behaves exactly as it did before this policy existed.
 *
 * Coalescing is safe here specifically because a price is last-writer-wins
 * state: an intermediate price that was never painted has no observer, and the
 * ring-buffer attribution history (which *does* care about every tick) is
 * accumulated per raw tick before coalescing, not after.
 *
 * @see docs/adr/ADR-004-render-backpressure-policy.md
 */

import { ATTRIBUTION_RING_BUFFER_SIZE } from '../types'

/** Tunable knobs for the renderer backpressure policy. */
export const TICK_POLICY = {
  /**
   * Minimum spacing between two flushes. One flush per 60 Hz frame; the actual
   * cadence is driven by `requestAnimationFrame`, so a 30 Hz display tiles at
   * 30 flushes/sec rather than 60.
   */
  flushIntervalMs: 1000 / 60,
  /**
   * Hard ceiling on distinct pairs buffered at once. Reaching it means the feed
   * announced more pairs than the renderer is holding, so the overflow is
   * dropped and counted instead of growing the map.
   */
  maxPendingPairs: 512,
  /**
   * Minimum spacing between REST revalidations of the same pair. Collapses the
   * one-request-per-tick storm into at most one request per pair per second,
   * while still honouring the "REST is canonical" invariant (ADR-002).
   */
  revalidateIntervalMs: 1_000,
} as const

/** Counters describing what the policy did with the ticks it was given. */
export interface TickCoalescerStats {
  /** Total ticks handed to {@link TickCoalescer.enqueue}. */
  received: number
  /** Ticks that were superseded by a newer tick for the same pair before flushing. */
  coalesced: number
  /** Ticks dropped because the buffer was already at {@link TICK_POLICY.maxPendingPairs} distinct pairs. */
  dropped: number
  /** Ticks actually delivered to the flush callback. */
  flushed: number
  /** Number of non-empty flushes performed. */
  flushes: number
  /** Distinct pairs currently buffered. */
  pending: number
  /** High-water mark of {@link pending}; should stay bounded by the tracked pair count. */
  peakPending: number
  /** `coalesced / received` — 0 when nothing arrived. Useful for alerting on sustained overload. */
  coalesceRatio: number
  /** Timestamp of the most recent flush, or `null` before the first one. */
  lastFlushAt: number | null
}

/**
 * Latest-wins buffer keyed by asset pair.
 *
 * Deliberately free of React and timers so the policy can be exercised directly
 * under a simulated flood (see `tickCoalescer.test.ts`).
 */
export class TickCoalescer<T> {
  private readonly pending = new Map<string, T>()
  private received = 0
  private coalesced = 0
  private dropped = 0
  private flushed = 0
  private flushes = 0
  private peakPending = 0
  private lastFlushAt: number | null = null

  constructor(private readonly maxPendingPairs: number = TICK_POLICY.maxPendingPairs) {}

  /**
   * Buffers `value` as the newest tick for `key`.
   *
   * A tick already buffered for `key` is replaced (counted as `coalesced`). A
   * tick for an unseen key is only accepted while fewer than
   * {@link TICK_POLICY.maxPendingPairs} pairs are buffered; otherwise it is
   * dropped and counted, keeping the buffer strictly bounded.
   */
  enqueue(key: string, value: T): void {
    this.received++

    if (this.pending.has(key)) {
      this.coalesced++
      this.pending.set(key, value)
      return
    }

    if (this.pending.size >= this.maxPendingPairs) {
      this.dropped++
      return
    }

    this.pending.set(key, value)
    if (this.pending.size > this.peakPending) this.peakPending = this.pending.size
  }

  /**
   * Removes and returns every buffered pair as `[key, newestValue]` in insertion
   * order, then clears the buffer. Returns an empty array when nothing is
   * buffered, in which case no flush is recorded.
   */
  drain(now: number = Date.now()): Array<[string, T]> {
    if (this.pending.size === 0) return []

    const batch = Array.from(this.pending.entries())
    this.pending.clear()
    this.flushed += batch.length
    this.flushes++
    this.lastFlushAt = now
    return batch
  }

  /** Number of distinct pairs currently buffered. */
  get size(): number {
    return this.pending.size
  }

  getStats(): TickCoalescerStats {
    return {
      received: this.received,
      coalesced: this.coalesced,
      dropped: this.dropped,
      flushed: this.flushed,
      flushes: this.flushes,
      pending: this.pending.size,
      peakPending: this.peakPending,
      coalesceRatio: this.received === 0 ? 0 : this.coalesced / this.received,
      lastFlushAt: this.lastFlushAt,
    }
  }

  /** Clears buffered work and every counter. */
  reset(): void {
    this.pending.clear()
    this.received = 0
    this.coalesced = 0
    this.dropped = 0
    this.flushed = 0
    this.flushes = 0
    this.peakPending = 0
    this.lastFlushAt = null
  }
}

/** Opaque handle for a scheduled frame. */
type FrameHandle = number

/**
 * A single entry can only ever hold {@link ATTRIBUTION_RING_BUFFER_SIZE}
 * records in the ring buffer, so a pending batch for one pair never needs to be
 * longer than that — anything beyond it would be evicted on the same flush.
 */
export const MAX_PENDING_ATTRIBUTIONS_PER_PAIR = ATTRIBUTION_RING_BUFFER_SIZE

function scheduleFrame(callback: () => void): FrameHandle {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(callback)
  return setTimeout(callback, TICK_POLICY.flushIntervalMs) as unknown as FrameHandle
}

function cancelFrame(handle: FrameHandle): void {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle)
  else clearTimeout(handle as unknown as ReturnType<typeof setTimeout>)
}

export interface FlushPumpOptions {
  /** Minimum spacing between flushes. Defaults to {@link TICK_POLICY.flushIntervalMs}. */
  flushIntervalMs?: number
  /** Clock, injectable for tests. Defaults to `Date.now`. */
  now?: () => number
  /** Frame scheduler, injectable for tests. Defaults to `requestAnimationFrame`. */
  scheduleFrame?: (callback: () => void) => FrameHandle
  /** Frame canceller, injectable for tests. Defaults to `cancelAnimationFrame`. */
  cancelFrame?: (handle: FrameHandle) => void
}

/**
 * Paces draining of a {@link TickCoalescer} to the paint cadence.
 *
 * `request()` is called once per enqueued tick and decides between two paths:
 *
 * - **Immediate** — a flush is due (nothing scheduled and at least
 *   `flushIntervalMs` has elapsed since the last one), so the batch is applied
 *   synchronously. A feed slower than the frame rate therefore never pays a
 *   frame of added latency.
 * - **Frame-paced** — a flush is already scheduled or the last one is too
 *   recent, so the tick just sits in the coalescer and the scheduled frame will
 *   pick up the newest value for every pair.
 *
 * When the tab is hidden the browser stops firing animation frames, so
 * `request()` keeps coalescing rather than flushing. That is a bounded, not a
 * growing, buffer: at most one tick per pair is retained, and the first frame
 * after the tab becomes visible drains the latest prices.
 */
export interface FlushPump {
  /** Records that work is pending; flushes immediately or schedules a frame. */
  request: () => void
  /** Flushes synchronously, bypassing the cadence gate. */
  flushNow: () => void
  /** Cancels any scheduled frame. Safe to call more than once. */
  stop: () => void
}

export function createFlushPump<T>(
  coalescer: TickCoalescer<T>,
  apply: (batch: Array<[string, T]>) => void,
  options: FlushPumpOptions = {},
): FlushPump {
  const flushIntervalMs = options.flushIntervalMs ?? TICK_POLICY.flushIntervalMs
  const now = options.now ?? (() => Date.now())
  const requestFrame = options.scheduleFrame ?? scheduleFrame
  const cancelScheduledFrame = options.cancelFrame ?? cancelFrame

  let scheduled: FrameHandle | null = null
  let stopped = false

  const flush = (): void => {
    if (scheduled !== null) {
      cancelScheduledFrame(scheduled)
      scheduled = null
    }
    const batch = coalescer.drain(now())
    if (batch.length > 0) apply(batch)
  }

  const request = (): void => {
    if (stopped) return

    const { lastFlushAt } = coalescer.getStats()
    const dueForImmediateFlush = lastFlushAt === null || now() - lastFlushAt >= flushIntervalMs

    if (scheduled === null && dueForImmediateFlush) {
      flush()
      return
    }

    if (scheduled === null) {
      scheduled = requestFrame(flush)
    }
  }

  const flushNow = (): void => {
    if (!stopped) flush()
  }

  const stop = (): void => {
    stopped = true
    if (scheduled !== null) {
      cancelScheduledFrame(scheduled)
      scheduled = null
    }
  }

  return { request, flushNow, stop }
}
