import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { VALID_PAIRS } from '../types'
import { usePriceContext } from '../context/PriceContext'
import { usePreferences } from '../preferences/PreferencesContext'
import { idbCache, openCacheConnection } from '../hooks/useIndexedDB'
import {
  calculatePortfolioValuation,
  createPortfolioSnapshot,
  EMPTY_PORTFOLIO,
  NUMERAIRE_OPTIONS,
  PortfolioStoreSchema,
  type PortfolioNumeraire,
  type PortfolioStore,
} from '../portfolio/portfolio'

const PORTFOLIO_STORE_KEY = 'local-portfolio-snapshots'
const MAX_PORTFOLIO_SNAPSHOTS = 50

interface StoredCacheEntry {
  value?: unknown
}

async function readPortfolioStore(): Promise<unknown | null> {
  const db = await openCacheConnection()
  return new Promise((resolve, reject) => {
    const request = db.transaction('preferences', 'readonly').objectStore('preferences').get(PORTFOLIO_STORE_KEY)
    request.onsuccess = () => resolve((request.result as StoredCacheEntry | undefined)?.value ?? null)
    request.onerror = () => reject(request.error ?? new Error('Unable to read local portfolio data.'))
  })
}

async function persistPortfolioStore(store: PortfolioStore): Promise<void> {
  await idbCache.set('preferences', PORTFOLIO_STORE_KEY, store)
  const persisted = await readPortfolioStore()
  if (JSON.stringify(persisted) !== JSON.stringify(store)) {
    throw new Error('The browser could not verify the local portfolio save.')
  }
}

function formatAmount(value: number, numeraire: PortfolioNumeraire): string {
  const amount = new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 }).format(value)
  return numeraire === 'USD' ? `$${amount} USD` : `${amount} ${numeraire}`
}

