/**
 * @file PreferencesPanel
 *
 * A compact form for adjusting data-fetching and display preferences. Reads
 * from and writes to `PreferencesContext`, which persists state to IndexedDB
 * and supports undo/redo.
 *
 * Kept intentionally small so it can be embedded in a sidebar, popover, or the
 * full `SettingsPanel` without pulling in unrelated UI.
 *
 * @example Inside a settings popover
 * ```tsx
 * <PreferencesProvider>
 *   <PreferencesPanel />
 * </PreferencesProvider>
 * ```
 *
 * ## Exposed controls
 * | Control           | Preference key          | Options                     |
 * |-------------------|-------------------------|-----------------------------|
 * | Refresh interval  | `refreshInterval`       | 5 s, 10 s, 30 s, 1 min, 5 min |
 * | History page size | `chartHistoryPageSize`  | 50, 100, 250 points        |
 * | Chart time range  | `chartTimeRange`        | 1 h, 6 h, 24 h, 7 d, 30 d  |
 * | Stale threshold   | `staleThresholdMinutes` | 1, 2, 5, 10, 30 min         |
 * | Divergence threshold | `onChainDivergenceThresholdPercent` | 0.5%, 1%, 2%, 5% |
 *
 * ## Undo / Redo
 * Each preference change is recorded as a command in the undo stack (depth
 * capped by `MAX_UNDO_DEPTH`). The Undo/Redo buttons are disabled when the
 * stack is empty or at its head.
 *
 * Keyboard shortcuts `Ctrl+Z` / `Cmd+Z` and `Ctrl+Shift+Z` / `Cmd+Shift+Z`
 * are also registered by `PreferencesContext` globally.
 *
 * ## Edge cases
 * - **Must be inside `PreferencesProvider`** — `usePreferences()` throws if the
 *   context is missing; wrap the component tree in `<PreferencesProvider>`.
 * - **Navigation resets undo history** — `PreferencesContext` clears the stack on
 *   route change to prevent cross-page undo surprises.
 *
 * ## Accessibility
 * - Root `<section>` has `aria-label="Preferences"`.
 * - All `<select>` elements are associated with `<label>` elements via `id`/`htmlFor`.
 * - Undo/Redo buttons have descriptive `aria-label` attributes and are `disabled`
 *   when the action is unavailable.
 */
import { memo, useState, type ChangeEvent } from 'react'
import { usePreferences } from '../preferences/PreferencesContext'
import {
  PORTABLE_KEYS,
  exportPreferences,
  importPreferences,
  type PortablePreferences,
} from '../preferences/portability'
import { downloadFile } from '../utils/export'
import { resetExplanationDismissals } from '../utils/explanationDismissals'
import type { ExplanationReappearPolicy } from '../preferences/types'
import { useUnsavedChangesWarning } from '../hooks/useUnsavedChangesWarning'
import {
  REFRESH_INTERVAL_OPTIONS,
  CHART_RANGE_OPTIONS,
  CHART_HISTORY_PAGE_SIZE_OPTIONS,
  STALE_THRESHOLD_OPTIONS,
  DIVERGENCE_THRESHOLD_OPTIONS,
  PRICE_PRECISION_OPTIONS,
} from '../preferences/constants'
import type { Preferences } from '../preferences/types'
import { DENSITY_OPTIONS, toDashboardDensity } from '../utils/density'

/** Portable keys whose value in `draft` differs from the live preferences. Arrays compare by content. */
function differingKeys(current: PortablePreferences, draft: PortablePreferences): (keyof PortablePreferences)[] {
  return PORTABLE_KEYS.filter((key) => JSON.stringify(current[key]) !== JSON.stringify(draft[key]))
}

/**
 * PreferencesPanel
 *
 * A compact preferences form that lets users adjust data-fetching and display
 * settings. Reads from and writes to the PreferencesContext.
 *
 * Kept separate from SettingsPanel so it can be embedded in other surfaces
 * (e.g. a sidebar or a popover) without pulling in the full settings sheet.
 */
