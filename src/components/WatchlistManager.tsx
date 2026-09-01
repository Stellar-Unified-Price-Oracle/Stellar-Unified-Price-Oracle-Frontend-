/**
 * WatchlistManager
 *
 * A panel that lets users create, rename, delete, and manage custom watchlists.
 * Each watchlist can hold a subset of the available asset pairs.
 */

import { memo, useCallback, useRef, useState } from 'react'
import { useWatchlists } from '../hooks/useWatchlists'
import type { WatchlistEntry } from '../hooks/useWatchlists'

// ---------- Props ----------

interface WatchlistManagerProps {
  availablePairs: string[]
}

// ---------- Sub-components ----------

interface PairChipProps {
  pair: string
  watchlistId: string
  onRemove: (watchlistId: string, pair: string) => void
}

const PairChip = memo(function PairChip({ pair, watchlistId, onRemove }: PairChipProps) {
  const handleRemove = useCallback(() => {
    onRemove(watchlistId, pair)
  }, [onRemove, watchlistId, pair])

  return (
    <span className='inline-flex items-center gap-1 rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-200'>
      {pair}
      <button
        type='button'
        aria-label={`Remove ${pair} from watchlist`}
        onClick={handleRemove}
        className='ml-0.5 rounded text-slate-400 hover:text-red-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-red-400'
      >
        ×
      </button>
    </span>
  )
})

interface WatchlistItemProps {
  entry: WatchlistEntry
  index: number
  totalCount: number
  availablePairs: string[]
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onAddPair: (id: string, pair: string) => void
  onRemovePair: (id: string, pair: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

const WatchlistItem = memo(function WatchlistItem({
  entry,
  index,
  totalCount,
  availablePairs,
  onRename,
  onDelete,
  onAddPair,
  onRemovePair,
  onMoveUp,
  onMoveDown,
}: WatchlistItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(entry.name)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const uncommittedPairs = availablePairs.filter((p) => !entry.pairs.includes(p))

  const handleToggle = useCallback(() => setExpanded((v) => !v), [])

  const handleEditStart = useCallback(() => {
    setEditName(entry.name)
    setEditing(true)
    // Focus input on next tick
    setTimeout(() => nameInputRef.current?.focus(), 0)
  }, [entry.name])

  const handleEditCommit = useCallback(() => {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== entry.name) {
      onRename(entry.id, trimmed)
    }
    setEditing(false)
  }, [editName, entry.id, entry.name, onRename])

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleEditCommit()
      if (e.key === 'Escape') {
        setEditName(entry.name)
        setEditing(false)
      }
    },
    [handleEditCommit, entry.name],
  )

