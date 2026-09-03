import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import type { ExportFormat } from '../hooks/useExport'
import type { ExportFrequency, UseScheduledExportsReturn } from '../hooks/useScheduledExports'

interface ScheduledExportsPanelProps extends UseScheduledExportsReturn {
  isOpen: boolean
  onClose: () => void
  availablePairs: string[]
}

const FREQUENCIES: ExportFrequency[] = ['daily', 'weekly', 'monthly']
const FORMATS: ExportFormat[] = ['csv', 'json', 'xlsx']

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString()
}

export function ScheduledExportsPanel({
  isOpen,
  onClose,
  availablePairs,
  schedules,
  history,
  createSchedule,
  deleteSchedule,
  runNow,
}: ScheduledExportsPanelProps): ReactElement | null {
  const { t } = useTranslation()
  const [label, setLabel] = useState('')
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [frequency, setFrequency] = useState<ExportFrequency>('weekly')
  const [selectedPairs, setSelectedPairs] = useState<Set<string>>(new Set())

  if (!isOpen) return null

  const togglePair = (pair: string) => {
    setSelectedPairs((prev) => {
      const next = new Set(prev)
      if (next.has(pair)) next.delete(pair)
      else next.add(pair)
      return next
    })
  }

  const handleCreate = () => {
    createSchedule({ label, pairs: [...selectedPairs], format, frequency })
    setLabel('')
    setSelectedPairs(new Set())
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('scheduledExports.title', { defaultValue: 'Scheduled exports' }) as string}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-100">{t('scheduledExports.title', { defaultValue: 'Scheduled exports' })}</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-300" aria-label={t('common.close', { defaultValue: 'Close' }) as string}>
            ✕
          </button>
        </div>

        <section className="space-y-2.5">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            {t('scheduledExports.newSchedule', { defaultValue: 'New schedule' })}
          </h3>

          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('scheduledExports.labelPlaceholder', { defaultValue: 'Schedule name' }) as string}
            className="w-full px-3 py-1.5 text-sm rounded-lg bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          />

          <div className="flex gap-2">
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as ExportFrequency)}
              className="flex-1 px-2 py-1.5 text-sm rounded-lg bg-gray-800 border border-gray-700 text-gray-200"
              aria-label={t('scheduledExports.frequency', { defaultValue: 'Frequency' }) as string}
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {t(`scheduledExports.frequencies.${f}`, { defaultValue: f })}
                </option>
              ))}
            </select>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportFormat)}
              className="flex-1 px-2 py-1.5 text-sm rounded-lg bg-gray-800 border border-gray-700 text-gray-200"
              aria-label={t('scheduledExports.format', { defaultValue: 'Format' }) as string}
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1.5">
              {t('scheduledExports.pairs', { defaultValue: 'Pairs (none selected = all pairs)' })}
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {availablePairs.map((pair) => (
                <label key={pair} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-gray-700 text-xs text-gray-300 cursor-pointer hover:bg-gray-800">
                  <input type="checkbox" checked={selectedPairs.has(pair)} onChange={() => togglePair(pair)} className="accent-cyan-500" />
                  {pair}
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreate}
            className="w-full px-3 py-1.5 text-sm rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
          >
            {t('scheduledExports.create', { defaultValue: 'Create schedule' })}
          </button>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            {t('scheduledExports.active', { defaultValue: 'Active schedules' })}
          </h3>
          {schedules.length === 0 ? (
            <p className="text-xs text-gray-600">{t('scheduledExports.none', { defaultValue: 'No schedules yet.' })}</p>
          ) : (
            <ul className="space-y-1.5">
              {schedules.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs">
                  <div className="min-w-0">
                    <p className="text-gray-200 font-medium truncate">{s.label}</p>
                    <p className="text-gray-500">
                      {t(`scheduledExports.frequencies.${s.frequency}`, { defaultValue: s.frequency })} · {s.format.toUpperCase()} ·{' '}
                      {s.pairs.length > 0 ? `${s.pairs.length} pair${s.pairs.length === 1 ? '' : 's'}` : t('scheduledExports.allPairs', { defaultValue: 'all pairs' })}
                    </p>
                    <p className="text-gray-600">{t('scheduledExports.next', { defaultValue: 'Next' })}: {formatDateTime(s.nextRunAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => runNow(s.id)} className="text-cyan-400 hover:text-cyan-300 transition-colors">
                      {t('scheduledExports.runNow', { defaultValue: 'Run now' })}
                    </button>
                    <button type="button" onClick={() => deleteSchedule(s.id)} className="text-gray-500 hover:text-red-400 transition-colors">
                      {t('scheduledExports.delete', { defaultValue: 'Delete' })}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            {t('scheduledExports.history', { defaultValue: 'History' })}
          </h3>
          {history.length === 0 ? (
            <p className="text-xs text-gray-600">{t('scheduledExports.noHistory', { defaultValue: 'No exports have run yet.' })}</p>
          ) : (
            <ul className="space-y-1 max-h-40 overflow-y-auto">
              {[...history].reverse().map((h) => (
                <li key={h.id} className="flex items-center justify-between text-xs text-gray-500 px-2.5 py-1.5 rounded-lg bg-gray-800/60">
                  <span className="truncate">{h.scheduleLabel} · {h.format.toUpperCase()} · {h.pairCount} pairs</span>
                  <span className="shrink-0">{formatDateTime(h.ranAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
