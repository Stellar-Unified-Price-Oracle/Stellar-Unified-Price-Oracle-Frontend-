import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWatchlists } from './useWatchlists'
import type { WatchlistEntry } from '../services/watchlistIndexedDB'

// ---------- Mock IndexedDB service ----------

const mockStore: WatchlistEntry[] = []

vi.mock('../services/watchlistIndexedDB', () => {
  return {
    getAllWatchlists: vi.fn(async () => [...mockStore]),
    saveWatchlist: vi.fn(async (entry: WatchlistEntry) => {
      const idx = mockStore.findIndex((e) => e.id === entry.id)
      if (idx !== -1) {
        mockStore[idx] = entry
      } else {
        mockStore.push(entry)
      }
    }),
    deleteWatchlist: vi.fn(async (id: string) => {
      const idx = mockStore.findIndex((e) => e.id === id)
      if (idx !== -1) mockStore.splice(idx, 1)
    }),
    clearWatchlists: vi.fn(async () => {
      mockStore.splice(0, mockStore.length)
    }),
  }
})

// ---------- Mock BroadcastChannel utility ----------

vi.mock('../utils/broadcastChannel', () => {
  const subscribers = new Set<(msg: { type: string; payload: unknown }) => void>()
  return {
    createBroadcastChannel: vi.fn(() => ({
      subscribe: vi.fn((cb: (msg: { type: string; payload: unknown }) => void) => {
        subscribers.add(cb)
        return () => subscribers.delete(cb)
      }),
      broadcast: vi.fn(),
      getTabId: vi.fn(() => 'test-tab'),
      isSupported: vi.fn(() => false),
      close: vi.fn(),
    })),
  }
})

// ---------- Helpers ----------

beforeEach(() => {
  // Clear in-memory mock store before each test
  mockStore.splice(0, mockStore.length)
  vi.clearAllMocks()
})

// Waits for the hook to finish loading from the (mocked) IDB
async function waitForLoad(result: { current: ReturnType<typeof useWatchlists> }) {
  // getAllWatchlists resolves asynchronously in useEffect; give it a tick
  await waitFor(() => {
    // The hook has "loaded" when the mock has been called at least once.
    // We just wait for a stable state.
    expect(result.current).toBeDefined()
  })
}

// ---------- Tests ----------

