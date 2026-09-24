/**
 * Durable write layer for `localStorage`-backed state.
 *
 * ## The problem
 *
 * Alerts and alert history live in `localStorage`, and React state is the
 * source of truth for both. `storage.ts` writes are failure-tolerant by design:
 * Safari private mode, blocked cookies, and — the case that matters here — a
 * full quota all make `setItem` throw, and that throw was swallowed silently.
 * The result is state the user can see and act on that is not actually
 * persisted. An alert is configured and evaluating in the UI; the write that
 * would have saved it never landed; a reload loses it with no signal.
 *
 * ## The recovery story
 *
 * Every write to a `localStorage`-backed key goes through {@link persistDurable}:
 *
 * 1. Attempt the write. On success, drop any pending entry for that key — a
 *    later successful write always supersedes an earlier failed one, so a stale
 *    outbox entry can never clobber newer data.
 * 2. On failure, record the serialized payload in a durable outbox and retry
 *    with exponential backoff.
 * 3. Flush the outbox on startup (recovering writes a previous session lost),
 *    when the tab becomes visible again, when the browser comes back online,
 *    and synchronously on `pagehide`. Startup recovery is armed by
 *    {@link installDurableWriteListeners}, which `main.tsx` calls alongside the
 *    other `install*()` startup hooks — importing this module starts no I/O.
 *
 * The outbox is last-write-wins with one entry per key. Both alerts and alert
 * history are a single `localStorage` key holding the whole value, so one entry
 * per key is exactly the right granularity — there is no ordering to preserve
 * between keys, and a retry is a byte-for-byte replay of the write that failed.
 *
 * ## Where the outbox lives, and why
 *
 * IndexedDB (the `preferences` store, the app's general keyed store for
 * non-cache data), not `localStorage`. The dominant failure mode is a full
 * `localStorage` quota, so persisting the recovery record in the very medium
 * that is out of space would defeat the point. IndexedDB has its own, much
 * larger budget, which means the outbox survives both the reload and the quota
 * error that created it.
 *
 * ## What this does not do
 *
 * - **Heals silently.** By design: a failure is logged (`console.warn`) and
 *   reported through `reportError` for the debug overlay and analytics, with no
 *   user-facing prompt.
 * - **Guarantee cross-tab ordering.** If two tabs retry different values for
 *   the same key, whichever write lands last wins — the same semantics as any
 *   other `localStorage` write in this app.
 * - **Act as a transaction log.** It cannot make the IndexedDB-backed layers
 *   (preferences, export schedules) consistent with their React state.
 * - **Assume the outbox is reachable.** The outbox is best-effort: if it cannot
 *   be read or written, retries continue in memory for the rest of the session
 *   and the failure is logged rather than thrown, so a broken IndexedDB
 *   narrows the recovery window instead of breaking the write path.
 */

import { idbCache } from '../hooks/useIndexedDB'
import { reportError } from './errorReporting'
import { _registerDurableReset, tryWriteRaw, type StorageKey } from './storage'

/**
 * IndexedDB location of the outbox. The `preferences` store accepts arbitrary
 * keys and is already the home of non-cache data (saved views, export
 * schedules), so no schema migration is needed.
 */
const OUTBOX_STORE = 'preferences'
const OUTBOX_KEY = 'durable-writes'
/** No TTL — a pending write waits as long as it takes. */
const OUTBOX_TTL_MS = Infinity

/** Retry delay before the first retry; doubles per consecutive failure. */
const BASE_RETRY_DELAY_MS = 1_000
/** Ceiling for the backoff, so a permanent failure does not spin the CPU. */
const MAX_RETRY_DELAY_MS = 60_000

/**
 * One write that failed and is awaiting retry.
 *
 * Holds the already-serialized payload rather than the live value: a retry has
 * to replay the exact bytes that failed, and the value may since have been
 * mutated or be a different shape after a reload.
 */
