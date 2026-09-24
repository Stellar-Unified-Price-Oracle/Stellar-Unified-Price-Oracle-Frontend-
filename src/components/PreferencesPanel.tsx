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
 * | Refresh interval  | `refreshInterval`       | 5 s, 10 s, 30 s, 60 s      |
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
import { memo } from 'react'
import { usePreferences } from '../preferences/PreferencesContext'
import {
  REFRESH_INTERVAL_OPTIONS,
  CHART_RANGE_OPTIONS,
  STALE_THRESHOLD_OPTIONS,
  DIVERGENCE_THRESHOLD_OPTIONS,
} from '../preferences/constants'
import type { Preferences } from '../preferences/types'

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

      {/* Chart time range */}
      <div className="flex flex-col gap-1">
        <label htmlFor="chart-range" className="text-sm font-medium text-gray-200">
          Chart time range
        </label>
        <select
          id="chart-range"
          className="rounded bg-slate-800 px-3 py-2 text-sm text-gray-100"
          value={preferences.chartTimeRange}
          onChange={(e) =>
            updatePreference('chartTimeRange', e.target.value as Preferences['chartTimeRange'])
          }
        >
          {CHART_RANGE_OPTIONS.map((opt) => (
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
          onChange={(e) =>
            updatePreference('staleThresholdMinutes', Number(e.target.value))
          }
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
          onChange={(e) =>
            updatePreference('onChainDivergenceThresholdPercent', Number(e.target.value))
          }
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
    </section>
  )
})
