import { useEffect, useId, useState, useMemo, type FormEvent, type ReactElement } from 'react'
import {
  CODE_OF_CONDUCT_URL,
  REPORT_CATEGORIES,
  createReport,
  loadReports,
  saveReports,
  type CommunitySurface,
  type ReportCategory,
} from '../utils/moderation'
import { findDuplicateReports } from '../utils/duplicateDetection'
import { DuplicateReportAlert } from './DuplicateReportAlert'

interface ReportButtonProps {
  surface: CommunitySurface
  /** Identifier of the reported item (proposal id, leaderboard entry, etc.). */
  targetId: string
  label?: string
}

/** "Report" action for community surfaces (#699, #860). Opens an inline dialog. */
export function ReportButton({ surface, targetId, label = 'Report' }: ReportButtonProps): ReactElement {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<ReportCategory>('spam')
  const [evidence, setEvidence] = useState('')
  const [confidential, setConfidential] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const [dismissedDuplicates, setDismissedDuplicates] = useState(false)
  const titleId = useId()

  const existingReports = useMemo(() => (open ? loadReports() : []), [open])
  const duplicates = useMemo(
    () => findDuplicateReports({ surface, targetId, category, evidence }, existingReports),
    [surface, targetId, category, evidence, existingReports],
  )

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const report = createReport({ surface, targetId, category, evidence, confidential })
    setStatus(saveReports([...existingReports, report]) ? 'sent' : 'error')
    setEvidence('')
    setDismissedDuplicates(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setStatus('idle')
          setOpen(true)
        }}
        className="text-xs text-gray-500 hover:text-red-500 underline underline-offset-2"
        aria-haspopup="dialog"
      >
        {label}
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <form
            onSubmit={submit}
            className="w-full max-w-md rounded-lg bg-white dark:bg-gray-900 p-5 flex flex-col gap-3 text-sm"
          >
            <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white">
              Report content
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Reports are reviewed against our{' '}
              <a
                href={CODE_OF_CONDUCT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-cyan-600"
              >
                Code of Conduct
              </a>
              . Your identity is not recorded.
            </p>
            {status === 'sent' ? (
              <p role="status" className="text-green-600">
                Thanks — your report is in the triage queue.
              </p>
            ) : (
              <>
                <label className="flex flex-col gap-1">
                  Category
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ReportCategory)}
                    className="rounded border px-2 py-1 dark:bg-gray-800"
                  >
                    {REPORT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  Evidence (links, quotes, context)
                  <textarea
                    required
                    maxLength={2000}
                    rows={4}
                    value={evidence}
                    onChange={(e) => setEvidence(e.target.value)}
                    className="rounded border px-2 py-1 dark:bg-gray-800"
                  />
                </label>
                <DuplicateReportAlert
                  duplicates={duplicates}
                  dismissed={dismissedDuplicates}
                  onDismiss={() => setDismissedDuplicates(true)}
                />
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={confidential} onChange={(e) => setConfidential(e.target.checked)} />
                  Keep evidence confidential to moderators
                </label>
                {status === 'error' && (
                  <p role="alert" className="text-red-600">
                    Could not save the report. Please try again.
                  </p>
                )}
              </>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 rounded border">
                Close
              </button>
              {status !== 'sent' && (
                <button type="submit" className="px-3 py-1.5 rounded bg-red-600 text-white">
                  Submit report
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </>
  )
}