export interface PendingWrite {
  key: StorageKey
  serialized: string
  /** Consecutive failed attempts, starting at 1 for the initial failure. */
  attempts: number
  firstFailedAt: number
  lastAttemptAt: number
  lastError: string
}

type Outbox = Record<string, PendingWrite>

function isPendingWrite(value: unknown): value is PendingWrite {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.key === 'string' &&
    typeof entry.serialized === 'string' &&
    typeof entry.attempts === 'number' &&
    typeof entry.firstFailedAt === 'number' &&
    typeof entry.lastAttemptAt === 'number' &&
    typeof entry.lastError === 'string'
  )
}

/** Stored outbox data is untrusted input — anything on the origin can write it. */
function isOutbox(value: unknown): value is Outbox {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return Object.values(value as Record<string, unknown>).every(isPendingWrite)
}

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

/**
 * Pending writes for this session. Authoritative over the persisted copy: an
 * entry enqueued now is by definition newer than what a previous session left
 * behind, so {@link hydrate} merges the persisted copy in around it.
 */
const pending = new Map<string, PendingWrite>()

const retryTimers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Keys successfully written during this session. A persisted outbox entry for
 * one of these is stale — a write that landed after it must not be undone by
 * replaying the older failed value (e.g. a queue flushed on startup racing a
 * fresh write to the same key).
 */
const superseded = new Set<string>()

let installed = false
/** Whether the one-time startup recovery has been kicked off. */
let started = false
let hydrating: Promise<void> | null = null
let flushing: Promise<number> | null = null

/**
 * Bumped by {@link _resetDurableWrites}. An in-flight outbox read captures the
 * value it started under and discards its result if the generation has moved on
 * — otherwise a read that began before `clearAllData` would land after the wipe
 * and repopulate the outbox with the very writes the wipe was meant to drop.
 */
let epoch = 0

// ---------------------------------------------------------------------------
// Outbox persistence
// ---------------------------------------------------------------------------

/**
 * Whether the current outbox outage has already been reported. Cleared by the
 * next successful outbox I/O, so a persistently broken IndexedDB reports once
 * per outage rather than once per retry.
 */
let outboxFailureReported = false

function reportOutboxFailure(phase: 'read' | 'write', error: unknown): void {
  const reason = error instanceof Error ? error.message : String(error)
  console.warn(`[durableWrites] Could not ${phase} the IndexedDB outbox: ${reason}`)
  if (outboxFailureReported) return
  outboxFailureReported = true
  reportError(`Durable-write outbox ${phase} failed`, {
    level: 'warning',
    context: { operation: 'durable-write-outbox', phase, error: reason },
  })
}

/**
 * Reads the persisted outbox. Never rejects: an unreadable outbox (IndexedDB
 * blocked or unavailable) degrades to an empty one. Recovery is best-effort and
 * must not fail the flush that called it.
 */
async function readOutbox(): Promise<Outbox> {
  try {
    const stored = await idbCache.get<unknown>(OUTBOX_STORE, OUTBOX_KEY, OUTBOX_TTL_MS)
    outboxFailureReported = false
    return isOutbox(stored) ? stored : {}
  } catch (error) {
    reportOutboxFailure('read', error)
    return {}
  }
}

/**
 * Persists the current outbox. Never rejects: if the outbox cannot be written,
 * the pending entries still retry from memory for the rest of the session.
 */
async function writeOutbox(): Promise<void> {
  try {
    if (pending.size === 0) {
      await idbCache.delete(OUTBOX_STORE, OUTBOX_KEY)
    } else {
      const box: Outbox = {}
      for (const [key, entry] of pending) box[key] = entry
      await idbCache.set(OUTBOX_STORE, OUTBOX_KEY, box)
    }
    outboxFailureReported = false
  } catch (error) {
    reportOutboxFailure('write', error)
  }
}

/** Merges the persisted outbox into memory once per session. */
function hydrate(): Promise<void> {
  if (!hydrating) {
    const startedAt = epoch
    hydrating = readOutbox().then((stored) => {
      if (startedAt !== epoch) return
      for (const [key, entry] of Object.entries(stored)) {
        if (pending.has(key) || superseded.has(key)) continue
        pending.set(key, entry)
      }
    })
  }
  return hydrating
}

