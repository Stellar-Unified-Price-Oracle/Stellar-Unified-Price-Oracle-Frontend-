import { useMemo, useRef, useState, type ReactElement } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useAlerts } from '../hooks/useAlerts'
import { formatPrice } from '../utils/format'
import { loadExportUtils } from '../utils/deferredExports'
import type { AlertEvaluationEntry, AlertHistoryEntry } from '../types'

// #507 — long alert histories (1k+ entries) render every row without this;
// only virtualize once the list is long enough to matter so short lists keep
// their previous simple markup.
const ROW_HEIGHT_PX = 68
const VIRTUALIZE_THRESHOLD = 50
const OVERSCAN_ROWS = 8
const SCROLL_CONTAINER_MAX_HEIGHT_PX = 480

function conditionText(entry: AlertHistoryEntry, t: TFunction): string {
  if (entry.percentageMode) {
    const dir = entry.percentageDirection ?? 'either'
    return t('alertPanel.conditions.percentage', {
      direction: t(`alertPanel.conditions.dir_${dir}`),
      pct: entry.percentageThreshold ?? 0,
      window: entry.percentageWindow ?? '1hr',
    })
  }
  if (entry.upperThreshold !== null && entry.lowerThreshold !== null) {
    return t('alertPanel.conditions.between', {
      lower: formatPrice(entry.lowerThreshold),
      upper: formatPrice(entry.upperThreshold),
    })
  }
  if (entry.upperThreshold !== null)
    return t('alertPanel.conditions.above', { upper: formatPrice(entry.upperThreshold) })
  if (entry.lowerThreshold !== null)
    return t('alertPanel.conditions.below', { lower: formatPrice(entry.lowerThreshold) })
  return t('alertPanel.conditions.none')
}

type EvaluationReasonTranslationKey =
  | 'alertPanel.history.evaluationReasons.inactive'
  | 'alertPanel.history.evaluationReasons.snoozed'
  | 'alertPanel.history.evaluationReasons.priceUnavailable'
  | 'alertPanel.history.evaluationReasons.stalePrice'
  | 'alertPanel.history.evaluationReasons.baselineReset'
  | 'alertPanel.history.evaluationReasons.cooldown'
  | 'alertPanel.history.evaluationReasons.conditionNotMet'
  | 'alertPanel.history.evaluationReasons.conditionMatched'
  | 'alertPanel.history.evaluationReasons.thresholdCleared'

const EVALUATION_REASON_KEYS: Record<AlertEvaluationEntry['reason'], EvaluationReasonTranslationKey> = {
  alert_inactive: 'alertPanel.history.evaluationReasons.inactive',
  snoozed: 'alertPanel.history.evaluationReasons.snoozed',
  price_unavailable: 'alertPanel.history.evaluationReasons.priceUnavailable',
  stale_price: 'alertPanel.history.evaluationReasons.stalePrice',
  baseline_reset: 'alertPanel.history.evaluationReasons.baselineReset',
  cooldown: 'alertPanel.history.evaluationReasons.cooldown',
  condition_not_met: 'alertPanel.history.evaluationReasons.conditionNotMet',
  condition_matched: 'alertPanel.history.evaluationReasons.conditionMatched',
  threshold_cleared: 'alertPanel.history.evaluationReasons.thresholdCleared',
}

function conditionTraceText(condition: NonNullable<AlertEvaluationEntry['conditions']>[number], t: TFunction): string {
  const expected =
    condition.field === 'price'
      ? formatPrice(condition.expected)
      : `${condition.expected}${condition.field === 'schedule' ? '' : '%'}`
  const actual =
    condition.actual === null
      ? t('alertPanel.history.evaluationReasons.notAvailable')
      : condition.field === 'price'
        ? formatPrice(condition.actual)
        : `${condition.actual}${condition.field === 'schedule' ? '' : '%'}`
  return t('alertPanel.history.conditionResult', {
    field: t(`alertPanel.history.fields.${condition.field}`),
    operator: condition.operator,
    expected,
    actual,
    result: t(condition.matched ? 'alertPanel.history.matched' : 'alertPanel.history.notMatched'),
  })
}

