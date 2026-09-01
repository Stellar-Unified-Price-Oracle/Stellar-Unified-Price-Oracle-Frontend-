/**
 * @file AlertPanel
 *
 * A slide-in panel that lists all configured price alerts, grouped by status
 * (triggered, snoozed, active, inactive). Integrates with `useAlerts` for state
 * management and `AlertHistoryLog` for the history tab.
 *
 * Renders `null` when the panel is closed (`isPanelOpen` is `false` in
 * `useAlerts`), so it can be unconditionally placed in the component tree.
 *
 * @example Placed at the app shell level
 * ```tsx
 * // In Layout.tsx — AlertPanel manages its own open/close state via useAlerts
 * <AlertPanel />
 * ```
 *
 * ## Features
 * - **Tabs** — "Alerts" tab lists live thresholds; "History" tab shows the
 *   `AlertHistoryLog` of past triggers.
 * - **Snooze** — each triggered alert has a snooze menu with durations: 15 min,
 *   1 hr, 4 hr, 24 hr, tomorrow.
 * - **Toggle** — enable/disable individual alerts without deleting them.
 * - **Re-enable** — restore fired-once alerts.
 * - **Condition display** — human-readable threshold or percentage condition
 *   (e.g. "price > $70,000" or "drops ≥ 5 % in 1 hr").
 *
 * ## Edge cases
 * - **Empty state** — when no alerts exist, an "Add your first alert" prompt is shown.
 * - **Snoozed with elapsed time** — if the app is left open past a snooze window,
 *   the alert is reclassified on the next render.
 * - **`isPanelOpen = false`** — component returns `null`; no DOM is rendered.
 *
 * ## Accessibility
 * - Each alert row's action buttons have descriptive `aria-label` attributes.
 * - The snooze dropdown uses standard `<button>` elements inside a `<div>`.
 * - Tab switching buttons carry `role="tab"` and `aria-selected` attributes.
 */
