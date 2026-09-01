import { useMemo, useRef, useState, type ReactElement } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useAlerts } from '../hooks/useAlerts'
import { formatPrice, formatTimestamp } from '../utils/format'
import { loadExportUtils } from '../utils/deferredExports'
import type { AlertHistoryEntry } from '../types'

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
    return t('alertPanel.conditions.between', { lower: formatPrice(entry.lowerThreshold), upper: formatPrice(entry.upperThreshold) })
  }
  if (entry.upperThreshold !== null) return t('alertPanel.conditions.above', { upper: formatPrice(entry.upperThreshold) })
  if (entry.lowerThreshold !== null) return t('alertPanel.conditions.below', { lower: formatPrice(entry.lowerThreshold) })
  return t('alertPanel.conditions.none')
}

export function AlertHistoryLog(): ReactElement {
  const { alertHistory, clearAlertHistory } = useAlerts()
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
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
  const paddingBottom =
    virtualRows && virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0

  const handleExportCsv = async (): Promise<void> => {
    const { alertHistoryToCsvRows, downloadFile, exportFilename, toCsv } =
      await loadExportUtils()
    const { rows, headers } = alertHistoryToCsvRows(filtered)
    downloadFile(toCsv(rows, headers), exportFilename('alert-history', 'csv'), 'text/csv')
  }

  const handleExportJson = async (): Promise<void> => {
    const { downloadFile, exportFilename } = await loadExportUtils()
    downloadFile(JSON.stringify(filtered, null, 2), exportFilename('alert-history', 'json'), 'application/json')
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
            <span className="text-xs text-gray-500">{t('alertPanel.history.count', { count: alertHistory.length })}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void handleExportCsv()}
                disabled={filtered.length === 0}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('alertPanel.history.exportCsv')}
              </button>
              <button
                type="button"
                onClick={() => void handleExportJson()}
                disabled={filtered.length === 0}
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

      {alertHistory.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
              return (
                <li key={entry.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-white text-sm flex items-center gap-1.5">
                      {entry.assetPair}
                      {/* #487 — distinguish escalation-step firings from the initial trigger */}
                      {entry.escalation && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                          {t('alertPanel.escalation.historyBadge', { channel: t(`alertModal.escalation.channel_${entry.escalation.channel}`) })}
                        </span>
                      )}
                      {/* #491 — flag retest-enabled alert fire sequence entries */}
                      {entry.retest && entry.retest.kind === 'retest' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                          {t('alertPanel.retest.historyBadge')}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-gray-500">{formatTimestamp(entry.triggeredAt)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 font-mono">{conditionText(entry, t)}</span>
                    <span className="text-gray-300 font-mono">{t('alertPanel.history.priceAt', { price: formatPrice(entry.price) })}</span>
                  </div>
                </li>
              )
            })}
            {paddingBottom > 0 && <li aria-hidden="true" style={{ height: paddingBottom }} />}
          </ul>
        </div>
      )}
    </div>
  )
}
