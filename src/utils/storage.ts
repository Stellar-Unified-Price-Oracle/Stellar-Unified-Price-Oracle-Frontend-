/**
 * Single entry point for browser-persisted user data.
 *
 * ## Policy: nothing sensitive goes in `localStorage`
 *
 * `localStorage` is plain text, readable by any script running on the origin, and it
 * survives indefinitely. A single XSS bug exfiltrates all of it. Therefore **never**
 * persist any of the following through this module or directly:
 *
 * - Auth tokens, session IDs, refresh tokens, API keys
 * - Webhook signing secrets or any other shared secret
 * - Passwords or password-equivalent material
 * - PII beyond what the user typed into a local-only setting (no names, addresses,
 *   government IDs, financial account numbers)
 *
 * Secrets belong in memory for the session, or behind an httpOnly cookie set by the
 * backend. If a feature seems to need a persisted secret, that is a signal the
 * operation belongs on the server, not in the browser.
 *
 * What lives here today is deliberately mundane: alert thresholds, notification
 * routing config, an analytics opt-out flag, and the theme choice.
 *
 * ## Why route through this module
 *
 * Every key is registered in {@link STORAGE_KEYS}, so the full set of persisted data
 * is greppable in one place and {@link clearAllData} can guarantee it removes all of
 * it. Reads and writes are failure-tolerant: Safari private mode and blocked-cookie
 * settings make `localStorage` throw, and a thrown storage error should never take
 * down a render.
 *
 * Swapping backends (sessionStorage, IndexedDB, a server-side profile) means changing
 * the helpers below rather than every call site.
 */

import { idbCache } from '../hooks/useIndexedDB'

/**
 * Every `localStorage` key the app owns.
 *
 * Adding a key here is a deliberate act — re-read the policy above first.
 */
