import { useId } from 'react'
import {
  getComparisonGuideSteps,
  isComparisonGuideComplete,
  type ComparisonGuideProgress,
} from '../utils/firstComparisonGuide'

interface FirstComparisonGuideProps {
  progress: ComparisonGuideProgress
  onDismiss: () => void
}

/**
 * Checklist that walks a new user from first visit to their first price
 * comparison (#816). Completion is shown in text as well as colour, and the
 * dismiss control is a native button, so keyboard and screen-reader users get
 * the same information. Renders nothing once dismissed or finished.
 */
export function FirstComparisonGuide({ progress, onDismiss }: FirstComparisonGuideProps) {
  const headingId = useId()

  if (progress.dismissed || isComparisonGuideComplete(progress)) return null

  const steps = getComparisonGuideSteps(progress)

  return (
    <section aria-labelledby={headingId} className="mb-6 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id={headingId} className="text-base font-semibold text-gray-100">
          Make your first price comparison
        </h2>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded border border-gray-700 px-3 py-1 text-xs text-gray-300 hover:bg-gray-800"
        >
          Dismiss guide
        </button>
      </div>
      <ol className="mt-3 flex flex-col gap-2">
        {steps.map((step, index) => (
          <li key={step.id} className="flex gap-3 text-sm">
            <span aria-hidden="true" className={step.done ? 'text-emerald-400' : 'text-gray-500'}>
              {step.done ? '✓' : index + 1}
            </span>
            <div>
              <p className={step.done ? 'text-gray-400 line-through' : 'text-gray-100'}>
                {step.title}
                <span className="sr-only">{step.done ? ' (completed)' : ' (to do)'}</span>
              </p>
              <p className="text-xs text-gray-400">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