export function Portfolio() {
  const { prices, pricesLoading, pricesError, isOfflineSnapshot, offlineSnapshotSavedAt } = usePriceContext()
  const { preferences } = usePreferences()
  const [store, setStore] = useState<PortfolioStore>(EMPTY_PORTFOLIO)
  const [storeLoading, setStoreLoading] = useState(true)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [pairDraft, setPairDraft] = useState<string>(VALID_PAIRS[0])
  const [quantityDraft, setQuantityDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)

  useEffect(() => {
    let active = true
    void readPortfolioStore()
      .then((saved) => {
        if (!active) return
        if (saved === null) {
          setStore(EMPTY_PORTFOLIO)
          return
        }
        const parsed = PortfolioStoreSchema.safeParse(saved)
        if (!parsed.success) {
          setStorageError('Saved portfolio data is invalid and was not loaded.')
          return
        }
        setStore(parsed.data)
      })
      .catch((error: unknown) => {
        if (active) {
          setStorageError(error instanceof Error ? error.message : 'Unable to load local portfolio data.')
        }
      })
      .finally(() => {
        if (active) setStoreLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const valuation = useMemo(
    () =>
      calculatePortfolioValuation(store.holdings, prices, store.numeraire, preferences.staleThresholdMinutes * 60_000),
    [store.holdings, store.numeraire, prices, preferences.staleThresholdMinutes],
  )

  const saveStore = async (next: PortfolioStore): Promise<boolean> => {
    if (savingRef.current) return false
    savingRef.current = true
    setSaving(true)
    setStorageError(null)
    try {
      await persistPortfolioStore(next)
      setStore(next)
      return true
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Unable to save the local portfolio.')
      return false
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const addHolding = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const quantity = Number(quantityDraft)
    if (!Number.isFinite(quantity) || quantity <= 0 || !VALID_PAIRS.includes(pairDraft)) return
    void saveStore({
      ...store,
      holdings: [...store.holdings, { id: crypto.randomUUID(), pair: pairDraft, quantity }],
    }).then((saved) => {
      if (saved) setQuantityDraft('')
    })
  }

  const createSnapshot = () => {
    const snapshot = createPortfolioSnapshot(crypto.randomUUID(), Date.now(), store.numeraire, valuation)
    if (!snapshot) {
      setStorageError('A complete valuation is not available; no snapshot was saved.')
      return
    }
    void saveStore({
      ...store,
      snapshots: [snapshot, ...store.snapshots].slice(0, MAX_PORTFOLIO_SNAPSHOTS),
    })
  }

  const hasPrices = prices.length > 0

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Local portfolio</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Track quantities and save point-in-time valuations on this device. Portfolio data is not sent to the oracle.
        </p>
      </header>

      {storeLoading && (
        <p role="status" className="text-sm text-gray-500">
          Loading local portfolio…
        </p>
      )}
      {storageError && (
        <p role="alert" className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-300">
          {storageError}
        </p>
      )}
      {pricesError && (
        <p role="alert" className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-300">
          Oracle prices could not be refreshed: {pricesError.message}
        </p>
      )}
      {pricesLoading && !hasPrices && (
        <p role="status" className="text-sm text-gray-500">
          Loading oracle prices…
        </p>
      )}
      {!pricesLoading && !hasPrices && (
        <p
          role="status"
          className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400"
        >
          No oracle prices are available. Portfolio values and snapshots remain unavailable until prices load.
        </p>
      )}
      {isOfflineSnapshot && (
        <p role="status" className="rounded-lg border border-amber-700/60 bg-amber-900/20 p-3 text-sm text-amber-200">
          Using an offline price snapshot
          {offlineSnapshotSavedAt ? ` saved ${new Date(offlineSnapshotSavedAt).toLocaleString()}` : ''}. Check each
          holding for stale inputs before saving a valuation.
        </p>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Holdings</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Conversion uses observed asset/USD and numeraire/USD oracle pairs. No missing prices or pegs are assumed.
            </p>
          </div>
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Valuation numeraire
            <select
              aria-label="Valuation numeraire"
              value={store.numeraire}
              disabled={storeLoading || saving}
              onChange={(event) => void saveStore({ ...store, numeraire: event.target.value as PortfolioNumeraire })}
              className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              {NUMERAIRE_OPTIONS.map((numeraire) => (
                <option key={numeraire} value={numeraire}>
                  {numeraire}
                </option>
              ))}
            </select>
          </label>
        </div>

        <form onSubmit={addHolding} className="mb-5 flex flex-wrap items-end gap-3">
          <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Pair
            <select
              aria-label="Holding pair"
              value={pairDraft}
              disabled={storeLoading || saving}
              onChange={(event) => setPairDraft(event.target.value)}
              className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              {VALID_PAIRS.map((pair) => (
                <option key={pair} value={pair}>
                  {pair}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Quantity
            <input
              aria-label="Holding quantity"
              type="number"
              min="0"
              step="any"
              value={quantityDraft}
              disabled={storeLoading || saving}
              onChange={(event) => setQuantityDraft(event.target.value)}
              className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <button
            type="submit"
            disabled={storeLoading || saving}
            className="min-h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add holding
          </button>
        </form>

        {store.holdings.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No holdings yet. Add a pair and quantity above.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {store.holdings.map((holding) => {
              const entry = valuation.holdings.find((item) => item.id === holding.id)
              return (
                <li key={holding.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{holding.pair}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {holding.quantity} units
                      {entry?.stale ? ' · stale price' : ''}
                      {entry?.missing ? ' · missing price' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {entry && !entry.missing ? formatAmount(entry.value, store.numeraire) : '—'}
                    </span>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void saveStore({
                          ...store,
                          holdings: store.holdings.filter((item) => item.id !== holding.id),
                        })
                      }
                      className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Valuation</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {valuation.complete
                ? `Total: ${formatAmount(valuation.total, store.numeraire)}`
                : 'Total unavailable until every holding has a fresh price.'}
            </p>
          </div>
          <button
            type="button"
            disabled={storeLoading || saving || !valuation.complete}
            onClick={createSnapshot}
            className="min-h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save snapshot
          </button>
        </div>

        {store.snapshots.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No snapshots saved yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {store.snapshots.map((snapshot) => (
              <li key={snapshot.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {new Date(snapshot.createdAt).toLocaleString()}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatAmount(snapshot.total, snapshot.numeraire)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
