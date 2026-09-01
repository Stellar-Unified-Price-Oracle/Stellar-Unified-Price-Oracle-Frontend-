/**
 * Custom hook for managing user-defined watchlists.
 *
 * - Persists to a dedicated IndexedDB store via `watchlistIndexedDB`.
 * - Syncs changes across tabs via BroadcastChannel.
 * - Exposes CSV import/export helpers.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getAllWatchlists,
  saveWatchlist,
  deleteWatchlist as idbDeleteWatchlist,
} from '../services/watchlistIndexedDB'
import type { WatchlistEntry } from '../services/watchlistIndexedDB'
import { createBroadcastChannel } from '../utils/broadcastChannel'
import type { BroadcastMessageType } from '../utils/broadcastChannel'

// Re-export for consumers
export type { WatchlistEntry }

// One shared channel instance per tab
const watchlistsChannel = createBroadcastChannel<WatchlistEntry[]>('kiro-watchlists')

const WATCHLISTS_UPDATE_TYPE = 'watchlists-update' as BroadcastMessageType

// ---------- CSV helpers ----------

/**
 * Serialises watchlists to a CSV string.
 * Format: `name,pairs` (pairs are `|`-separated within the cell).
 */
function toCsv(watchlists: WatchlistEntry[]): string {
  const header = 'name,pairs'
  const rows = watchlists.map((w) => {
    const escapedName = w.name.includes(',') ? `"${w.name.replace(/"/g, '""')}"` : w.name
    return `${escapedName},${w.pairs.join('|')}`
  })
  return [header, ...rows].join('\n')
}

/**
 * Parses a CSV string (produced by `toCsv`) and returns partial entries
 * suitable for `createWatchlist`.
 */
function parseCsv(csv: string): Array<{ name: string; pairs: string[] }> {
  const lines = csv.trim().split('\n')
  const results: Array<{ name: string; pairs: string[] }> = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.toLowerCase().startsWith('name,')) continue

    // Minimal CSV parsing: handle double-quoted names with embedded commas
    let name: string
    let pairsStr: string

    if (line.startsWith('"')) {
      const closeQuote = line.indexOf('"', 1)
      name = line.slice(1, closeQuote).replace(/""/g, '"')
      pairsStr = line.slice(closeQuote + 2) // skip `",`
    } else {
      const commaIdx = line.indexOf(',')
      if (commaIdx === -1) continue
      name = line.slice(0, commaIdx)
      pairsStr = line.slice(commaIdx + 1)
    }

    name = name.trim()
    if (!name) continue

    const pairs = pairsStr
      .split('|')
      .map((p) => p.trim())
      .filter(Boolean)

    results.push({ name, pairs })
  }
  return results
}

// ---------- Hook ----------

export interface UseWatchlistsReturn {
  watchlists: WatchlistEntry[]
  activeWatchlistId: string | null
  watchlistModeEnabled: boolean
  activeWatchlist: WatchlistEntry | null
  createWatchlist: (name: string) => WatchlistEntry
  renameWatchlist: (id: string, name: string) => void
  deleteWatchlist: (id: string) => void
  addPairToWatchlist: (id: string, pair: string) => void
  removePairFromWatchlist: (id: string, pair: string) => void
  reorderWatchlists: (ids: string[]) => void
  setActiveWatchlist: (id: string | null) => void
  toggleWatchlistMode: () => void
  exportCsv: () => string
  importCsv: (csv: string) => void
}