export function AlertHistoryLog(): ReactElement {
  const { alertHistory, evaluationTimeline, clearAlertHistory } = useAlerts()
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'complete' | 'error'>('idle')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Search operates over the full (unvirtualized) history so it's honest
  // about what matches, independent of what's currently mounted (#507).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return alertHistory
    return alertHistory.filter((e) => e.assetPair.toLowerCase().includes(q))
  }, [alertHistory, search])

  const isVirtual = filtered.length > VIRTUALIZE_THRESHOLD

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: OVERSCAN_ROWS,
  })

  const virtualRows = isVirtual ? rowVirtualizer.getVirtualItems() : null
  const totalSize = isVirtual ? rowVirtualizer.getTotalSize() : filtered.length * ROW_HEIGHT_PX
  const paddingTop = virtualRows && virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom = virtualRows && virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0

  const handleExportCsv = async (): Promise<void> => {
    const { alertHistoryToCsvRows, downloadFile, exportFilename, toCsv } = await loadExportUtils()
    const { rows, headers } = alertHistoryToCsvRows(filtered)
    downloadFile(toCsv(rows, headers), exportFilename('alert-history', 'csv'), 'text/csv')
  }

  const handleExport = async (format: 'csv' | 'json'): Promise<void> => {
    setExportStatus('exporting')
    try {
      const { alertHistoryToAuditJson, alertHistoryToCsvRows, downloadFile, exportFilename, toCsv } =
        await loadExportUtils()
      const content =
        format === 'csv'
          ? (() => {
              const { rows, headers } = alertHistoryToCsvRows(filtered)
              return toCsv(rows, headers)
            })()
          : alertHistoryToAuditJson(filtered)
      downloadFile(content, exportFilename('alert-history', format), format === 'csv' ? 'text/csv' : 'application/json')
      setExportStatus('complete')
    } catch (error) {
      console.error('[AlertHistoryLog] Failed to export alert history:', error)
      setExportStatus('error')
    }
  }

  const handleClear = (): void => {
    if (window.confirm(t('alertPanel.history.clearConfirm'))) {
      clearAlertHistory()
    }
  }

  return (
    <div>
      {alertHistory.length > 0 && (
        <div className="mb-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-500">
              {t('alertPanel.history.count', { count: alertHistory.length })}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void handleExport('csv')}
                disabled={filtered.length === 0 || exportStatus === 'exporting'}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('alertPanel.history.exportCsv')}
              </button>
              <button
                type="button"
                onClick={() => void handleExport('json')}
                disabled={filtered.length === 0 || exportStatus === 'exporting'}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('alertPanel.history.exportJson')}
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1.5 transition-colors"
              >
                {t('alertPanel.history.clear')}
              </button>
            </div>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('alertPanel.history.searchPlaceholder')}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">
          {alertHistory.length === 0
            ? t('alertPanel.history.empty')
            : t('alertPanel.history.noMatches')}
        </p>
      ) : (
        <div
          ref={scrollRef}
          className="overflow-y-auto"
          style={{ maxHeight: SCROLL_CONTAINER_MAX_HEIGHT_PX }}
        >
          <div style={{ height: totalSize, position: 'relative' }}>
            <div style={{ transform: `translateY(${paddingTop}px)` }}>
              {(virtualRows ?? filtered.map((_, i) => ({ index: i, key: i, start: i * ROW_HEIGHT_PX, end: (i + 1) * ROW_HEIGHT_PX }))).map(
                (row) => {
                  const entry = filtered[row.index]
                  if (!entry) return null
                  return (
                    <div
                      key={row.key}
                      className="border-b border-gray-800 py-3 px-1"
                      style={{ minHeight: ROW_HEIGHT_PX }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-200">{entry.assetPair}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{conditionText(entry, t)}</p>
                    </div>
                  )
                },
              )}
            </div>
          </div>
        </div>
      )}

      {evaluationTimeline.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-xs font-semibold text-gray-400">
            {t('alertPanel.history.evaluationTimeline')}
          </h4>
          {evaluationTimeline.map((entry, i) => (
            <div key={i} className="text-xs text-gray-500 border-s-2 border-gray-700 ps-2">
              <span className="text-gray-400">
                {t(EVALUATION_REASON_KEYS[entry.reason])}
              </span>
              {entry.conditions && entry.conditions.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {entry.conditions.map((c, j) => (
                    <li key={j} className="text-gray-500">
                      {conditionTraceText(c, t)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
