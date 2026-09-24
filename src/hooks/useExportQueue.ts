import { useCallback, useRef, useState } from 'react'
import {
  toCsv,
  priceDataToCsvRows,
  priceDataToJsonRows,
  priceDataToXlsx,
  downloadFile,
  downloadBinaryFile,
  exportFilename,
} from '../utils/export'
import { useToast } from '../context/ToastContext'
import type { PriceData } from '../types'
import { useRateLimit } from './useRateLimit'
import type { ExportFormat } from './useExport'

export type ExportTaskStatus = 'processing' | 'done' | 'error' | 'cancelled'

export interface ExportTask {
  id: string
  label: string
  format: ExportFormat
  status: ExportTaskStatus
  processed: number
  total: number
  startedAt: number
}

/** Items are processed in chunks so progress and cancellation are meaningful even though CSV/JSON/XLSX generation itself is fast (#311). */
const CHUNK_SIZE = 200

export interface UseExportQueueReturn {
  /** All queued/active/finished export tasks, oldest first. */
  tasks: ExportTask[]
  /** Queues a new export. Returns immediately; progress is tracked via `tasks`. */
  enqueue: (format: ExportFormat, items: PriceData[], columns?: string[], label?: string) => void
  /** Requests cancellation of an in-progress task. No-op once the task has finished. */
  cancel: (id: string) => void
  /** Removes a finished/cancelled/errored task from the list. */
  dismiss: (id: string) => void
}

/**
 * Runs price data exports through a visible queue with progress reporting
 * and cancellation, on top of the existing CSV/JSON/XLSX builders in
 * `utils/export.ts`. Shares the same `export` rate limiter as `useExport`.
 */
export function useExportQueue(): UseExportQueueReturn {
  const [tasks, setTasks] = useState<ExportTask[]>([])
  const cancelledRef = useRef<Set<string>>(new Set())
  const { addToast } = useToast()
  const { consume } = useRateLimit('export')

  const updateTask = useCallback((id: string, patch: Partial<ExportTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }, [])

  const runExport = useCallback(
    async (id: string, format: ExportFormat, items: PriceData[], columns?: string[]) => {
      const total = items.length

      for (let processed = 0; processed < total || processed === 0; processed += CHUNK_SIZE) {
        if (cancelledRef.current.has(id)) {
          cancelledRef.current.delete(id)
          updateTask(id, { status: 'cancelled' })
          return
        }
        updateTask(id, { processed: Math.min(processed + CHUNK_SIZE, total) })
        // Yield to the event loop so progress renders and cancel clicks are seen.
        await new Promise((resolve) => setTimeout(resolve, 0))
        if (total === 0) break
      }

      if (cancelledRef.current.has(id)) {
        cancelledRef.current.delete(id)
        updateTask(id, { status: 'cancelled' })
        return
      }

      try {
        if (format === 'json') {
          const json = JSON.stringify(priceDataToJsonRows(items, columns), null, 2)
          downloadFile(json, exportFilename('oracle-prices', 'json'), 'application/json')
        } else if (format === 'xlsx') {
          const xlsx = priceDataToXlsx(items, columns)
          downloadBinaryFile(
            xlsx,
            exportFilename('oracle-prices', 'xlsx'),
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          )
        } else {
          const { rows, headers } = priceDataToCsvRows(items, columns)
          downloadFile(toCsv(rows, headers), exportFilename('oracle-prices', 'csv'), 'text/csv')
        }
        updateTask(id, { status: 'done', processed: total })
        addToast({
          type: 'success',
          message: `Export ready — ${format.toUpperCase()} (${total} pair${total === 1 ? '' : 's'})`,
        })
      } catch (err) {
        updateTask(id, { status: 'error' })
        addToast({
          type: 'error',
          message: `Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        })
      }
    },
    [updateTask, addToast],
  )

  const enqueue = useCallback(
    (format: ExportFormat, items: PriceData[], columns?: string[], label?: string) => {
      if (!consume()) return
      const id = crypto.randomUUID()
      const task: ExportTask = {
        id,
        label: label ?? `${items.length} pair${items.length === 1 ? '' : 's'} · ${format.toUpperCase()}`,
        format,
        status: 'processing',
        processed: 0,
        total: items.length,
        startedAt: Date.now(),
      }
      setTasks((prev) => [...prev, task])
      void runExport(id, format, items, columns)
    },
    [consume, runExport],
  )

  const cancel = useCallback((id: string) => {
    cancelledRef.current.add(id)
  }, [])

  const dismiss = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { tasks, enqueue, cancel, dismiss }
}