export const PreferencesPanel = memo(function PreferencesPanel() {
  const { preferences, updatePreference, undo, redo, canUndo, canRedo } = usePreferences()
  // An imported file is staged here and only written to preferences once the user applies it.
  const [draft, setDraft] = useState<PortablePreferences | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [dismissalsReset, setDismissalsReset] = useState(false)
  useUnsavedChangesWarning(draft !== null)

  const handleExport = () => {
    downloadFile(exportPreferences(preferences), 'supo-preferences.json', 'application/json')
  }

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const result = importPreferences(await file.text())
    if (result.ok) {
      setDraft(result.preferences)
      setImportError(null)
    } else {
      setDraft(null)
      setImportError(result.error)
    }
  }

  const applyValue = <K extends keyof PortablePreferences>(key: K, value: PortablePreferences[K]) => {
    updatePreference(key, value)
  }

  const applyDraft = () => {
    if (!draft) return
    for (const key of differingKeys(preferences, draft)) applyValue(key, draft[key])
    setDraft(null)
  }

  return (
    <section aria-label="Preferences" className="flex flex-col gap-4 p-4">
      {/* Refresh interval */}
      <div className="flex flex-col gap-1">
        <label htmlFor="refresh-interval" className="text-sm font-medium text-gray-200">
          Refresh interval
        </label>
        <select
          id="refresh-interval"
          className="rounded bg-slate-800 px-3 py-2 text-sm text-gray-100"
          value={preferences.refreshInterval}
          onChange={(e) =>
            updatePreference('refreshInterval', Number(e.target.value) as Preferences['refreshInterval'])
          }
        >
          {REFRESH_INTERVAL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Price display precision */}
      <div className="flex flex-col gap-1">
        <label htmlFor="price-precision" className="text-sm font-medium text-gray-200">
          Price decimals
        </label>
        <select
          id="price-precision"
          className="rounded bg-slate-800 px-3 py-2 text-sm text-gray-100"
          value={String(preferences.pricePrecision)}
          onChange={(e) =>
            updatePreference(
              'pricePrecision',
              e.target.value === 'auto' ? 'auto' : (Number(e.target.value) as Preferences['pricePrecision']),
            )
          }
        >
          {PRICE_PRECISION_OPTIONS.map((opt) => (
            <option key={opt.value} value={String(opt.value)}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Chart time range */}
      <div className="flex flex-col gap-1">
        <label htmlFor="chart-range" className="text-sm font-medium text-gray-200">
          Chart time range
        </label>
        <select
          id="chart-range"
          className="rounded bg-slate-800 px-3 py-2 text-sm text-gray-100"
          value={preferences.chartTimeRange}
          onChange={(e) => updatePreference('chartTimeRange', e.target.value as Preferences['chartTimeRange'])}
        >
          {CHART_RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* History points per request */}
      <div className="flex flex-col gap-1">
        <label htmlFor="chart-history-page-size" className="text-sm font-medium text-gray-200">
          Chart history points per page
        </label>
        <select
          id="chart-history-page-size"
          className="rounded bg-slate-800 px-3 py-2 text-sm text-gray-100"
          value={preferences.chartHistoryPageSize}
          onChange={(e) =>
            updatePreference('chartHistoryPageSize', Number(e.target.value) as Preferences['chartHistoryPageSize'])
          }
        >
          {CHART_HISTORY_PAGE_SIZE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Stale threshold */}
      <div className="flex flex-col gap-1">
        <label htmlFor="stale-threshold" className="text-sm font-medium text-gray-200">
          Stale threshold (minutes)
        </label>
        <select
          id="stale-threshold"
          className="rounded bg-slate-800 px-3 py-2 text-sm text-gray-100"
          value={preferences.staleThresholdMinutes}
          onChange={(e) => updatePreference('staleThresholdMinutes', Number(e.target.value))}
        >
          {STALE_THRESHOLD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* On-chain divergence threshold */}
      <div className="flex flex-col gap-1">
        <label htmlFor="divergence-threshold" className="text-sm font-medium text-gray-200">
          On-chain divergence threshold
        </label>
        <select
          id="divergence-threshold"
          className="rounded bg-slate-800 px-3 py-2 text-sm text-gray-100"
          value={preferences.onChainDivergenceThresholdPercent}
          onChange={(e) => updatePreference('onChainDivergenceThresholdPercent', Number(e.target.value))}
        >
          {DIVERGENCE_THRESHOLD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Oracle source fallback priority */}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-200">Oracle source priority</span>
        <ul className="flex flex-col gap-1" aria-label="Oracle source fallback order">
          {preferences.sourcePriority.map((src, index) => (
            <li
              key={src}
              className="flex items-center justify-between gap-2 rounded bg-slate-800 px-3 py-1.5 text-sm text-gray-100"
            >
              <span>
                {index + 1}. {src.charAt(0).toUpperCase() + src.slice(1)}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => {
                    const next = [...preferences.sourcePriority]
                    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                    updatePreference('sourcePriority', next)
                  }}
                  className="rounded bg-slate-700 px-2 py-0.5 text-xs text-gray-200 disabled:opacity-40"
                  aria-label={`Move ${src} up in priority`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === preferences.sourcePriority.length - 1}
                  onClick={() => {
                    const next = [...preferences.sourcePriority]
                    ;[next[index + 1], next[index]] = [next[index], next[index + 1]]
                    updatePreference('sourcePriority', next)
                  }}
                  className="rounded bg-slate-700 px-2 py-0.5 text-xs text-gray-200 disabled:opacity-40"
                  aria-label={`Move ${src} down in priority`}
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Undo / Redo */}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canUndo}
          onClick={undo}
          className="rounded bg-slate-700 px-3 py-1.5 text-sm text-gray-200 disabled:opacity-40"
          aria-label="Undo last preference change"
        >
          Undo
        </button>
        <button
          type="button"
          disabled={!canRedo}
          onClick={redo}
          className="rounded bg-slate-700 px-3 py-1.5 text-sm text-gray-200 disabled:opacity-40"
          aria-label="Redo last preference change"
        >
          Redo
        </button>
      </div>

      {/* Dismissed inline explanations */}
      <div className="flex flex-col gap-1">
        <label htmlFor="explanation-reappear" className="text-sm font-medium text-gray-200">
          Show dismissed explanations again
        </label>
        <select
          id="explanation-reappear"
          className="rounded bg-slate-800 px-3 py-2 text-sm text-gray-100"
          value={preferences.explanationReappearPolicy}
          onChange={(e) => updatePreference('explanationReappearPolicy', e.target.value as ExplanationReappearPolicy)}
        >
          <option value="never">Never</option>
          <option value="weekly">After 7 days</option>
          <option value="always">Always</option>
        </select>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              resetExplanationDismissals()
              setDismissalsReset(true)
            }}
            className="rounded bg-slate-700 px-3 py-1.5 text-sm text-gray-200"
          >
            Reset dismissed explanations
          </button>
          {dismissalsReset && (
            <span role="status" className="text-xs text-gray-400">
              Dismissed explanations reset.
            </span>
          )}
        </div>
      </div>

      {/* Export / import */}
      <div className="flex flex-col gap-2 border-t border-slate-700 pt-4">
        <h3 className="text-sm font-medium text-gray-200">Backup</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="rounded bg-slate-700 px-3 py-1.5 text-sm text-gray-200"
          >
            Export preferences
          </button>
          <label className="cursor-pointer rounded bg-slate-700 px-3 py-1.5 text-sm text-gray-200 focus-within:ring-2 focus-within:ring-cyan-500">
            Import preferences
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Import preferences file"
              onChange={handleImportFile}
            />
          </label>
        </div>

        {importError && (
          <p role="alert" className="text-sm text-red-400">
            {importError}
          </p>
        )}

        {draft && (
          <div role="region" aria-label="Imported preferences review" className="flex flex-col gap-2">
            <p className="text-sm text-gray-300">
              {differingKeys(preferences, draft).length} setting(s) differ from the imported file. Nothing changes until
              you apply.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={applyDraft} className="rounded bg-cyan-600 px-3 py-1.5 text-sm text-white">
                Apply imported preferences
              </button>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="rounded bg-slate-700 px-3 py-1.5 text-sm text-gray-200"
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
})