// ---------------------------------------------------------------------------
// Retry
// ---------------------------------------------------------------------------

function retryDelay(attempts: number): number {
  return Math.min(BASE_RETRY_DELAY_MS * 2 ** Math.max(0, attempts - 1), MAX_RETRY_DELAY_MS)
}

function clearRetryTimer(key: string): void {
  const timer = retryTimers.get(key)
  if (timer !== undefined) {
    clearTimeout(timer)
    retryTimers.delete(key)
  }
}

function scheduleRetry(key: string): void {
  if (typeof window === 'undefined') return
  clearRetryTimer(key)
  const entry = pending.get(key)
  if (!entry) return
  retryTimers.set(
    key,
    setTimeout(() => {
      void flushKey(key)
    }, retryDelay(entry.attempts)),
  )
}

/** Retries one key once: drops it on success, backs off and reschedules on failure. */
async function flushKey(key: string): Promise<boolean> {
  const entry = pending.get(key)
  if (!entry) return true

  const result = tryWriteRaw(entry.key, entry.serialized)
  if (result.ok) {
    pending.delete(key)
    clearRetryTimer(key)
    await writeOutbox()
    console.info(`[durableWrites] Recovered pending write for "${entry.key}" after ${entry.attempts} attempt(s)`)
    return true
  }

  pending.set(key, {
    ...entry,
    attempts: entry.attempts + 1,
    lastAttemptAt: Date.now(),
    lastError: result.error || 'unknown storage error',
  })
  await writeOutbox()
  scheduleRetry(key)
  return false
}

/** Drops any pending entry for `key` — a subsequent successful write supersedes it. */
function clearPending(key: string): void {
  clearRetryTimer(key)
  if (!pending.delete(key)) return
  void writeOutbox()
}

