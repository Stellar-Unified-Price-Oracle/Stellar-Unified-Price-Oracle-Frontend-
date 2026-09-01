import { useEffect, useState, type ReactElement } from 'react'
import type { ExportTask } from '../hooks/useExportQueue'

interface ExportProgressPanelProps {
  tasks: ExportTask[]
  onCancel: (id: string) => void
  onDismiss: (id: string) => void
}

const STATUS_LABEL: Record<ExportTask['status'], string> = {
  processing: 'Exporting…',
  done: 'Complete',
  error: 'Failed',
  cancelled: 'Cancelled',
}

function estimateRemainingMs(task: ExportTask, now: number): number | null {
  if (task.status !== 'processing' || task.total === 0 || task.processed === 0) return null
  const elapsed = now - task.startedAt
  const rate = task.processed / elapsed
  if (!Number.isFinite(rate) || rate <= 0) return null
  return Math.max(0, Math.round((task.total - task.processed) / rate))
}

function formatMs(ms: number): string {
  if (ms < 1000) return '<1s'
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}

/** Fixed-position panel showing queued/active export tasks with progress, cancellation, and status (#311). */
export function ExportProgressPanel({ tasks, onCancel, onDismiss }: ExportProgressPanelProps): ReactElement | null {
  const [now, setNow] = useState(() => Date.now())

  const hasActive = tasks.some((t) => t.status === 'processing')
  useEffect(() => {
    if (!hasActive) return
    const interval = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(interval)
  }, [hasActive])

  if (tasks.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-40 w-80 max-w-[calc(100vw-2rem)] space-y-2"
      role="region"
      aria-label="Export progress"
    >
      {tasks.map((task) => {
        const pct = task.total === 0 ? 100 : Math.round((task.processed / task.total) * 100)
        const remaining = estimateRemainingMs(task, now)
        return (
          <div
            key={task.id}
            className="bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-lg text-xs text-gray-300"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-medium truncate">{task.label}</span>
              <span
                className={
                  task.status === 'error'
                    ? 'text-red-400'
                    : task.status === 'done'
                      ? 'text-green-400'
                      : 'text-gray-500'
                }
              >
                {STATUS_LABEL[task.status]}
              </span>
            </div>

            <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div
                className={`h-full rounded-full transition-all ${task.status === 'error' ? 'bg-red-500' : task.status === 'cancelled' ? 'bg-gray-600' : 'bg-cyan-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="flex items-center justify-between mt-1.5 text-gray-500">
              <span>
                {task.processed}/{task.total} · {pct}%
                {remaining !== null && ` · ~${formatMs(remaining)} left`}
              </span>
              {task.status === 'processing' ? (
                <button
                  type="button"
                  onClick={() => onCancel(task.id)}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onDismiss(task.id)}
                  className="text-gray-400 hover:text-gray-200 transition-colors"
                  aria-label={`Dismiss ${task.label} export`}
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
