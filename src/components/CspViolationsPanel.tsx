import { memo, useEffect, useState } from 'react'
import {
  clearCspViolations,
  exportCspViolations,
  getCspViolations,
  getTopDirectives,
  subscribeCspViolations,
  type CspViolation,
} from '../utils/cspReporting'

function download(content: string, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  a.download = filename
  a.click()
}

export const CspViolationsPanel = memo(function CspViolationsPanel() {
  const [violations, setViolations] = useState<CspViolation[]>(() => getCspViolations())

  useEffect(() => subscribeCspViolations(setViolations), [])

  const topDirectives = getTopDirectives()

  return (
    <section className="bg-gray-900 rounded-lg p-4 space-y-3" aria-label="CSP violations">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-white">CSP Violations ({violations.length})</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => download(exportCspViolations(), 'csp-violations.json')}
            className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200"
          >
            Export
          </button>
          <button
            onClick={clearCspViolations}
            className="text-xs px-2 py-1 rounded bg-red-800 hover:bg-red-700 text-white"
          >
            Clear
          </button>
        </div>
      </div>

      {topDirectives.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-gray-400">Top violating directives</h4>
          <ul className="flex flex-wrap gap-1.5" role="list">
            {topDirectives.slice(0, 5).map(({ directive, count }) => (
              <li
                key={directive}
                className="text-xs font-mono rounded px-2 py-0.5 bg-amber-950 text-amber-300"
                title={`${count} violation(s)`}
              >
                {directive} × {count}
              </li>
            ))}
          </ul>
        </div>
      )}

      {violations.length === 0 ? (
        <p className="text-xs text-gray-500 italic">No CSP violations captured.</p>
      ) : (
        <ul className="space-y-1 max-h-64 overflow-y-auto" role="list">
          {violations.map((v, i) => (
            <li
              key={i}
              className={`flex items-start justify-between gap-2 text-xs rounded px-2 py-1 ${
                v.disposition === 'report' ? 'bg-blue-950 text-blue-300' : 'bg-red-950 text-red-300'
              }`}
            >
              <span className="break-all flex-1">
                <span className="font-semibold">{v.directive}</span> blocked{' '}
                <span className="font-mono">{v.blockedUri}</span>
                {v.sourceFile && (
                  <span className="text-gray-500">
                    {' '}
                    at {v.sourceFile}
                    {v.lineNumber ? `:${v.lineNumber}` : ''}
                  </span>
                )}
              </span>
              <span className="shrink-0 uppercase tracking-wide text-[10px] font-bold">{v.disposition}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
})
