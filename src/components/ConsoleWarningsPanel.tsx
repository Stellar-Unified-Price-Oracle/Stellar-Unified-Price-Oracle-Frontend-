import { memo, useEffect, useState } from 'react'
import {
  clearWarnings,
  exportWarnings,
  getWarnings,
  subscribeWarnings,
  suppressPattern,
  type AggregatedWarning,
} from '../utils/consoleAggregator'

function download(content: string, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  a.download = filename
  a.click()
}

export const ConsoleWarningsPanel = memo(function ConsoleWarningsPanel() {
  const [warnings, setWarnings] = useState<AggregatedWarning[]>(() => getWarnings())
  const [filter, setFilter] = useState<'all' | 'warn' | 'error'>('all')

  useEffect(() => subscribeWarnings(setWarnings), [])

  const shown = filter === 'all' ? warnings : warnings.filter((w) => w.level === filter)

  return (
    <section className="bg-gray-900 rounded-lg p-4 space-y-3" aria-label="Console warnings">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-white">Console Warnings ({warnings.length})</h3>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="text-xs bg-gray-800 text-gray-200 rounded px-2 py-1 border border-gray-700"
            aria-label="Filter by level"
          >
            <option value="all">All</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
          <button
            onClick={() => download(exportWarnings(), 'warnings.json')}
            className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200"
          >
            Export
          </button>
          <button
            onClick={clearWarnings}
            className="text-xs px-2 py-1 rounded bg-red-800 hover:bg-red-700 text-white"
          >
            Clear
          </button>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-xs text-gray-500 italic">No warnings captured.</p>
      ) : (
        <ul className="space-y-1 max-h-64 overflow-y-auto" role="list">
          {shown.map((w, i) => (
            <li
              key={i}
              className={`flex items-start justify-between gap-2 text-xs rounded px-2 py-1 ${
                w.level === 'error' ? 'bg-red-950 text-red-300' : 'bg-yellow-950 text-yellow-200'
              }`}
            >
              <span className="break-all flex-1">{w.pattern}</span>
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <span className="font-mono font-bold">×{w.count}</span>
                <button
                  onClick={() => suppressPattern(new RegExp(w.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))}
                  className="text-gray-400 hover:text-gray-200 underline"
                  title="Suppress this pattern"
                >
                  suppress
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
})
