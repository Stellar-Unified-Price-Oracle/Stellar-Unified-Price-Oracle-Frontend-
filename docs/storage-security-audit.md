# Storage Security Audit

This document is the authoritative record of all data persisted by the Stellar
Unified Price Oracle frontend.  Update it whenever a new key or store is added.

---

## localStorage

All access goes through `src/utils/storage.ts`. Direct `localStorage` calls are
forbidden — see `AGENTS.md § Client Storage Convention`.

| Key | Value type | Contents | PII? | Secrets? |
|-----|-----------|----------|------|---------|
| `price-alerts` | JSON `Alert[]` | Asset pair + threshold values + enabled flag | ✗ | ✗ |
| `alert-history` | JSON `AlertHistoryEntry[]` | Pair, price at trigger time, timestamp | ✗ | ✗ |
| `notification-channels` | JSON `NotificationChannels` | Email address, webhook URL, Telegram chat ID. **Signing secret is NOT included** — it lives in memory only. | email¹ | ✗ |
| `analyticsOptOut` | `'1'` or `'0'` | Analytics opt-out flag | ✗ | ✗ |
| `stellar-oracle-theme` | `'dark'` or `'light'` | UI theme choice | ✗ | ✗ |
| `feature-flag-bucket` | string | Random per-browser bucket id used for sticky percentage-rollout feature flags (#359) | ✗ | ✗ |

¹ The email address is used only for local alert routing, is typed directly by
the user, and never sent to any third party by the frontend.

### What is NOT stored

| Forbidden data | Where it lives instead |
|---------------|----------------------|
| Auth tokens, session IDs, API keys | Memory only (never persisted) |
| Webhook signing secrets | Memory only — `NotificationChannelsModal` state |
| Passwords | Not applicable (no auth in this frontend) |
| Government IDs, financial account numbers | Not collected |

---

## IndexedDB

Database: `stellar-oracle` (version 2), managed by `src/hooks/useIndexedDB.ts`.

| Store | Contents | TTL | Max size | PII? | Secrets? |
|-------|---------|-----|---------|------|---------|
| `prices` | Aggregated price data (pair, price, sources, confidence, timestamp) | 5 minutes | 50 MB (LRU eviction) | ✗ | ✗ |
| `history` | Historical price records for charts | 5 minutes | 50 MB (LRU eviction) | ✗ | ✗ |
| `preferences` | User display / data-fetching settings (refresh interval, chart range, etc.) | ∞ (no expiry) | — | ✗ | ✗ |
| `pendingMutations` | Offline mutation queue — retried when the browser comes online | Until replayed | — | ✗ | ✗ |

### TTL & eviction details

- **IndexedDB entries** expire after 5 minutes (`TTL_MS = 5 * 60 * 1000` ms).
  An entry is deleted on the next `get()` call if `Date.now() - storedAt > ttl`.
- **LRU eviction** fires after every `set()` call when total store size exceeds
  50 MB (`MAX_BYTES = 50 * 1024 * 1024`). The least-recently-accessed entries are
  removed first.
- **Preferences** are loaded with `ttl = Infinity` and never expire automatically;
  they are removed only by `clearAllData()`.

---

## Size Monitoring

`src/utils/storage.ts` exports:

```ts
// Current total size of all app-owned localStorage keys
getLocalStorageSize(): { bytes: number; formatted: string }

// Per-key breakdown
getLocalStorageBreakdown(): Array<{ key: string; bytes: number; formatted: string }>

// Logs a console.warn if usage exceeds 4 MB
checkStorageSizeWarning(): void
```

`checkStorageSizeWarning()` is called during app startup (see `src/main.tsx`) so
developers are warned early if a data-growth bug causes localStorage to bloat.

The warning threshold (4 MB) is half the typical 10 MB browser localStorage
quota, leaving headroom before storage errors appear.

---

## Clear-all Utility

`clearAllData()` in `src/utils/storage.ts`:

```ts
export async function clearAllData(): Promise<void>
```

- Removes all keys in `STORAGE_KEYS` from `localStorage`.
- Calls `idbCache.clear()` for every IndexedDB store (`prices`, `history`,
  `preferences`).
- Touches **only** keys registered in `STORAGE_KEYS` — unrelated origin data is
  left alone.

### User-initiated flow

The **Settings panel** (`src/components/SettingsPanel.tsx`) exposes a
"Clear all local data" button in the **Local data** section:

1. First click shows a warning describing what will be deleted.
2. Confirmation click calls `clearAllData()` then reloads the page so all
   contexts reinitialise with defaults.
3. A cancel button is available until the user confirms.
4. Storage size is shown alongside the button so users understand their footprint.

---

## Logout Behaviour

There is currently no authentication layer in this frontend.  When auth is added:

- `clearAllData()` **must** be called on logout.
- Session tokens must not be stored in `localStorage` or `IndexedDB` — use
  httpOnly cookies set by the backend instead.
- Any PII added to the storage layer in future features must be declared in this
  document and reviewed before merging.

---

## Verification Checklist

Run this before merging any PR that adds or modifies storage:

- [ ] New key added to `STORAGE_KEYS` in `storage.ts`
- [ ] Key described in this document (type, contents, PII flag, secret flag)
- [ ] `clearAllData()` removes the new data (covered by the existing loop over `STORAGE_KEYS`)
- [ ] No token, secret, or PII is written to `localStorage` or `IndexedDB`
- [ ] `getLocalStorageBreakdown()` output manually verified in dev tools
- [ ] `STORAGE_INVENTORY` constant in `storage.ts` updated to include the new key