  const handleAddPairChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const pair = e.target.value
      if (pair) {
        onAddPair(entry.id, pair)
        // Reset select to placeholder
        e.target.value = ''
      }
    },
    [onAddPair, entry.id],
  )

  const handleDelete = useCallback(() => onDelete(entry.id), [onDelete, entry.id])
  const handleMoveUp = useCallback(() => onMoveUp(entry.id), [onMoveUp, entry.id])
  const handleMoveDown = useCallback(() => onMoveDown(entry.id), [onMoveDown, entry.id])

  return (
    <li
      className='rounded-lg border border-slate-700 bg-slate-800'
      aria-label={`Watchlist: ${entry.name}`}
    >
      {/* Header row */}
      <div className='flex items-center gap-2 px-3 py-2'>
        {/* Drag handle (visual only) */}
        <span
          aria-hidden='true'
          className='cursor-grab select-none text-slate-500'
          title='Drag to reorder'
        >
          ⠿
        </span>

        {/* Up / Down reorder buttons */}
        <div className='flex flex-col gap-0.5'>
          <button
            type='button'
            aria-label={`Move "${entry.name}" up`}
            disabled={index === 0}
            onClick={handleMoveUp}
            className='rounded px-1 text-xs text-slate-400 hover:text-slate-100 disabled:opacity-30 focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400'
          >
            ▲
          </button>
          <button
            type='button'
            aria-label={`Move "${entry.name}" down`}
            disabled={index === totalCount - 1}
            onClick={handleMoveDown}
            className='rounded px-1 text-xs text-slate-400 hover:text-slate-100 disabled:opacity-30 focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400'
          >
            ▼
          </button>
        </div>

        {/* Name / inline edit */}
        {editing ? (
          <input
            ref={nameInputRef}
            type='text'
            value={editName}
            aria-label='Watchlist name'
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleEditCommit}
            onKeyDown={handleEditKeyDown}
            className='flex-1 rounded bg-slate-700 px-2 py-0.5 text-sm text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400'
          />
        ) : (
          <button
            type='button'
            aria-label={`Rename watchlist "${entry.name}"`}
            onClick={handleEditStart}
            className='flex-1 truncate text-left text-sm font-medium text-slate-100 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400'
          >
            {entry.name}
          </button>
        )}

        {/* Pair count badge */}
        <span
          aria-label={`${entry.pairs.length} pairs`}
          className='shrink-0 rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400'
        >
          {entry.pairs.length} pair{entry.pairs.length !== 1 ? 's' : ''}
        </span>

        {/* Expand / collapse */}
        <button
          type='button'
          aria-label={expanded ? `Collapse "${entry.name}"` : `Expand "${entry.name}"`}
          aria-expanded={expanded}
          onClick={handleToggle}
          className='shrink-0 rounded px-1 text-slate-400 hover:text-slate-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400'
        >
          {expanded ? '▲' : '▼'}
        </button>

        {/* Delete */}
        <button
          type='button'
          aria-label={`Delete watchlist "${entry.name}"`}
          onClick={handleDelete}
          className='shrink-0 rounded px-1 text-slate-400 hover:text-red-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-red-400'
        >
          ✕
        </button>
      </div>

      {/* Expanded pair management */}
      {expanded && (
        <div className='border-t border-slate-700 px-3 py-2 space-y-2'>
          {/* Existing pairs */}
          {entry.pairs.length > 0 ? (
            <div
              className='flex flex-wrap gap-1'
              aria-label={`Pairs in "${entry.name}"`}
            >
              {entry.pairs.map((pair) => (
                <PairChip
                  key={pair}
                  pair={pair}
                  watchlistId={entry.id}
                  onRemove={onRemovePair}
                />
              ))}
            </div>
          ) : (
            <p className='text-xs text-slate-500'>No pairs added yet.</p>
          )}

          {/* Add pair */}
          {uncommittedPairs.length > 0 && (
            <div className='flex items-center gap-2'>
              <label
                htmlFor={`add-pair-${entry.id}`}
                className='text-xs text-slate-400'
              >
                Add pair:
              </label>
              <select
                id={`add-pair-${entry.id}`}
                aria-label={`Add pair to "${entry.name}"`}
                defaultValue=''
                onChange={handleAddPairChange}
                className='rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400'
              >
                <option value='' disabled>
                  Select a pair…
                </option>
                {uncommittedPairs.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </li>
  )
})

// ---------- Main Component ----------

export const WatchlistManager = memo(function WatchlistManager({
  availablePairs,
}: WatchlistManagerProps) {
  const {
    watchlists,
    watchlistModeEnabled,
    createWatchlist,
    renameWatchlist,
    deleteWatchlist,
    addPairToWatchlist,
    removePairFromWatchlist,
    reorderWatchlists,
    toggleWatchlistMode,
    exportCsv,
    importCsv,
  } = useWatchlists()

  const [newName, setNewName] = useState('')
  const importInputRef = useRef<HTMLInputElement>(null)

  // ---------- Handlers ----------

  const handleCreate = useCallback(() => {
    const name = newName.trim()
    if (!name) return
    createWatchlist(name)
    setNewName('')
  }, [newName, createWatchlist])

  const handleNewNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleCreate()
    },
    [handleCreate],
  )

  const handleMoveUp = useCallback(
    (id: string) => {
      const ids = watchlists.map((w) => w.id)
      const idx = ids.indexOf(id)
      if (idx <= 0) return
      const reordered = [...ids]
      ;[reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]]
      reorderWatchlists(reordered)
    },
    [watchlists, reorderWatchlists],
  )

  const handleMoveDown = useCallback(
    (id: string) => {
      const ids = watchlists.map((w) => w.id)
      const idx = ids.indexOf(id)
      if (idx === -1 || idx >= ids.length - 1) return
      const reordered = [...ids]
      ;[reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]]
      reorderWatchlists(reordered)
    },
    [watchlists, reorderWatchlists],
  )

  const handleExport = useCallback(() => {
    const csv = exportCsv()
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'watchlists.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }, [exportCsv])

  const handleImportClick = useCallback(() => {
    importInputRef.current?.click()
  }, [])

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (evt) => {
        const text = evt.target?.result
        if (typeof text === 'string') {
          importCsv(text)
        }
      }
      reader.readAsText(file)
      // Reset input so the same file can be re-imported if needed
      e.target.value = ''
    },
    [importCsv],
  )

  // ---------- Render ----------

  return (
    <section
      aria-label='Watchlist Manager'
      className='flex flex-col gap-4 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-200'
    >
      {/* Title + Watchlist Mode toggle */}
      <div className='flex items-center justify-between'>
        <h2 className='text-base font-semibold text-slate-100'>Watchlists</h2>

        <label className='flex cursor-pointer items-center gap-2 select-none'>
          <span className='text-xs text-slate-400'>Watchlist Mode</span>
          <button
            type='button'
            role='switch'
            aria-checked={watchlistModeEnabled}
            aria-label='Toggle Watchlist Mode'
            onClick={toggleWatchlistMode}
            className={[
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
              watchlistModeEnabled ? 'bg-sky-500' : 'bg-slate-600',
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                watchlistModeEnabled ? 'translate-x-4' : 'translate-x-1',
              ].join(' ')}
            />
          </button>
        </label>
      </div>

      {/* Create new watchlist */}
      <div className='flex gap-2'>
        <input
          type='text'
          value={newName}
          aria-label='New watchlist name'
          placeholder='New watchlist name…'
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleNewNameKeyDown}
          className='flex-1 rounded bg-slate-800 px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 border border-slate-700 focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400'
        />
        <button
          type='button'
          aria-label='Create watchlist'
          onClick={handleCreate}
          disabled={!newName.trim()}
          className='rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400'
        >
          Create
        </button>
      </div>

      {/* Watchlist list */}
      {watchlists.length === 0 ? (
        <p className='text-center text-xs text-slate-500 py-4'>
          No watchlists yet. Create one above.
        </p>
      ) : (
        <ul className='flex flex-col gap-2' aria-label='Your watchlists'>
          {watchlists.map((entry, i) => (
            <WatchlistItem
              key={entry.id}
              entry={entry}
              index={i}
              totalCount={watchlists.length}
              availablePairs={availablePairs}
              onRename={renameWatchlist}
              onDelete={deleteWatchlist}
              onAddPair={addPairToWatchlist}
              onRemovePair={removePairFromWatchlist}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
            />
          ))}
        </ul>
      )}

      {/* Import / Export */}
      <div className='flex gap-2 border-t border-slate-700 pt-3'>
        {/* Hidden file input for CSV import */}
        <input
          ref={importInputRef}
          type='file'
          accept='.csv,text/csv'
          aria-label='Import watchlists CSV file'
          tabIndex={-1}
          className='sr-only'
          onChange={handleImportFile}
        />

        <button
          type='button'
          aria-label='Import watchlists from CSV'
          onClick={handleImportClick}
          className='rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400'
        >
          ↑ Import CSV
        </button>

        <button
          type='button'
          aria-label='Export watchlists to CSV'
          onClick={handleExport}
          disabled={watchlists.length === 0}
          className='rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400'
        >
          ↓ Export CSV
        </button>
      </div>
    </section>
  )
})
