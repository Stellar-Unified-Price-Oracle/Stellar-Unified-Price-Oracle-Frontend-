import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../context/ToastContext'
import {
  toCsv,
  priceDataToCsvRows,
  priceDataToJsonRows,
  priceDataToXlsx,
  downloadFile,
  downloadBinaryFile,
  exportFilename,
} from '../utils/export'
import type { PriceData } from '../types'
import { useIdbQuery, useIdbMutation } from './useIdbQuery'
import type { ExportFormat } from './useExport'

export type ExportFrequency = 'daily' | 'weekly' | 'monthly'

export interface ExportSchedule {
  id: string
  label: string
  /** Asset pairs to include. Empty array means "all pairs". */
  pairs: string[]
  format: ExportFormat
  frequency: ExportFrequency
  createdAt: number
  lastRunAt: number | null
  nextRunAt: number
}

export interface ScheduledExportHistoryEntry {
  id: string
  scheduleId: string
  scheduleLabel: string
  ranAt: number
  format: ExportFormat
  pairCount: number
  trigger: 'scheduled' | 'manual'
}

const SCHEDULES_KEY = 'scheduled-exports'
const HISTORY_KEY = 'scheduled-exports-history'
const MAX_HISTORY = 50

const FREQUENCY_MS: Record<ExportFrequency, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
}

export function computeNextRun(frequency: ExportFrequency, from = Date.now()): number {
  return from + FREQUENCY_MS[frequency]
}

export interface CreateScheduleInput {
  label: string
  pairs: string[]
  format: ExportFormat
  frequency: ExportFrequency
}

export interface UseScheduledExportsReturn {
  schedules: ExportSchedule[]
  history: ScheduledExportHistoryEntry[]
  loading: boolean
  createSchedule: (input: CreateScheduleInput) => void
  deleteSchedule: (id: string) => void
  runNow: (id: string) => void
}

/**
 * Manages export schedules and their run history, persisted in IndexedDB
 * (#318). There is no backend, so "scheduling" is a best-effort client-side
 * approximation: due schedules are run (and rescheduled) whenever this hook
 * is mounted with fresh price data — i.e. whenever the dashboard is open.
 * Email delivery is out of scope; runs trigger a normal browser download.
 */
export function useScheduledExports(allPrices: PriceData[]): UseScheduledExportsReturn {
  const { data: schedulesData, loading: schedulesLoading } = useIdbQuery<ExportSchedule[]>('preferences', SCHEDULES_KEY)
  const { data: historyData, loading: historyLoading } = useIdbQuery<ScheduledExportHistoryEntry[]>('preferences', HISTORY_KEY)
  const { set } = useIdbMutation()
  const { addToast } = useToast()

  const [schedules, setSchedules] = useState<ExportSchedule[]>([])
  const [history, setHistory] = useState<ScheduledExportHistoryEntry[]>([])

  useEffect(() => {
    if (!schedulesLoading) setSchedules(schedulesData ?? [])
  }, [schedulesData, schedulesLoading])

  useEffect(() => {
    if (!historyLoading) setHistory(historyData ?? [])
  }, [historyData, historyLoading])

  const persistSchedules = useCallback(
    (next: ExportSchedule[]) => {
      setSchedules(next)
      void set('preferences', SCHEDULES_KEY, next)
    },
    [set],
  )

  const persistHistory = useCallback(
    (entry: ScheduledExportHistoryEntry) => {
      setHistory((prev) => {
        const next = [...prev, entry].slice(-MAX_HISTORY)
        void set('preferences', HISTORY_KEY, next)
        return next
      })
    },
    [set],
  )

  const downloadExport = useCallback((schedule: ExportSchedule, items: PriceData[]) => {
    const base = schedule.label.trim() || 'scheduled-export'
    if (schedule.format === 'json') {
      downloadFile(JSON.stringify(priceDataToJsonRows(items), null, 2), exportFilename(base, 'json'), 'application/json')
    } else if (schedule.format === 'xlsx') {
      downloadBinaryFile(
        priceDataToXlsx(items),
        exportFilename(base, 'xlsx'),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
    } else {
      const { rows, headers } = priceDataToCsvRows(items)
      downloadFile(toCsv(rows, headers), exportFilename(base, 'csv'), 'text/csv')
    }
  }, [])

  const executeSchedule = useCallback(
    (schedule: ExportSchedule, prices: PriceData[], trigger: 'scheduled' | 'manual') => {
      const items = schedule.pairs.length > 0 ? prices.filter((p) => schedule.pairs.includes(p.assetPair)) : prices
      if (items.length === 0) return

      downloadExport(schedule, items)
      persistHistory({
        id: crypto.randomUUID(),
        scheduleId: schedule.id,
        scheduleLabel: schedule.label,
        ranAt: Date.now(),
        format: schedule.format,
        pairCount: items.length,
        trigger,
      })
      addToast({
        type: 'success',
        message: trigger === 'scheduled' ? `Scheduled export ran: ${schedule.label}` : `Export ready: ${schedule.label}`,
      })
    },
    [downloadExport, persistHistory, addToast],
  )

  // Best-effort automation: on load (and whenever prices refresh), run any
  // schedule whose nextRunAt has passed, then reschedule it.
  useEffect(() => {
    if (schedulesLoading || allPrices.length === 0 || schedules.length === 0) return
    const now = Date.now()
    const due = schedules.filter((s) => s.nextRunAt <= now)
    if (due.length === 0) return

    due.forEach((schedule) => executeSchedule(schedule, allPrices, 'scheduled'))

    persistSchedules(
      schedules.map((s) =>
        due.some((d) => d.id === s.id)
          ? { ...s, lastRunAt: now, nextRunAt: computeNextRun(s.frequency, now) }
          : s,
      ),
    )
    // Only re-check when the schedule list or the underlying price snapshot changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedules, schedulesLoading, allPrices])

  const createSchedule = useCallback(
    (input: CreateScheduleInput) => {
      const now = Date.now()
      const schedule: ExportSchedule = {
        id: crypto.randomUUID(),
        label: input.label.trim() || `${input.format.toUpperCase()} export`,
        pairs: input.pairs,
        format: input.format,
        frequency: input.frequency,
        createdAt: now,
        lastRunAt: null,
        nextRunAt: computeNextRun(input.frequency, now),
      }
      persistSchedules([...schedules, schedule])
    },
    [schedules, persistSchedules],
  )

  const deleteSchedule = useCallback(
    (id: string) => {
      persistSchedules(schedules.filter((s) => s.id !== id))
    },
    [schedules, persistSchedules],
  )

  const runNow = useCallback(
    (id: string) => {
      const schedule = schedules.find((s) => s.id === id)
      if (!schedule) return
      executeSchedule(schedule, allPrices, 'manual')
      const now = Date.now()
      persistSchedules(
        schedules.map((s) => (s.id === id ? { ...s, lastRunAt: now, nextRunAt: computeNextRun(s.frequency, now) } : s)),
      )
    },
    [schedules, allPrices, executeSchedule, persistSchedules],
  )

  return {
    schedules,
    history,
    loading: schedulesLoading || historyLoading,
    createSchedule,
    deleteSchedule,
    runNow,
  }
}