describe('useWatchlists', () => {
  // ----- createWatchlist -----

  describe('createWatchlist', () => {
    it('adds a new watchlist entry with the given name', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      act(() => {
        result.current.createWatchlist('My Watchlist')
      })

      expect(result.current.watchlists).toHaveLength(1)
      expect(result.current.watchlists[0].name).toBe('My Watchlist')
      expect(result.current.watchlists[0].pairs).toEqual([])
      expect(result.current.watchlists[0].id).toBeDefined()
    })

    it('returns the new WatchlistEntry', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      let entry!: WatchlistEntry
      act(() => {
        entry = result.current.createWatchlist('Stellar Stars')
      })

      expect(entry.name).toBe('Stellar Stars')
      expect(typeof entry.id).toBe('string')
      expect(typeof entry.createdAt).toBe('number')
    })

    it('assigns sequential order values when creating multiple watchlists', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      act(() => {
        result.current.createWatchlist('First')
        result.current.createWatchlist('Second')
      })

      expect(result.current.watchlists[0].order).toBe(0)
      expect(result.current.watchlists[1].order).toBe(1)
    })
  })

  // ----- renameWatchlist -----

  describe('renameWatchlist', () => {
    it('updates the name of the targeted watchlist', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      let id!: string
      act(() => {
        id = result.current.createWatchlist('Old Name').id
      })

      act(() => {
        result.current.renameWatchlist(id, 'New Name')
      })

      const found = result.current.watchlists.find((w) => w.id === id)
      expect(found?.name).toBe('New Name')
    })

    it('does not affect other watchlists', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      let idA!: string
      let idB!: string
      act(() => {
        idA = result.current.createWatchlist('Alpha').id
        idB = result.current.createWatchlist('Beta').id
      })

      act(() => {
        result.current.renameWatchlist(idA, 'Alpha Renamed')
      })

      const beta = result.current.watchlists.find((w) => w.id === idB)
      expect(beta?.name).toBe('Beta')
    })
  })

  // ----- deleteWatchlist -----

  describe('deleteWatchlist', () => {
    it('removes the watchlist with the given id', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      let id!: string
      act(() => {
        id = result.current.createWatchlist('To Delete').id
      })

      act(() => {
        result.current.deleteWatchlist(id)
      })

      expect(result.current.watchlists.find((w) => w.id === id)).toBeUndefined()
    })

    it('leaves other watchlists intact', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      let idA!: string
      let idB!: string
      act(() => {
        idA = result.current.createWatchlist('Keep').id
        idB = result.current.createWatchlist('Remove').id
      })

      act(() => {
        result.current.deleteWatchlist(idB)
      })

      expect(result.current.watchlists).toHaveLength(1)
      expect(result.current.watchlists[0].id).toBe(idA)
    })

    it('clears activeWatchlistId when the active list is deleted', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      let id!: string
      act(() => {
        id = result.current.createWatchlist('Active One').id
      })

      act(() => {
        result.current.setActiveWatchlist(id)
      })

      expect(result.current.activeWatchlistId).toBe(id)

      act(() => {
        result.current.deleteWatchlist(id)
      })

      expect(result.current.activeWatchlistId).toBeNull()
    })
  })

  // ----- addPairToWatchlist -----

  describe('addPairToWatchlist', () => {
    it('adds a pair to the watchlist', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      let id!: string
      act(() => {
        id = result.current.createWatchlist('My List').id
      })

      act(() => {
        result.current.addPairToWatchlist(id, 'XLM/USD')
      })

      const list = result.current.watchlists.find((w) => w.id === id)
      expect(list?.pairs).toContain('XLM/USD')
    })

    it('does not add duplicates', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      let id!: string
      act(() => {
        id = result.current.createWatchlist('No Dupes').id
      })

      act(() => {
        result.current.addPairToWatchlist(id, 'BTC/USD')
        result.current.addPairToWatchlist(id, 'BTC/USD')
      })

      const list = result.current.watchlists.find((w) => w.id === id)
      const btcCount = list?.pairs.filter((p) => p === 'BTC/USD').length ?? 0
      expect(btcCount).toBe(1)
    })

    it('can add multiple distinct pairs', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      let id!: string
      act(() => {
        id = result.current.createWatchlist('Multi').id
      })

      act(() => {
        result.current.addPairToWatchlist(id, 'ETH/USD')
        result.current.addPairToWatchlist(id, 'BTC/USD')
      })

      const list = result.current.watchlists.find((w) => w.id === id)
      expect(list?.pairs).toContain('ETH/USD')
      expect(list?.pairs).toContain('BTC/USD')
    })
  })

  // ----- removePairFromWatchlist -----

  describe('removePairFromWatchlist', () => {
    it('removes a pair from the watchlist', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      let id!: string
      act(() => {
        id = result.current.createWatchlist('Remove Pair Test').id
      })

      act(() => {
        result.current.addPairToWatchlist(id, 'ETH/USD')
        result.current.addPairToWatchlist(id, 'XLM/USD')
      })

      act(() => {
        result.current.removePairFromWatchlist(id, 'ETH/USD')
      })

      const list = result.current.watchlists.find((w) => w.id === id)
      expect(list?.pairs).not.toContain('ETH/USD')
      expect(list?.pairs).toContain('XLM/USD')
    })

    it('is a no-op when the pair is not in the list', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      let id!: string
      act(() => {
        id = result.current.createWatchlist('No-op Test').id
      })

      act(() => {
        result.current.addPairToWatchlist(id, 'BTC/USD')
      })

      act(() => {
        result.current.removePairFromWatchlist(id, 'MISSING/PAIR')
      })

      const list = result.current.watchlists.find((w) => w.id === id)
      expect(list?.pairs).toEqual(['BTC/USD'])
    })
  })

  // ----- exportCsv -----

  describe('exportCsv', () => {
    it('returns a CSV string with name,pairs header', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      act(() => {
        const id = result.current.createWatchlist('Top Pairs').id
        result.current.addPairToWatchlist(id, 'BTC/USD')
        result.current.addPairToWatchlist(id, 'ETH/USD')
      })

      const csv = result.current.exportCsv()
      expect(csv).toMatch(/^name,pairs/)
      expect(csv).toContain('Top Pairs')
      expect(csv).toContain('BTC/USD')
      expect(csv).toContain('ETH/USD')
    })

    it('returns only the header when there are no watchlists', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      const csv = result.current.exportCsv()
      expect(csv.trim()).toBe('name,pairs')
    })

    it('pipe-separates multiple pairs in a row', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      act(() => {
        const id = result.current.createWatchlist('Mixed').id
        result.current.addPairToWatchlist(id, 'XLM/USD')
        result.current.addPairToWatchlist(id, 'BTC/USD')
      })

      const csv = result.current.exportCsv()
      // The pairs cell should contain both items separated by |
      expect(csv).toMatch(/XLM\/USD\|BTC\/USD|BTC\/USD\|XLM\/USD/)
    })
  })

  // ----- importCsv -----

  describe('importCsv', () => {
    it('creates watchlists from a valid CSV string', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      const csv = 'name,pairs\nStars,XLM/USD|BTC/USD\nDeFi,ETH/USD'

      act(() => {
        result.current.importCsv(csv)
      })

      expect(result.current.watchlists).toHaveLength(2)
      expect(result.current.watchlists[0].name).toBe('Stars')
      expect(result.current.watchlists[0].pairs).toEqual(['XLM/USD', 'BTC/USD'])
      expect(result.current.watchlists[1].name).toBe('DeFi')
      expect(result.current.watchlists[1].pairs).toEqual(['ETH/USD'])
    })

    it('appends imported watchlists to existing ones', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      act(() => {
        result.current.createWatchlist('Existing')
      })

      act(() => {
        result.current.importCsv('name,pairs\nImported,XLM/USD')
      })

      expect(result.current.watchlists).toHaveLength(2)
      expect(result.current.watchlists[0].name).toBe('Existing')
      expect(result.current.watchlists[1].name).toBe('Imported')
    })

    it('skips rows with no name', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      act(() => {
        result.current.importCsv('name,pairs\n,XLM/USD\nValid,BTC/USD')
      })

      expect(result.current.watchlists).toHaveLength(1)
      expect(result.current.watchlists[0].name).toBe('Valid')
    })

    it('handles a CSV with empty pairs cell', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      act(() => {
        result.current.importCsv('name,pairs\nEmpty,')
      })

      expect(result.current.watchlists).toHaveLength(1)
      expect(result.current.watchlists[0].pairs).toEqual([])
    })
  })

  // ----- reorderWatchlists -----

  describe('reorderWatchlists', () => {
    it('reorders watchlists according to the given id array', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      let idA!: string
      let idB!: string
      let idC!: string
      act(() => {
        idA = result.current.createWatchlist('A').id
        idB = result.current.createWatchlist('B').id
        idC = result.current.createWatchlist('C').id
      })

      act(() => {
        result.current.reorderWatchlists([idC, idA, idB])
      })

      expect(result.current.watchlists[0].id).toBe(idC)
      expect(result.current.watchlists[1].id).toBe(idA)
      expect(result.current.watchlists[2].id).toBe(idB)
    })
  })

  // ----- toggleWatchlistMode -----

  describe('toggleWatchlistMode', () => {
    it('toggles watchlistModeEnabled between true and false', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      expect(result.current.watchlistModeEnabled).toBe(false)

      act(() => {
        result.current.toggleWatchlistMode()
      })
      expect(result.current.watchlistModeEnabled).toBe(true)

      act(() => {
        result.current.toggleWatchlistMode()
      })
      expect(result.current.watchlistModeEnabled).toBe(false)
    })
  })

  // ----- activeWatchlist -----

  describe('activeWatchlist', () => {
    it('returns null when no watchlist is active', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      expect(result.current.activeWatchlist).toBeNull()
    })

    it('returns the matching entry when one is set active', async () => {
      const { result } = renderHook(() => useWatchlists())
      await waitForLoad(result)

      let id!: string
      act(() => {
        id = result.current.createWatchlist('Active').id
      })

      act(() => {
        result.current.setActiveWatchlist(id)
      })

      expect(result.current.activeWatchlist?.id).toBe(id)
    })
  })
})
