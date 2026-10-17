/**
 * @file DismissibleExplanation
 *
 * An inline explanation the user can dismiss (#822). Whether a dismissed
 * explanation comes back is controlled by the `explanationReappearPolicy`
 * preference, set in `PreferencesPanel`.
 *
 * The note is a labelled `role="note"` region. Its Dismiss button is a native
 * button, so it works with the keyboard and announces its purpose. Once dismissed
 * the note is removed from the DOM, so focus returns to the document body.
 */
import { memo, useState, type ReactNode } from 'react'
import { usePreferences } from '../preferences/PreferencesContext'
import {
  loadExplanationDismissals,
  saveExplanationDismissals,
  shouldShowExplanation,
  withDismissal,
  type ExplanationDismissals,
} from '../utils/explanationDismissals'

export interface DismissibleExplanationProps {
  /** Stable identifier for this explanation. Changing it resets its dismissal state. */
  id: string
  /** Short heading; also the note's accessible name. */
  title: string
  children: ReactNode
}

export const DismissibleExplanation = memo(function DismissibleExplanation({
  id,
  title,
  children,
}: DismissibleExplanationProps) {
  const { preferences } = usePreferences()
  const [dismissals, setDismissals] = useState<ExplanationDismissals>(loadExplanationDismissals)
  // Captured once per mount so the render stays pure; a long-lived note re-evaluates on remount.
  const [mountedAt] = useState(() => Date.now())

  if (!shouldShowExplanation(id, preferences.explanationReappearPolicy, dismissals, mountedAt)) return null

  const dismiss = () => {
    const next = withDismissal(dismissals, id, Date.now())
    saveExplanationDismissals(next)
    setDismissals(next)
  }

  return (
    <section role="note" aria-label={title} className="flex items-start gap-3 rounded-lg bg-slate-800 p-3 text-sm">
      <div className="flex-1">
        <p className="font-medium text-gray-100">{title}</p>
        <div className="mt-1 text-gray-300">{children}</div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={`Dismiss: ${title}`}
        className="shrink-0 rounded px-2 py-1 text-xs text-gray-300 hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500"
      >
        Dismiss
      </button>
    </section>
  )
})
