/**
 * Client-side outbound rate limiting (issue #330).
 *
 * A token bucket per endpoint group shapes outbound traffic so the app cannot
 * out-run the server during WebSocket reconnection storms or rapid navigation.
 * Requests that exceed the bucket are **queued in FIFO order** rather than
 * dropped, and released as tokens refill.
 *
 * The limiter is deliberately transport-agnostic: `fetchWithRetry` awaits
 * {@link OutboundRateLimiter.wait} before every attempt (including retries), so
 * a retry storm is shaped by the same budget as first-time traffic.
 */
import { rateLimitManager } from './rateLimit'

/** Endpoint groups. Each gets an independent budget. */
export type EndpointGroup = 'prices' | 'history' | 'health' | 'default'

export interface EndpointRateLimit {
  /** Maximum burst size — tokens available when fully replenished. */
  capacity: number
  /** Sustained refill rate, in tokens per second. */
  refillPerSecond: number
}

// ---------------------------------------------------------------------------
// Configurable limits — tune outbound traffic shaping app-wide from here.
// ---------------------------------------------------------------------------

export const OUTBOUND_RATE_LIMITS: Record<EndpointGroup, EndpointRateLimit> = {
  /** Price polling + per-pair confirmations: the highest-volume group. */
  prices: { capacity: 12, refillPerSecond: 8 },
  /** History/batch-history: heavier server-side, so a tighter budget. */
  history: { capacity: 6, refillPerSecond: 3 },
  /** Health checks: background only, should never crowd out real traffic. */
  health: { capacity: 2, refillPerSecond: 1 },
  /** Anything unmatched. */
  default: { capacity: 8, refillPerSecond: 4 },
}

/** Snapshot of queue depth and server-directed backoff, for UI back-pressure. */
export interface OutboundQueueState {
  /** Total requests waiting across every group. */
  queued: number
  /** Queue depth per endpoint group. */
  queuedByGroup: Record<EndpointGroup, number>
  /** `true` while a server `Retry-After` window is in effect. */
  blocked: boolean
  /** Epoch ms when the server-directed block expires (0 when not blocked). */
  blockedUntil: number
}

type Listener = () => void

interface QueueEntry {
  resolve: () => void
  reject: (reason: DOMException) => void
  signal?: AbortSignal
  onAbort?: () => void
}

interface Bucket {
  tokens: number
  updatedAt: number
  queue: QueueEntry[]
  timer: ReturnType<typeof setTimeout> | null
}

export interface OutboundRateLimiterOptions {
  limits?: Partial<Record<EndpointGroup, EndpointRateLimit>>
  enabled?: boolean
  /**
   * Invoked when a server-directed backoff begins. Used to bridge the limiter
   * to non-`fetch` transports (the WebSocket client) which cannot be gated by
   * token buckets. Injected rather than imported directly so unit tests can
   * observe it without mutating app-wide singletons.
   */
  onBlock?: (ms: number) => void
}

const GROUPS: EndpointGroup[] = ['prices', 'history', 'health', 'default']

/**
 * Maps a request target to its endpoint group. Checked most-specific first:
 * `/api/prices/history/batch` must resolve to `history`, not `prices`.
 */
export function resolveEndpointGroup(input: RequestInfo | URL): EndpointGroup {
  const value =
    typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url
  if (value.includes('/history')) return 'history'
  if (value.includes('/health')) return 'health'
  if (value.includes('/prices')) return 'prices'
  return 'default'
}

/**
 * Throttling is opt-in under `MODE === 'test'`. The existing `retry` and `rest`
 * suites drive dozens of requests through a frozen clock; a shared bucket would
 * queue them forever. Tests that exercise the limiter enable it explicitly via
 * {@link OutboundRateLimiter.configure}.
 */
function defaultEnabled(): boolean {
  return import.meta.env.MODE !== 'test'
}

