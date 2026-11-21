import { useMemo, useRef, useState, type ReactElement } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useAlerts } from '../hooks/useAlerts'
import { HISTORY_LIMIT } from '../services/alertHistory'
import { formatPrice, formatTimestamp } from '../utils/format'
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
  const { alertHistory, alertHistoryStatus, evaluationTimeline, clearAlertHistory } = useAlerts()
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
            aria-label={t('alertPanel.history.searchPlaceholder')}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
          />
        </div>
      )}

      <p className="mb-3 text-xs text-gray-500">{t('alertPanel.history.sourceNote')}</p>
      {exportStatus !== 'idle' && (
        <p
          className={`mb-3 text-xs ${exportStatus === 'error' ? 'text-red-300' : 'text-gray-400'}`}
          role={exportStatus === 'error' ? 'alert' : 'status'}
          aria-live={exportStatus === 'error' ? 'assertive' : 'polite'}
        >
          {exportStatus === 'exporting'
            ? t('alertPanel.history.exporting')
            : exportStatus === 'complete'
              ? t('alertPanel.history.exportComplete')
              : t('alertPanel.history.exportFailed')}
        </p>
      )}
      {alertHistoryStatus === 'unavailable' && alertHistory.length > 0 && (
        <p className="mb-3 text-xs text-amber-300" role="status">
          {t('alertPanel.history.storageUnavailable')}
        </p>
      )}
      {alertHistoryStatus === 'error' && alertHistory.length > 0 && (
        <p className="mb-3 text-xs text-red-300" role="alert">
          {t('alertPanel.history.storageError')}
        </p>
      )}
      {alertHistory.length >= HISTORY_LIMIT && (
        <p className="mb-3 text-xs text-amber-300" role="status">
          {t('alertPanel.history.retentionLimit')}
        </p>
      )}

      {alertHistoryStatus === 'error' && alertHistory.length === 0 ? (
        <p className="text-center py-8 text-sm text-red-300" role="alert">
          {t('alertPanel.history.storageError')}
        </p>
      ) : alertHistoryStatus === 'unavailable' && alertHistory.length === 0 ? (
        <p className="text-center py-8 text-sm text-gray-400" role="status">
          {t('alertPanel.history.storageUnavailable')}
        </p>
      ) : alertHistory.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-gray-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p>{t('alertPanel.history.empty')}</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center py-8 text-sm text-gray-500">{t('alertPanel.history.noResults')}</p>
      ) : (
        // #507 — long alert histories (1k+ entries) are windowed with
        // @tanstack/react-virtual so only visible rows are mounted; short
        // lists render every row directly, same as before.
        <div
          ref={scrollRef}
          style={isVirtual ? { maxHeight: SCROLL_CONTAINER_MAX_HEIGHT_PX, overflowY: 'auto' } : undefined}
        >
          <ul className="space-y-2">
            {paddingTop > 0 && <li aria-hidden="true" style={{ height: paddingTop }} />}
            {(virtualRows ?? filtered.map((_, index) => ({ index }))).map(({ index }) => {
              const entry = filtered[index]
              const triggeredAtUtc = new Date(entry.triggeredAt).toISOString()
              return (
                <li key={entry.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-white text-sm flex items-center gap-1.5">
                      {entry.assetPair}
                      {/* #487 — distinguish escalation-step firings from the initial trigger */}
                      {entry.escalation && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                          {t('alertPanel.escalation.historyBadge', {
                            channel: t(`alertModal.escalation.channel_${entry.escalation.channel}`),
                          })}
                        </span>
                      )}
                      {/* #491 — flag retest-enabled alert fire sequence entries */}
                      {entry.retest && entry.retest.kind === 'retest' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                          {t('alertPanel.retest.historyBadge')}
                        </span>
                      )}
                    </span>
                    <time className="text-xs text-gray-500" dateTime={triggeredAtUtc}>
                      {triggeredAtUtc}
                    </time>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 font-mono">{conditionText(entry, t)}</span>
                    <span className="text-gray-300 font-mono">
                      {t('alertPanel.history.priceAt', { price: formatPrice(entry.price) })}
                    </span>
                  </div>
                  {entry.evidence && (
                    <details className="mt-2 text-xs text-gray-400">
                      <summary className="w-fit cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
                        {t('alertPanel.history.tickEvidence')}
                      </summary>
                      <dl className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                        <div>
                          <dt className="inline">{t('alertPanel.history.tickTime')}: </dt>
                          <dd className="inline">{formatTimestamp(entry.evidence.timestamp)}</dd>
                        </div>
                        <div>
                          <dt className="inline">{t('alertPanel.history.tickConfidence')}: </dt>
                          <dd className="inline">{(entry.evidence.confidence * 100).toFixed(1)}%</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="inline">{t('alertPanel.history.tickSources')}: </dt>
                          <dd className="inline">
                            {entry.evidence.sources.length > 0
                              ? entry.evidence.sources.join(', ')
                              : t('alertPanel.history.tickUnavailable')}
                          </dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="inline">{t('alertPanel.history.sourcePrices')}: </dt>
                          <dd className="inline">
                            {entry.evidence.sourcePrices && Object.keys(entry.evidence.sourcePrices).length > 0
                              ? Object.entries(entry.evidence.sourcePrices)
                                  .map(([source, price]) => `${source}: ${formatPrice(price)}`)
                                  .join(', ')
                              : t('alertPanel.history.tickUnavailable')}
                          </dd>
                        </div>
                      </dl>
                    </details>
                  )}
                </li>
              )
            })}
            {paddingBottom > 0 && <li aria-hidden="true" style={{ height: paddingBottom }} />}
          </ul>
        </div>
      )}

      <details className="mt-4 rounded-xl border border-gray-700 bg-gray-800/30">
        <summary className="cursor-pointer rounded-xl px-3 py-2 text-sm text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
          {t('alertPanel.history.evaluationTimeline', { count: evaluationTimeline.length })}
        </summary>
        {evaluationTimeline.length === 0 ? (
          <p className="px-3 pb-3 text-xs text-gray-500">{t('alertPanel.history.noEvaluations')}</p>
        ) : (
          <ol
            className="max-h-72 space-y-2 overflow-y-auto px-3 pb-3"
            aria-label={t('alertPanel.history.evaluationTimelineLabel')}
          >
            {evaluationTimeline.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-gray-700/70 p-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="font-medium text-gray-200">
                    {entry.assetPair} · {t(EVALUATION_REASON_KEYS[entry.reason])}
                  </span>
                  <time className="text-gray-500" dateTime={new Date(entry.evaluatedAt).toISOString()}>
                    {formatTimestamp(entry.evaluatedAt)}
                  </time>
                </div>
                <p className="mt-1 text-gray-400">
                  {entry.price === null
                    ? t('alertPanel.history.evaluationReasons.notAvailable')
                    : t('alertPanel.history.priceAt', { price: formatPrice(entry.price) })}
                </p>
                {entry.conditions && entry.conditions.length > 0 && (
                  <ul className="mt-1 space-y-0.5 ps-3 text-gray-500">
                    {entry.conditions.map((condition) => (
                      <li key={condition.conditionId}>{conditionTraceText(condition, t)}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </details>
    </div>
  )
}