function enqueue(key: StorageKey, serialized: string, error: string): void {
  const now = Date.now()
  const existing = pending.get(key)
  pending.set(key, {
    key,
    serialized,
    attempts: (existing?.attempts ?? 0) + 1,
    firstFailedAt: existing?.firstFailedAt ?? now,
    lastAttemptAt: now,
    lastError: error,
  })
  void writeOutbox()
  scheduleRetry(key)

  console.warn(`[durableWrites] Write to "${key}" failed (${error}); queued for retry`)
  if (!existing) {
    // Report once per failure run rather than once per retry — a full quota
    // would otherwise emit a report every backoff interval, forever.
    reportError(`Durable write to "${key}" failed and was queued for retry`, {
      level: 'warning',
      context: { operation: 'durable-write', key, error },
    })
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Persists `value` under `key`, falling back to the durable outbox when the
 * write fails.
 *
 * Returns `true` when the value reached storage, `false` when it was queued for
 * retry (or could never be persisted because it is not serializable). Callers
 * keep their in-memory state either way — the outbox exists so the two do not
 * have to agree immediately.
 */
export function persistDurable(key: StorageKey, value: unknown): boolean {
  ensureListeners()

  // Widen the type so the runtime `undefined` from `JSON.stringify` is visible
  // to the check below (its declared return type is `string`).
  let serialized: string | undefined
  try {
    serialized = JSON.stringify(value)
  } catch (e) {
    serialized = undefined
    reportUnpersistable(key, e instanceof Error ? e.message : String(e))
    return false
  }
  if (typeof serialized !== 'string') {
    reportUnpersistable(key, 'value serialized to undefined')
    return false
  }

  const result = tryWriteRaw(key, serialized)
  if (result.ok) {
    superseded.add(key)
    clearPending(key)
    return true
  }

  enqueue(key, serialized, result.error || 'unknown storage error')
  return false
}

function reportUnpersistable(key: StorageKey, reason: string): void {
  const message = `[durableWrites] Value for "${key}" cannot be persisted (${reason})`
  console.warn(message)
  reportError(message, { level: 'warning', context: { operation: 'durable-write', key } })
}

/**
 * Retries every pending write, oldest failure first, and returns how many
 * recovered. Also hydrates the outbox a previous session left behind.
 *
 * Concurrent calls coalesce onto a single run and share its result. Without
 * that, two triggers firing together (`online` and a retry timer, say) would
 * each walk the same entry — double-writing it and double-counting the attempt,
 * which would then skip a backoff step.
 */
export function flushPendingWrites(): Promise<number> {
  if (!flushing) {
    flushing = runFlush().finally(() => {
      flushing = null
    })
  }
  return flushing
}

async function runFlush(): Promise<number> {
  await hydrate()
  let recovered = 0
  for (const key of [...pending.keys()]) {
    if (superseded.has(key)) {
      clearPending(key)
      continue
    }
    if (await flushKey(key)) recovered++
  }
  return recovered
}

/**
 * Best-effort flush for `pagehide`, where an `await` on IndexedDB may not
 * complete before the page is torn down.
 *
 * Retries only what is already in memory, synchronously; the persisted outbox
 * is left untouched and re-read on the next boot. Returns the number recovered.
 */
export function flushPendingWritesSync(): number {
  let recovered = 0
  for (const [key, entry] of pending) {
    if (tryWriteRaw(entry.key, entry.serialized).ok) {
      clearRetryTimer(key)
      pending.delete(key)
      recovered++
    }
  }
  return recovered
}

/** Snapshot of the writes still awaiting retry. */
export function getPendingWrites(): PendingWrite[] {
  return [...pending.values()]
}

/**
 * Installs the recovery listeners without flushing. Idempotent.
 *
 * Kept separate from {@link installDurableWriteListeners} so the write path can
 * arm the listeners without kicking off a flush that would race the write the
 * caller is in the middle of making.
 */
function ensureListeners(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('online', () => {
    void flushPendingWrites()
  })

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      // A hidden tab's timers are throttled, so a retry scheduled in the
      // background may be minutes late. Coming back to the foreground is the
      // earliest reliable point to catch up.
      if (document.visibilityState === 'visible') void flushPendingWrites()
    })
  }

  // `pagehide` is the last reliable hook before a close or a bfcache freeze.
  window.addEventListener('pagehide', () => {
    flushPendingWritesSync()
  })
}

/**
 * Installs the recovery listeners and flushes anything a previous session left
 * behind, so a session that never writes still recovers what the last one lost.
 *
 * Called from `main.tsx` rather than at module load: importing this module must
 * not start IndexedDB work as a side effect of evaluation.
 *
 * Idempotent. The flush is separate from listener installation, which is armed
 * earlier by {@link persistDurable}, so a write made before this runs still
 * gets its listener without suppressing the startup flush.
 */
export function installDurableWriteListeners(): void {
  if (typeof window === 'undefined') return
  ensureListeners()
  if (started) return
  started = true
  // Nothing below rejects (the outbox I/O is guarded), so no `catch` is needed
  // to keep this off the unhandled-rejection path.
  void flushPendingWrites()
}

/**
 * Drops all session state: timers, the in-memory outbox, and the supersede set.
 *
 * Called by `clearAllData` (so a queued retry cannot resurrect wiped data) and
 * by tests. The persisted outbox is left alone — the next hydration re-reads it.
 */
export function _resetDurableWrites(): void {
  epoch++
  for (const timer of retryTimers.values()) clearTimeout(timer)
  retryTimers.clear()
  pending.clear()
  superseded.clear()
  installed = false
  started = false
  outboxFailureReported = false
  hydrating = null
  // A flush still in flight is left to settle on its own; it can no longer see
  // any pending entry (the map is empty), so it cannot write anything.
  flushing = null
}

// Let `clearAllData` drop in-flight writes along with the data they would
// restore, without importing this module (which would be a cycle).
_registerDurableReset(_resetDurableWrites)