export class OutboundRateLimiter {
  private readonly limits: Record<EndpointGroup, EndpointRateLimit>
  private readonly onBlock?: (ms: number) => void
  private buckets = new Map<EndpointGroup, Bucket>()
  private listeners = new Set<Listener>()
  private enabled: boolean
  private blockedUntil = 0
  private unblockTimer: ReturnType<typeof setTimeout> | null = null
  private snapshot: OutboundQueueState

  constructor(options: OutboundRateLimiterOptions = {}) {
    this.limits = { ...OUTBOUND_RATE_LIMITS, ...options.limits }
    this.enabled = options.enabled ?? defaultEnabled()
    this.onBlock = options.onBlock
    this.snapshot = this.buildSnapshot()
  }

  /** Enable or disable shaping at runtime. Used by tests and by the app bootstrap. */
  configure(options: { enabled?: boolean }): void {
    if (options.enabled !== undefined) this.enabled = options.enabled
  }

  /**
   * Resolves when the caller may issue its request. Rejects with `AbortError`
   * if `signal` aborts first, and removes the entry so it never consumes a
   * token that a live request could have used.
   */
  wait(input: RequestInfo | URL, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
    if (!this.enabled) return Promise.resolve()

    const group = resolveEndpointGroup(input)
    const bucket = this.getBucket(group)
    this.refill(bucket, group)

    const clear = Date.now() >= this.blockedUntil
    if (clear && bucket.queue.length === 0 && bucket.tokens >= 1) {
      bucket.tokens -= 1
      return Promise.resolve()
    }

    return new Promise<void>((resolve, reject) => {
      const entry: QueueEntry = { resolve, reject, signal }
      if (signal) {
        entry.onAbort = () => {
          const index = bucket.queue.indexOf(entry)
          if (index >= 0) bucket.queue.splice(index, 1)
          this.publish()
          reject(new DOMException('Aborted', 'AbortError'))
        }
        signal.addEventListener('abort', entry.onAbort, { once: true })
      }
      bucket.queue.push(entry)
      this.publish()
      this.scheduleDrain(bucket, group)
    })
  }

  /**
   * Applies a server-directed backoff to every group, e.g. after a `429` with a
   * `Retry-After` header. Queued work is held for the full window — the server
   * value is honoured as sent, not capped by the client's retry ceiling.
   *
   * Gated on `enabled` so the existing suites' 429 cases cannot mutate
   * app-wide singletons via {@link OutboundRateLimiterOptions.onBlock}.
   */
  blockFor(ms: number): void {
    if (!this.enabled) return

    const until = Date.now() + Math.max(0, ms)
    if (until <= this.blockedUntil) return
    this.blockedUntil = until

    for (const group of GROUPS) {
      const bucket = this.buckets.get(group)
      if (bucket) this.scheduleDrain(bucket, group)
    }

    if (this.unblockTimer) clearTimeout(this.unblockTimer)
    this.unblockTimer = setTimeout(() => {
      this.unblockTimer = null
      this.publish()
    }, Math.max(0, ms))

    this.publish()
    this.onBlock?.(Math.max(0, ms))
  }

  /** Current queue depth and block window. Referentially stable between changes. */
  getSnapshot(): OutboundQueueState {
    return this.snapshot
  }

  /** Subscribes to queue-state changes. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Drops all buckets, timers and queued waiters. For test isolation. */
  reset(): void {
    for (const bucket of this.buckets.values()) {
      if (bucket.timer) clearTimeout(bucket.timer)
      for (const entry of bucket.queue) {
        if (entry.signal && entry.onAbort) entry.signal.removeEventListener('abort', entry.onAbort)
        entry.reject(new DOMException('Aborted', 'AbortError'))
      }
    }
    this.buckets.clear()
    if (this.unblockTimer) clearTimeout(this.unblockTimer)
    this.unblockTimer = null
    this.blockedUntil = 0
    this.publish()
  }

