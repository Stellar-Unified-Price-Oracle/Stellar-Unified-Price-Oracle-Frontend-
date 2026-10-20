import type { ReactElement } from 'react'
import type { DuplicateMatch } from '../utils/duplicateDetection'
import { formatTimestamp } from '../utils/format'

export interface DuplicateReportAlertProps {
  duplicates: DuplicateMatch[]
  dismissed: boolean
  onDismiss: () => void
}

/**
 * Accessible warning banner displayed before submitting a community report
 * when likely duplicates are detected (#860).
 */
export function DuplicateReportAlert({
  duplicates,
  dismissed,
  onDismiss,
}: DuplicateReportAlertProps): ReactElement | null {
  if (duplicates.length === 0 || dismissed) return null

  return (
    <div
      role="region"
      aria-label="Likely duplicate reports warning"
      aria-live="polite"
      className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-900 dark:text-amber-200 flex flex-col gap-2.5 transition-all"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
          <span aria-hidden="true" className="text-sm">
            ⚠
          </span>
          <span>Likely Duplicate Report Detected ({duplicates.length})</span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-[11px] underline text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200"
          aria-label="Dismiss duplicate warning"
        >
          Dismiss
        </button>
      </div>

      <p className="text-[11px] text-gray-700 dark:text-gray-300">
        A similar report was recently submitted for this target. Please review existing submissions to avoid duplicate
        triaging:
      </p>

      <ul className="flex flex-col gap-1.5 max-h-36 overflow-y-auto" role="list">
        {duplicates.map(({ report, confidence }) => (
          <li
            key={report.id}
            className="rounded bg-white/70 dark:bg-gray-800/80 border border-amber-500/20 p-2 flex flex-col gap-1 text-[11px]"
            role="listitem"
          >
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="font-medium text-gray-900 dark:text-gray-100 font-mono">
                [{report.category}] {report.targetId}
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide font-medium ${
                    confidence === 'high'
                      ? 'bg-amber-600/20 text-amber-800 dark:text-amber-300'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {confidence} match
                </span>
                <span className="px-1.5 py-0.5 rounded bg-cyan-600/15 text-cyan-800 dark:text-cyan-300 text-[10px] uppercase font-mono">
                  {report.stage}
                </span>
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-400 line-clamp-2 italic">
              &ldquo;{report.evidence.replace(/^\[Concern:[^\]]+\]\s*/, '')}&rdquo;
            </p>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              Submitted {formatTimestamp(report.createdAt)}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-[10px] text-gray-500 dark:text-gray-400">
        You may still proceed with your submission if you are providing new evidence or observing a distinct issue.
      </p>
    </div>
  )
}
