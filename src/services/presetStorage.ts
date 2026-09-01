/**
 * @file IndexedDB persistence for user-authored alert presets (#486).
 *
 * Built-in presets (`src/data/alertPresets.ts`) are static data; a user's own saved
 * presets are unbounded, arbitrarily-shaped objects that don't belong in the same
 * `localStorage` blob as everything else (see `src/utils/storage.ts`'s policy), so
 * they get a small dedicated IndexedDB database instead. Nothing stored here is a
 * secret — a custom preset is just a name plus a condition group/cooldown/escalation
 * template — so, unlike `botNotifications.ts`, `localStorage`-equivalent persistence
 * is fine; IndexedDB is used for its larger quota and structured querying, not for
 * any security reason.
 *
 * All functions are promise-based and safe to call from any environment with an
 * `indexedDB` global (the real browser implementation, or `fake-indexeddb` in tests).
 */
import type { ConditionGroup, EscalationPolicy } from '../types'

const DB_NAME = 'stellar-oracle-presets'
const DB_VERSION = 1
const STORE_NAME = 'customPresets'

export interface CustomAlertPreset {
  id: string
  name: string
  description: string
  suggestedAssetPair: string
  percentageMode: boolean
  conditionGroup: ConditionGroup
  triggerOnce: boolean
  cooldownMinutes: number
  escalationPolicy: EscalationPolicy | null
  createdAt: number
  updatedAt: number
}

export type CustomAlertPresetInput = Omit<CustomAlertPreset, 'id' | 'createdAt' | 'updatedAt'>

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function store(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)
}

function generateId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export const presetStorage = {
  /** Lists every custom preset, newest first. */
  async list(): Promise<CustomAlertPreset[]> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const req = store(db, 'readonly').getAll()
      req.onsuccess = () => resolve((req.result as CustomAlertPreset[]).sort((a, b) => b.createdAt - a.createdAt))
      req.onerror = () => reject(req.error)
    })
  },

  /** Fetches a single custom preset by id, or `null` if it doesn't exist. */
  async get(id: string): Promise<CustomAlertPreset | null> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const req = store(db, 'readonly').get(id)
      req.onsuccess = () => resolve((req.result as CustomAlertPreset | undefined) ?? null)
      req.onerror = () => reject(req.error)
    })
  },

  /** Saves a new custom preset, generating its id and timestamps. Returns the saved record. */
  async create(input: CustomAlertPresetInput): Promise<CustomAlertPreset> {
    const db = await openDB()
    const now = Date.now()
    const record: CustomAlertPreset = { ...input, id: generateId(), createdAt: now, updatedAt: now }
    await new Promise<void>((resolve, reject) => {
      const req = store(db, 'readwrite').add(record)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
    return record
  },

  /** Updates an existing custom preset in place. No-ops (resolves `null`) if it doesn't exist. */
  async update(id: string, updates: Partial<CustomAlertPresetInput>): Promise<CustomAlertPreset | null> {
    const existing = await presetStorage.get(id)
    if (!existing) return null
    const db = await openDB()
    const record: CustomAlertPreset = { ...existing, ...updates, id, updatedAt: Date.now() }
    await new Promise<void>((resolve, reject) => {
      const req = store(db, 'readwrite').put(record)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
    return record
  },

  /** Deletes a custom preset. No-ops if it doesn't exist. */
  async remove(id: string): Promise<void> {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const req = store(db, 'readwrite').delete(id)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  },

  /** Resets the cached DB connection — for tests only. */
  _reset(): void {
    dbPromise = null
  },
}