  private getBucket(group: EndpointGroup): Bucket {
    const existing = this.buckets.get(group)
    if (existing) return existing
    const bucket: Bucket = {
      tokens: this.limits[group].capacity,
      updatedAt: Date.now(),
      queue: [],
      timer: null,
    }
    this.buckets.set(group, bucket)
    return bucket
  }

  /** Continuous (fractional) refill, so a burst recovers smoothly rather than in steps. */
  private refill(bucket: Bucket, group: EndpointGroup): void {
    const now = Date.now()
    const elapsed = now - bucket.updatedAt
    if (elapsed <= 0) return
    const { capacity, refillPerSecond } = this.limits[group]
    bucket.tokens = Math.min(capacity, bucket.tokens + (elapsed / 1000) * refillPerSecond)
    bucket.updatedAt = now
  }

  private scheduleDrain(bucket: Bucket, group: EndpointGroup): void {
    if (bucket.queue.length === 0) return
    if (bucket.timer) clearTimeout(bucket.timer)

    this.refill(bucket, group)
    const { refillPerSecond } = this.limits[group]
    const untilToken =
      bucket.tokens >= 1 ? 0 : Math.ceil(((1 - bucket.tokens) / refillPerSecond) * 1000)
    const untilUnblocked = Math.max(0, this.blockedUntil - Date.now())
    const wait = Math.max(untilToken, untilUnblocked)

    bucket.timer = setTimeout(() => this.drain(bucket, group), wait)
  }

  private drain(bucket: Bucket, group: EndpointGroup): void {
    bucket.timer = null
    this.refill(bucket, group)

    if (Date.now() >= this.blockedUntil) {
      while (bucket.tokens >= 1 && bucket.queue.length > 0) {
        const entry = bucket.queue.shift()
        if (!entry) break
        bucket.tokens -= 1
        if (entry.signal && entry.onAbort) entry.signal.removeEventListener('abort', entry.onAbort)
        entry.resolve()
      }
    }

    this.publish()
    if (bucket.queue.length > 0) this.scheduleDrain(bucket, group)
  }

  private buildSnapshot(): OutboundQueueState {
    const queuedByGroup = {} as Record<EndpointGroup, number>
    let queued = 0
    for (const group of GROUPS) {
      const depth = this.buckets.get(group)?.queue.length ?? 0
      queuedByGroup[group] = depth
      queued += depth
    }
    const blocked = Date.now() < this.blockedUntil
    return { queued, queuedByGroup, blocked, blockedUntil: blocked ? this.blockedUntil : 0 }
  }

  /**
   * Recomputes the snapshot and notifies subscribers only when something the UI
   * can see actually changed — `useSyncExternalStore` requires a stable
   * reference between real changes or it will loop.
   */
  private publish(): void {
    const next = this.buildSnapshot()
    const prev = this.snapshot
    const changed =
      next.queued !== prev.queued ||
      next.blocked !== prev.blocked ||
      next.blockedUntil !== prev.blockedUntil ||
      GROUPS.some((g) => next.queuedByGroup[g] !== prev.queuedByGroup[g])
    if (!changed) return
    this.snapshot = next
    this.listeners.forEach((l) => l())
  }
}

/**
 * App-wide limiter shared by every outbound request.
 *
 * A server-directed backoff is mirrored into `rateLimitManager`, which is what
 * `WebSocketClient.scheduleReconnect()` consults. Token buckets can only gate
 * `fetch`; the WebSocket handshake is a different transport, so this bridge is
 * what stops a reconnection storm from hammering a server that just returned
 * `429` — the scenario named in the issue.
 *
 * `clearRateLimit()` runs first because `setRateLimited()` reassigns its
 * auto-reset timer without cancelling the previous one; without this, an
 * earlier short window's orphaned timer would clear a later, longer one early.
 */
export const outboundRateLimiter = new OutboundRateLimiter({
  onBlock: (ms) => {
    rateLimitManager.clearRateLimit()
    rateLimitManager.setRateLimited(Math.max(1, Math.ceil(ms / 1000)))
  },
})