export const STORAGE_KEYS = {
  /** Price alert definitions (asset pair + thresholds). */
  alerts: 'price-alerts',
  /** Log of fired alerts, capped to the most recent entries (#309). */
  alertHistory: 'alert-history',
  /** Notification routing config. Never includes the webhook secret — see the policy above. */
  notificationChannels: 'notification-channels',
  /** Developer webhook endpoints (signing secrets remain session-only). */
  developerWebhooks: 'developer-webhooks',
  /** `'1'` when the user has opted out of analytics. */
  analyticsOptOut: 'analyticsOptOut',
  /** `'dark'` / `'light'`. Also read by the pre-paint script in `index.html`. */
  theme: 'stellar-oracle-theme',
  /** Random per-browser bucket id used for sticky percentage-rollout feature flags (#359). No PII. */
  featureFlagBucket: 'feature-flag-bucket',
  /** Ids of alert health flags (#493) the user has dismissed. No PII. */
  alertHealthDismissed: 'alert-health-dismissed',
  /** Alert sound preferences (#308): enabled flag + 0–1 volume. No PII. */
  soundPreferences: 'sound-preferences',
  /** Recently-used UI language codes, newest first (#373). No PII. */
  recentLanguages: 'recent-languages',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

/** IndexedDB stores cleared by {@link clearAllData}. */
const IDB_STORES = ['prices', 'history', 'preferences'] as const

/** Reads a raw string. Returns `null` when absent or when storage is unavailable. */
export function readRaw(key: StorageKey): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Outcome of a raw storage write. */
export interface RawWriteResult {
  ok: boolean
  /** Failure message when `ok` is `false` (empty when storage is unavailable anonymously). */
  error?: string
}

/**
 * Writes a raw string and reports whether it landed.
 *
 * `localStorage.setItem` throws for a whole class of conditions the app must
 * survive — Safari private mode, blocked cookies, and a full quota — and this
 * is the only place that catches them. Prefer this over {@link writeRaw} when
 * the failure is meaningful: a dropped write means the in-memory state the
 * user is looking at is no longer on disk.
 */
export function tryWriteRaw(key: StorageKey, value: string): RawWriteResult {
  try {
    localStorage.setItem(key, value)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Writes a raw string. Returns `false` when storage is unavailable (private
 * mode, quota, blocked cookies) or the write failed for any other reason.
 *
 * A `false` return is a signal, not an error — callers that must not lose the
 * write should route through `persistDurable` in `utils/durableWrites.ts`,
 * which retries it until it lands.
 */
export function writeRaw(key: StorageKey, value: string): boolean {
  return tryWriteRaw(key, value).ok
}

/**
 * Reads and parses JSON, returning `fallback` when the key is absent, storage is
 * unavailable, or the stored value is not valid JSON.
 *
 * Pass `validate` to reject data that parses but has the wrong shape — stored data is
 * untrusted input, since anything on the origin can have written it.
 */
export function readJson<T>(key: StorageKey, fallback: T, validate?: (value: unknown) => value is T): T {
  const raw = readRaw(key)
  if (raw === null) return fallback
  try {
    const parsed: unknown = JSON.parse(raw)
    if (validate) return validate(parsed) ? parsed : fallback
    return parsed as T
  } catch {
    return fallback
  }
}

/**
 * Serializes and writes JSON. Returns `false` when the value was not
 * serializable or the write did not land — see {@link writeRaw}.
 */
export function writeJson(key: StorageKey, value: unknown): boolean {
  try {
    return writeRaw(key, JSON.stringify(value))
  } catch {
    /* value was not serializable */
    return false
  }
}

/** Removes a single key. */
export function remove(key: StorageKey): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* storage unavailable */
  }
}

/**
 * Reset hook for the durable-write outbox, registered by
 * `utils/durableWrites.ts` at module load.
 *
 * {@link clearAllData} has to drop in-flight pending writes along with the data
 * they would restore: a failed alerts write queued earlier in the session would
 * otherwise retry *after* the wipe and resurrect the deleted alerts. The hook
 * keeps the dependency one-directional (`durableWrites` → `storage`), so there
 * is no import cycle.
 */
let durableResetHook: (() => void) | null = null

/** @internal — called by `utils/durableWrites.ts` on module load. */
export function _registerDurableReset(fn: () => void): void {
  durableResetHook = fn
}

/**
 * Removes every piece of user data the app has persisted — all registered
 * `localStorage` keys plus the IndexedDB caches.
 *
 * Intended for a "clear my data" control and for logout, once auth exists. Only keys
 * in {@link STORAGE_KEYS} are touched, so unrelated data on the origin is left alone.
 */
export async function clearAllData(): Promise<void> {
  for (const key of Object.values(STORAGE_KEYS)) {
    remove(key)
  }
  await Promise.all(IDB_STORES.map((store) => idbCache.clear(store)))
  // After the stores are gone, so a retry firing mid-teardown cannot restore them.
  durableResetHook?.()
}

// ---------------------------------------------------------------------------
// Storage size monitoring
// ---------------------------------------------------------------------------

/**
 * Warn threshold: log a console warning when `localStorage` usage for this app
 * exceeds this byte count (default 4 MB — half the typical 10 MB browser quota).
 */
const LS_WARN_THRESHOLD_BYTES = 4 * 1024 * 1024

/**
 * Measures the total size in bytes of all keys owned by this app in
 * `localStorage`. Non-ASCII characters are measured at 2 bytes each (UTF-16
 * encoding used by most browsers).
 *
 * Returns `0` when storage is unavailable.
 *
 * @example
 * ```ts
 * const { bytes, formatted } = getLocalStorageSize()
 * console.log(`localStorage used: ${formatted}`)
 * ```
 */
export function getLocalStorageSize(): { bytes: number; formatted: string } {
  try {
    let bytes = 0
    for (const key of Object.values(STORAGE_KEYS)) {
      const raw = localStorage.getItem(key)
      if (raw !== null) {
        // Key + value, each character is 2 bytes in UTF-16
        bytes += (key.length + raw.length) * 2
      }
    }
    return { bytes, formatted: formatBytes(bytes) }
  } catch {
    return { bytes: 0, formatted: '0 B' }
  }
}

/**
 * Returns a per-key breakdown of localStorage usage for the app's own keys.
 *
 * @example
 * ```ts
 * const breakdown = getLocalStorageBreakdown()
 * // [{ key: 'price-alerts', bytes: 1024, formatted: '1.0 KB' }, ...]
 * ```
 */
export function getLocalStorageBreakdown(): Array<{ key: string; bytes: number; formatted: string }> {
  try {
    return Object.values(STORAGE_KEYS).map((key) => {
      const raw = localStorage.getItem(key)
      const bytes = raw !== null ? (key.length + raw.length) * 2 : 0
      return { key, bytes, formatted: formatBytes(bytes) }
    })
  } catch {
    return []
  }
}

/**
 * Checks localStorage usage against {@link LS_WARN_THRESHOLD_BYTES} and logs a
 * console warning when the threshold is exceeded. Intended to be called on app
 * startup and after significant writes.
 *
 * This is a **monitoring aid only** — the app continues to function regardless.
 */
export function checkStorageSizeWarning(): void {
  const { bytes, formatted } = getLocalStorageSize()
  if (bytes > LS_WARN_THRESHOLD_BYTES) {
    console.warn(
      `[storage] localStorage usage for this app is ${formatted}, which exceeds ` +
        `the ${formatBytes(LS_WARN_THRESHOLD_BYTES)} warning threshold. ` +
        `Consider calling clearAllData() to free space.`,
    )
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

// ---------------------------------------------------------------------------
// Storage inventory (security audit record)
// ---------------------------------------------------------------------------

/**
 * Read-only inventory of everything the app persists and why.
 * This is the authoritative record for storage security reviews.
 *
 * ## localStorage keys
 * | Key                    | Contents                                                           |
 * |------------------------|--------------------------------------------------------------------|
 * | price-alerts           | Alert objects: assetPair + thresholds. No PII, no secrets.        |
 * | alert-history          | Log of triggered alerts: pair, price, timestamp. No PII.          |
 * | notification-channels  | Channel routing config. Webhook URL stored; **signing secret is   |
 * |                        | NOT persisted** (memory-only in NotificationChannelsModal).        |
 * | analyticsOptOut        | '1' (opted out) or '0'. No PII.                                   |
 * | stellar-oracle-theme   | 'dark' or 'light'. No PII.                                        |
 * | feature-flag-bucket    | Random per-browser bucket id for sticky flag rollout. No PII.     |
 * | alert-health-dismissed | Ids of dismissed alert health flags (#493). No PII.                |
 * | sound-preferences      | Alert sound enabled flag + 0–1 volume (#308). No PII.             |
 *
 * ## IndexedDB stores (stellar-oracle DB)
 * | Store       | TTL      | Contents                                               |
 * |-------------|----------|--------------------------------------------------------|
 * | prices      | 5 min    | Aggregated price cache. LRU-evicted at 50 MB.          |
 * | history     | 5 min    | Price history cache. Same eviction policy.             |
 * | preferences | ∞        | User display settings + the durable-write outbox.      |
 *
 * The `preferences` store also holds `durable-writes`, the outbox of
 * `localStorage` writes that failed and are awaiting retry. It lives in
 * IndexedDB rather than `localStorage` on purpose: the failure it recovers from
 * is usually a full `localStorage` quota. See `utils/durableWrites.ts`.
 *
 * Nothing sensitive is stored in either mechanism.
 * See `AGENTS.md` for the full data-handling policy.
 */
export const STORAGE_INVENTORY = Object.freeze({
  localStorage: [
    {
      key: STORAGE_KEYS.alerts,
      description: 'Alert thresholds per asset pair. No PII, no secrets.',
    },
    {
      key: STORAGE_KEYS.alertHistory,
      description: 'Log of triggered alerts (pair + price + timestamp). No PII.',
    },
    {
      key: STORAGE_KEYS.notificationChannels,
      description: 'Channel routing config. Webhook URL stored; signing secret is NOT persisted.',
    },
    {
      key: STORAGE_KEYS.analyticsOptOut,
      description: "Opt-out flag ('1' = opted out). No PII.",
    },
    {
      key: STORAGE_KEYS.theme,
      description: "UI theme choice ('dark'/'light'). No PII.",
    },
    {
      key: STORAGE_KEYS.featureFlagBucket,
      description: 'Random per-browser bucket id for sticky percentage-rollout feature flags. No PII.',
    },
    {
      key: STORAGE_KEYS.alertHealthDismissed,
      description: 'Ids of alert health flags the user has dismissed. No PII.',
    },
    {
      key: STORAGE_KEYS.soundPreferences,
      description: 'Alert sound enabled flag + 0–1 volume. No PII.',
    },
  ],
  indexedDB: [
    {
      store: 'prices' as const,
      ttlMs: 5 * 60 * 1000,
      description: 'Aggregated price cache. Expires after 5 min. LRU-evicted at 50 MB.',
    },
    {
      store: 'history' as const,
      ttlMs: 5 * 60 * 1000,
      description: 'Price history cache. Same policy as prices.',
    },
    {
      store: 'preferences' as const,
      ttlMs: Infinity,
      description: 'User preferences. No expiry; cleared by clearAllData().',
    },
  ],
})