import { useState, useCallback, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { useAlerts } from '../hooks/useAlerts'
import { formatPrice } from '../utils/format'
import type { Alert, AlertSnoozeDuration } from '../types'
import { computeAlertStats, alertStatsToExportRow } from '../utils/alertAnalytics'
import { toCsv, downloadFile } from '../utils/export'
import { useAlertHealth } from '../hooks/useAlertHealth'
import type { AlertHealthFlag } from '../utils/alertHealthCheck'
import { AlertHistoryLog } from './AlertHistoryLog'
import { AlertAnalyticsStrip } from './AlertAnalyticsStrip'

/** #492 – Renders an alert's per-alert routing override, or nothing when unset. */
function RoutingBadge({ alert }: { alert: Alert }): ReactElement | null {
  const { t } = useTranslation()
  const routed = alert.channels ?? []
  if (!routed || routed.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {routed.map((c) => (
        <span
          key={c}
          className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-300"
        >
          {t(`alertModal.escalation.channel_${c}`)}
        </span>
      ))}
    </div>
  )
}

/**
 * #487 — Compact escalation progress indicator: one dot per step, filled once
 * fired. Shown on any alert with an enabled escalation policy so the user can see
 * at a glance how far a breach has escalated.
 */
function EscalationProgress({ alert }: { alert: Alert }): ReactElement | null {
  const { t } = useTranslation()
  const policy = alert.escalationPolicy
  if (!policy?.enabled || policy.steps.length === 0) return null
  const firedCount = alert.escalationState?.firedStepIds.length ?? 0

  return (
    <div className="flex items-center gap-1.5 mt-1.5" title={t('alertPanel.escalation.progress', { fired: firedCount, total: policy.steps.length })}>
      <span className="text-[10px] text-gray-500">{t('alertPanel.escalation.label')}</span>
      <div className="flex items-center gap-1" role="img" aria-label={t('alertPanel.escalation.progress', { fired: firedCount, total: policy.steps.length })}>
        {policy.steps.map((step, index) => (
          <span
            key={step.id}
            className={`w-2 h-2 rounded-full ${index < firedCount ? 'bg-amber-400' : 'bg-gray-700'}`}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  )
}

/** #491 – Retest status marker reflecting the alert's current retest state phase. */
function RetestBadge({ alert }: { alert: Alert }): ReactElement | null {
  const { t } = useTranslation()
  const phase = alert.retestState?.phase
  if (!phase || phase === 'idle') return null
  const style =
    phase === 'inBreach'
      ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      : phase === 'exited'
        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
        : 'bg-gray-800 text-gray-300 border-gray-700'
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${style}`}>
      {phase === 'inBreach' ? t('alertPanel.retest.inBreach') : phase === 'exited' ? t('alertPanel.retest.exited') : t('alertPanel.retest.idle')}
    </span>
  )
}

/**
 * #493 — Health flag badge: warns when an alert's condition has never been
 * satisfiable against observed history, with a "Review" affordance that reveals
 * the reason + a percentile-grounded suggested value, and a dismiss action.
 * Purely informational — never fires a notification.
 */
function HealthFlagBadge({ flag, onDismiss }: { flag: AlertHealthFlag; onDismiss: () => void }): ReactElement {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30 transition-colors"
        aria-expanded={open}
      >
        ⚠ {t('alertPanel.health.badge')}
      </button>
      {open && (
        <div className="mt-1.5 p-2 rounded-lg bg-gray-800/80 border border-gray-700 text-[11px] text-gray-300 space-y-1">
          {flag.issues.map((issue) => (
            <div key={issue.conditionId}>
              <p>
                {issue.reason === 'thresholdNeverSatisfiable'
                  ? t('alertPanel.health.reasonNeverSatisfiable')
                  : t('alertPanel.health.reasonInsufficientHistory')}
              </p>
              {issue.suggestedValue !== null && (
                <p className="text-cyan-400">
                  {t('alertPanel.health.suggestion', {
                    value: issue.field === 'price' ? formatPrice(issue.suggestedValue) : `${issue.suggestedValue.toFixed(2)}%`,
                  })}
                </p>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={onDismiss}
            className="text-gray-500 hover:text-gray-300 underline"
          >
            {t('alertPanel.health.dismiss')}
          </button>
        </div>
      )}
    </div>
  )
}

const SNOOZE_DURATIONS: { value: AlertSnoozeDuration; labelKey: string }[] = [
  { value: '15min', labelKey: 'alertPanel.snooze.15min' },
  { value: '1hr', labelKey: 'alertPanel.snooze.1hr' },
  { value: '4hr', labelKey: 'alertPanel.snooze.4hr' },
  { value: '24hr', labelKey: 'alertPanel.snooze.24hr' },
  { value: 'tomorrow', labelKey: 'alertPanel.snooze.tomorrow' },
]

export function AlertPanel(): ReactElement | null {
  const { alerts, alertHistory, removeAlert, updateAlert, markAsRead, isPanelOpen, togglePanel, snoozeAlert, unsnoozeAlert, reEnableAlert } = useAlerts()
  const { t } = useTranslation()
  const [snoozeOpenId, setSnoozeOpenId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'alerts' | 'history'>('alerts')
  // #493 – never-firing misconfiguration flags for active alerts.
  const { flags: healthFlags, dismiss: dismissHealthFlag } = useAlertHealth(alerts)

  const handleExportAnalytics = useCallback(() => {
    const HEADERS = ['alertId', 'fireCount', 'avgTimeToFire', 'maxTimeToFire', 'hitRatePerDay', 'thresholdHint']
    const rows = alerts.map((a) => alertStatsToExportRow(computeAlertStats(a, alertHistory)))
    const csv = toCsv(rows, HEADERS)
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    downloadFile(csv, `alert-analytics_${ts}.csv`, 'text/csv')
  }, [alerts, alertHistory])

  if (!isPanelOpen) return null

  const now = Date.now()
  const snoozedAlerts = alerts.filter((a) => a.snoozedUntil !== null && a.snoozedUntil > now)
  const triggeredAlerts = alerts.filter((a) => a.lastTriggeredAt !== null && (a.snoozedUntil === null || a.snoozedUntil <= now))
  const activeAlerts = alerts.filter((a) => a.active && a.lastTriggeredAt === null && (a.snoozedUntil === null || a.snoozedUntil <= now))
  const firedOnceAlerts = alerts.filter((a) => !a.active && a.triggerOnce && a.lastTriggeredAt !== null)
  const inactiveAlerts = alerts.filter((a) => !a.active && a.lastTriggeredAt === null && (a.snoozedUntil === null || a.snoozedUntil <= now))

  const getConditionText = (alert: typeof alerts[0]): string => {
    if (alert.percentageMode) {
      const dir = alert.percentageDirection ?? 'either'
      const pct = alert.percentageThreshold ?? 0
      const win = alert.percentageWindow ?? '1hr'
      return t('alertPanel.conditions.percentage', {
        direction: t(`alertPanel.conditions.dir_${dir}`),
        pct,
        window: t(`alertModal.fields.window${win.charAt(0).toUpperCase() + win.slice(1)}`),
      })
    }
    const upper = alert.upperThreshold
    const lower = alert.lowerThreshold
    if (upper !== null && lower !== null)
      return t('alertPanel.conditions.between', { lower: formatPrice(lower), upper: formatPrice(upper) })
    if (upper !== null) return t('alertPanel.conditions.above', { upper: formatPrice(upper) })
    if (lower !== null) return t('alertPanel.conditions.below', { lower: formatPrice(lower) })
    return t('alertPanel.conditions.none')
  }

  const toggleAlert = (id: string, currentActive: boolean): void => {
    updateAlert(id, { active: !currentActive })
  }

  const formatSnoozeExpiry = (snoozedUntil: number): string => {
    const diff = snoozedUntil - now
    if (diff <= 0) return ''
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return t('alertPanel.snooze.expiresInMins', { mins })
    const hrs = Math.floor(mins / 60)
    return t('alertPanel.snooze.expiresInHrs', { hrs })
  }

  const handleSnooze = (id: string, duration: AlertSnoozeDuration): void => {
    snoozeAlert(id, duration)
    setSnoozeOpenId(null)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={togglePanel}
        aria-hidden="true"
      />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col overflow-hidden transform transition-transform">
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/80 backdrop-blur">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            {t('alertPanel.title')}
            {triggeredAlerts.length > 0 && (
              <span className="bg-cyan-500 text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full">
                {t('alertPanel.newBadge', { count: triggeredAlerts.length })}
              </span>
            )}
          </h2>
          <button
            onClick={togglePanel}
            className="text-gray-500 hover:text-gray-300 p-2 rounded-lg hover:bg-gray-800 transition-colors"
            aria-label={t('alertPanel.close')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Alerts / History tabs (#309) */}
        <div className="flex gap-1 p-2 border-b border-gray-800" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'alerts'}
            onClick={() => setActiveTab('alerts')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'alerts'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            {t('alertPanel.tabs.alerts')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'history'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            {t('alertPanel.tabs.history')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {activeTab === 'history' ? (
            <>
              {alerts.length > 0 && (
                <div className="flex justify-end mb-2">
                  <button
                    onClick={handleExportAnalytics}
                    className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 px-3 py-1.5 rounded-lg transition-colors"
                    title="Download alert effectiveness statistics as CSV"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export Analytics
                  </button>
                </div>
              )}
              <AlertHistoryLog />
            </>
          ) : alerts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p>{t('alertPanel.empty')}</p>
            </div>
          ) : (
            <>
              {/* ── Triggered alerts ─────────────────────────────────────── */}
              {triggeredAlerts.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    {t('alertPanel.sections.triggered')}
                  </h3>
                  <div className="space-y-3">
                    {triggeredAlerts.map((alert) => (
                      <div key={alert.id} className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500" />
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{alert.assetPair}</span>
                            {/* Alert type badge (#312) */}
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${alert.triggerOnce ? 'bg-amber-500/20 text-amber-300' : 'bg-green-500/20 text-green-300'}`}>
                              {alert.triggerOnce ? t('alertPanel.badge.oneTime') : t('alertPanel.badge.persistent')}
                            </span>
                            {/* Fire count (#312) */}
                            {alert.fireCount > 0 && (
                              <span className="text-[10px] text-gray-400">×{alert.fireCount}</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400">{t('alertPanel.triggered.justNow')}</span>
                        </div>
                        <p className="text-sm text-gray-300 mb-1">
                          {t('alertPanel.triggered.priceCrossed')}{' '}
                          <span className="font-mono">{getConditionText(alert)}</span>
                        </p>
                        <AlertAnalyticsStrip alertId={alert.id} stats={computeAlertStats(alert, alertHistory)} />
                        <RoutingBadge alert={alert} />
                        <div className="flex gap-2 flex-wrap mt-3">
                          <button
                            onClick={() => {
                              markAsRead(alert.id)
                              updateAlert(alert.id, { lastTriggeredAt: null })
                            }}
                            className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                          >
                            {t('alertPanel.triggered.markRead')}
                          </button>
                          {/* Snooze button (#313) */}
                          <div className="relative">
                            <button
                              onClick={() => setSnoozeOpenId(snoozeOpenId === alert.id ? null : alert.id)}
                              className="text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                              title={t('alertPanel.snooze.button')}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {t('alertPanel.snooze.button')}
                            </button>
                            {snoozeOpenId === alert.id && (
                              <div className="absolute bottom-full mb-1 left-0 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-10 overflow-hidden min-w-[140px]">
                                {SNOOZE_DURATIONS.map(({ value, labelKey }) => (
                                  <button
                                    key={value}
                                    onClick={() => handleSnooze(alert.id, value)}
                                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                                  >
                                    {t(labelKey)}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => removeAlert(alert.id)}
                            className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 transition-colors"
                          >
                            {t('alertPanel.triggered.delete')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Snoozed alerts (#313) ─────────────────────────────────── */}
              {snoozedAlerts.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    {t('alertPanel.sections.snoozed')}
                  </h3>
                  <div className="space-y-3">
                    {snoozedAlerts.map((alert) => (
                      <div key={alert.id} className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex items-center justify-between opacity-75">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-gray-300 text-sm">{alert.assetPair}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 flex items-center gap-1">
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {t('alertPanel.badge.snoozed')}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 font-mono">{getConditionText(alert)}</div>
                          {alert.snoozedUntil && (
                            <div className="text-xs text-purple-400 mt-0.5">{formatSnoozeExpiry(alert.snoozedUntil)}</div>
                          )}
                        </div>
                        <button
                          onClick={() => unsnoozeAlert(alert.id)}
                          className="p-1.5 text-gray-400 hover:text-purple-400 transition-colors"
                          title={t('alertPanel.snooze.unsnooze')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Active alerts ─────────────────────────────────────────── */}
              {activeAlerts.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    {t('alertPanel.sections.active')}
                  </h3>
                  <div className="space-y-3">
                    {activeAlerts.map((alert) => (
                      <div key={alert.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex items-center justify-between group hover:border-gray-600 transition-colors">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-white text-sm">{alert.assetPair}</span>
                            {/* Alert type badge (#312) */}
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${alert.triggerOnce ? 'bg-amber-500/20 text-amber-300' : 'bg-green-500/20 text-green-300'}`}>
                              {alert.triggerOnce ? t('alertPanel.badge.oneTime') : t('alertPanel.badge.persistent')}
                            </span>
                            {/* Percentage mode badge (#307) */}
                            {alert.percentageMode && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300">%</span>
                            )}
                            {/* Fire count (#312) */}
                            {alert.fireCount > 0 && (
                              <span className="text-[10px] text-gray-500">×{alert.fireCount}</span>
                            )}
                            {/* Retest state marker (#491) */}
                            <RetestBadge alert={alert} />
                          </div>
                          <div className="text-xs text-gray-400 font-mono">
                            {getConditionText(alert)}
                          </div>
                          <AlertAnalyticsStrip alertId={alert.id} stats={computeAlertStats(alert, alertHistory)} />
                          <EscalationProgress alert={alert} />
                          <RoutingBadge alert={alert} />
                          {healthFlags.find((f) => f.alertId === alert.id) && (
                            <HealthFlagBadge
                              flag={healthFlags.find((f) => f.alertId === alert.id)!}
                              onDismiss={() => dismissHealthFlag(alert.id)}
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => toggleAlert(alert.id, alert.active)}
                            className="p-1.5 text-gray-400 hover:text-cyan-400 transition-colors"
                            title={t('alertPanel.active.pause')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => removeAlert(alert.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                            title={t('alertPanel.active.delete')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Fired one-time alerts (#312) ──────────────────────────── */}
              {firedOnceAlerts.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    {t('alertPanel.sections.firedOnce')}
                  </h3>
                  <div className="space-y-3 opacity-70">
                    {firedOnceAlerts.map((alert) => (
                      <div key={alert.id} className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-amber-200 text-sm">{alert.assetPair}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                              {t('alertPanel.badge.fired')}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 font-mono">{getConditionText(alert)}</div>
                          {alert.lastTriggeredAt && (
                            <div className="text-xs text-amber-400/70 mt-0.5">
                              {t('alertPanel.fired.at', { time: new Date(alert.lastTriggeredAt).toLocaleString() })}
                            </div>
                          )}
                          <AlertAnalyticsStrip alertId={alert.id} stats={computeAlertStats(alert, alertHistory)} />
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Re-enable button (#312) */}
                          <button
                            onClick={() => reEnableAlert(alert.id)}
                            className="p-1.5 text-gray-400 hover:text-green-400 transition-colors"
                            title={t('alertPanel.fired.reEnable')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                          <button
                            onClick={() => removeAlert(alert.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                            title={t('alertPanel.inactive.delete')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Inactive alerts ───────────────────────────────────────── */}
              {inactiveAlerts.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    {t('alertPanel.sections.inactive')}
                  </h3>
                  <div className="space-y-3 opacity-60">
                    {inactiveAlerts.map((alert) => (
                      <div key={alert.id} className="bg-gray-800/30 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-gray-300 text-sm">{alert.assetPair}</span>
                            {alert.percentageMode && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300">%</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            {getConditionText(alert)}
                          </div>
                          <AlertAnalyticsStrip alertId={alert.id} stats={computeAlertStats(alert, alertHistory)} />
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleAlert(alert.id, alert.active)}
                            className="p-1.5 text-gray-400 hover:text-cyan-400 transition-colors"
                            title={t('alertPanel.inactive.resume')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => removeAlert(alert.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                            title={t('alertPanel.inactive.delete')}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
