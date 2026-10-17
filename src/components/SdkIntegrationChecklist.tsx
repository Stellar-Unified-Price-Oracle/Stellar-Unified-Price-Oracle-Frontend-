import { useEffect, useRef, useState } from 'react'
import { SDK_CHECKLIST_STEPS, runChecklistStep, type ChecklistStepResult } from '../utils/sdkChecklist'

/** `'running'` while a check is in flight; a result once it has finished. */
type StepRun = 'running' | ChecklistStepResult

interface SdkIntegrationChecklistProps {
  /** API origin the checks run against, without a trailing `/api`. */
  baseUrl: string
}

/**
 * Executable SDK integration checklist (#808). Every step issues a real request
 * against the configured API, so a developer sees whether their setup works
 * instead of trusting a static list.
 */
export function SdkIntegrationChecklist({ baseUrl }: SdkIntegrationChecklistProps) {
  const [runs, setRuns] = useState<Record<string, StepRun>>({})
  const [running, setRunning] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)

  // Cancel any in-flight checks when the page unmounts so no state updates land late.
  useEffect(() => () => controllerRef.current?.abort(), [])

  const execute = async (ids: string[]) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setRunning(true)

    const ctx = { baseUrl, fetchImpl: fetch, signal: controller.signal }
    for (const step of SDK_CHECKLIST_STEPS.filter((s) => ids.includes(s.id))) {
      if (controller.signal.aborted) break
      setRuns((prev) => ({ ...prev, [step.id]: 'running' }))
      const result = await runChecklistStep(step, ctx)
      if (controller.signal.aborted) break
      setRuns((prev) => ({ ...prev, [step.id]: result }))
    }

    if (controllerRef.current === controller) {
      controllerRef.current = null
      setRunning(false)
    }
  }

  const finished = Object.values(runs).filter((run): run is ChecklistStepResult => run !== 'running')
  const passed = finished.filter((run) => run.ok).length
  const total = SDK_CHECKLIST_STEPS.length

  return (
    <section aria-labelledby="sdk-checklist-heading" className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="sdk-checklist-heading" className="text-lg font-semibold text-gray-900 dark:text-white">
            SDK integration checklist
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Each check sends a real request to the API. Run them after wiring up the SDK.
          </p>
        </div>
        <button
          type="button"
          disabled={running}
          onClick={() => void execute(SDK_CHECKLIST_STEPS.map((s) => s.id))}
          className="px-3 py-1.5 text-sm rounded-lg border border-cyan-800 bg-cyan-900/20 text-cyan-300 hover:bg-cyan-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Run all checks
        </button>
      </div>

      <p role="status" aria-live="polite" className="mt-3 text-sm text-gray-300">
        {finished.length > 0 ? `${passed} of ${total} checks passed` : ''}
      </p>

      <ol className="mt-3 space-y-3">
        {SDK_CHECKLIST_STEPS.map((step) => {
          const run = runs[step.id]
          const statusLabel =
            run === undefined ? 'Not run' : run === 'running' ? 'Running…' : run.ok ? 'Passed' : 'Failed'
          const statusClass =
            run === undefined || run === 'running' ? 'text-gray-400' : run.ok ? 'text-emerald-400' : 'text-rose-400'
          return (
            <li key={step.id} className="rounded-lg border border-gray-800 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-gray-200">{step.title}</h3>
                  <p className="mt-1 text-xs text-gray-400">{step.instructions}</p>
                </div>
                <button
                  type="button"
                  disabled={running}
                  aria-label={`Run check: ${step.title}`}
                  onClick={() => void execute([step.id])}
                  className="px-2.5 py-1 text-xs rounded-md border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Run check
                </button>
              </div>
              <p className={`mt-2 text-xs ${statusClass}`}>
                <span className="font-semibold">{statusLabel}</span>
                {run && run !== 'running' && <span className="text-gray-400"> — {run.detail}</span>}
              </p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