export function useWatchlists(): UseWatchlistsReturn {
  const [watchlists, setWatchlists] = useState<WatchlistEntry[]>([])
  const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(null)
  const [watchlistModeEnabled, setWatchlistModeEnabled] = useState(false)

  // Track whether the initial load from IDB has happened so we don't
  // accidentally broadcast the empty initial state before loading.
  const loadedRef = useRef(false)

  // Load watchlists from IndexedDB on mount
  useEffect(() => {
    getAllWatchlists().then((entries) => {
      setWatchlists(entries)
      loadedRef.current = true
    })
  }, [])

  // Subscribe to changes from other tabs
  useEffect(() => {
    const unsubscribe = watchlistsChannel.subscribe((msg) => {
      if (msg.type === WATCHLISTS_UPDATE_TYPE) {
        setWatchlists(msg.payload)
      }
    })
    return unsubscribe
  }, [])

  // Helper: persist a batch of updated watchlists then broadcast to other tabs
  const persistAndBroadcast = useCallback(
    async (updated: WatchlistEntry[]) => {
      // Persist each entry (upsert)
      await Promise.all(updated.map((e) => saveWatchlist(e)))
      watchlistsChannel.broadcast(WATCHLISTS_UPDATE_TYPE, updated)
    },
    [],
  )

  // ---------- CRUD ----------

  const createWatchlist = useCallback(
    (name: string): WatchlistEntry => {
      const now = Date.now()
      const entry: WatchlistEntry = {
        id: crypto.randomUUID(),
        name,
        pairs: [],
        createdAt: now,
        updatedAt: now,
        order: watchlists.length,
      }
      const updated = [...watchlists, entry]
      setWatchlists(updated)
      saveWatchlist(entry)
      watchlistsChannel.broadcast(WATCHLISTS_UPDATE_TYPE, updated)
      return entry
    },
    [watchlists],
  )

  const renameWatchlist = useCallback(
    (id: string, name: string) => {
      const updated = watchlists.map((w) =>
        w.id === id ? { ...w, name, updatedAt: Date.now() } : w,
      )
      setWatchlists(updated)
      persistAndBroadcast(updated)
    },
    [watchlists, persistAndBroadcast],
  )

  const deleteWatchlist = useCallback(
    (id: string) => {
      const updated = watchlists
        .filter((w) => w.id !== id)
        .map((w, i) => ({ ...w, order: i }))
      setWatchlists(updated)
      idbDeleteWatchlist(id)
      watchlistsChannel.broadcast(WATCHLISTS_UPDATE_TYPE, updated)
      if (activeWatchlistId === id) {
        setActiveWatchlistId(null)
      }
    },
    [watchlists, activeWatchlistId],
  )

  const addPairToWatchlist = useCallback(
    (id: string, pair: string) => {
      const updated = watchlists.map((w) => {
        if (w.id !== id) return w
        if (w.pairs.includes(pair)) return w // no duplicates
        return { ...w, pairs: [...w.pairs, pair], updatedAt: Date.now() }
      })
      setWatchlists(updated)
      persistAndBroadcast(updated)
    },
    [watchlists, persistAndBroadcast],
  )

  const removePairFromWatchlist = useCallback(
    (id: string, pair: string) => {
      const updated = watchlists.map((w) =>
        w.id === id
          ? { ...w, pairs: w.pairs.filter((p) => p !== pair), updatedAt: Date.now() }
          : w,
      )
      setWatchlists(updated)
      persistAndBroadcast(updated)
    },
    [watchlists, persistAndBroadcast],
  )

  const reorderWatchlists = useCallback(
    (ids: string[]) => {
      const indexed = new Map(watchlists.map((w) => [w.id, w]))
      const updated = ids
        .map((id, i) => {
          const entry = indexed.get(id)
          return entry ? { ...entry, order: i } : null
        })
        .filter((e): e is WatchlistEntry => e !== null)
      setWatchlists(updated)
      persistAndBroadcast(updated)
    },
    [watchlists, persistAndBroadcast],
  )

  const setActiveWatchlist = useCallback((id: string | null) => {
    setActiveWatchlistId(id)
  }, [])

  const toggleWatchlistMode = useCallback(() => {
    setWatchlistModeEnabled((prev) => !prev)
  }, [])

  // ---------- CSV Import / Export ----------

  const exportCsv = useCallback((): string => {
    return toCsv(watchlists)
  }, [watchlists])

  const importCsv = useCallback(
    (csv: string) => {
      const parsed = parseCsv(csv)
      const now = Date.now()
      const newEntries: WatchlistEntry[] = parsed.map((item, i) => ({
        id: crypto.randomUUID(),
        name: item.name,
        pairs: item.pairs,
        createdAt: now,
        updatedAt: now,
        order: watchlists.length + i,
      }))

      const updated = [...watchlists, ...newEntries]
      setWatchlists(updated)
      Promise.all(newEntries.map((e) => saveWatchlist(e))).then(() => {
        watchlistsChannel.broadcast(WATCHLISTS_UPDATE_TYPE, updated)
      })
    },
    [watchlists],
  )

  // ---------- Derived state ----------

  const activeWatchlist =
    activeWatchlistId != null
      ? (watchlists.find((w) => w.id === activeWatchlistId) ?? null)
      : null

  return {
    watchlists,
    activeWatchlistId,
    watchlistModeEnabled,
    activeWatchlist,
    createWatchlist,
    renameWatchlist,
    deleteWatchlist,
    addPairToWatchlist,
    removePairFromWatchlist,
    reorderWatchlists,
    setActiveWatchlist,
    toggleWatchlistMode,
    exportCsv,
    importCsv,
  }
}
