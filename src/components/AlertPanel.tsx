import { useAlerts } from '../hooks/useAlerts'
import { formatPrice } from '../utils/format'

export function AlertPanel() {
  const { alerts, removeAlert, updateAlert, markAsRead, isPanelOpen, togglePanel } = useAlerts()

  if (!isPanelOpen) return null

  const activeAlerts = alerts.filter((a) => a.active && a.lastTriggeredAt === null)
  const triggeredAlerts = alerts.filter((a) => a.lastTriggeredAt !== null)
  const inactiveAlerts = alerts.filter((a) => !a.active && a.lastTriggeredAt === null)

  const getConditionText = (upper: number | null, lower: number | null) => {
    if (upper !== null && lower !== null) return `Between $${formatPrice(lower)} and $${formatPrice(upper)}`
    if (upper !== null) return `↑ Above $${formatPrice(upper)}`
    if (lower !== null) return `↓ Below $${formatPrice(lower)}`
    return 'No threshold'
  }

  const toggleAlert = (id: string, currentActive: boolean) => {
    updateAlert(id, { active: !currentActive })
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
            Price Alerts
            {triggeredAlerts.length > 0 && (
              <span className="bg-cyan-500 text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full">
                {triggeredAlerts.length} New
              </span>
            )}
          </h2>
          <button onClick={togglePanel} className="text-gray-500 hover:text-gray-300 p-2 rounded-lg hover:bg-gray-800 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {alerts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p>No alerts set yet</p>
            </div>
          ) : (
            <>
              {triggeredAlerts.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Triggered</h3>
                  <div className="space-y-3">
                    {triggeredAlerts.map(alert => (
                      <div key={alert.id} className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500" />
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-white">{alert.assetPair}</span>
                          <span className="text-xs text-gray-400">Just now</span>
                        </div>
                        <p className="text-sm text-gray-300 mb-3">
                          Price crossed <span className="font-mono">{getConditionText(alert.upperThreshold, alert.lowerThreshold)}</span>
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              markAsRead(alert.id)
                              updateAlert(alert.id, { lastTriggeredAt: null })
                            }}
                            className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Mark Read
                          </button>
                          <button
                            onClick={() => removeAlert(alert.id)}
                            className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeAlerts.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Active Alerts</h3>
                  <div className="space-y-3">
                    {activeAlerts.map(alert => (
                      <div key={alert.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex items-center justify-between group hover:border-gray-600 transition-colors">
                        <div>
                          <div className="font-semibold text-white text-sm mb-0.5">{alert.assetPair}</div>
                          <div className="text-xs text-gray-400 font-mono">
                            {getConditionText(alert.upperThreshold, alert.lowerThreshold)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => toggleAlert(alert.id, alert.active)}
                            className="p-1.5 text-gray-400 hover:text-cyan-400 transition-colors"
                            title="Pause alert"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => removeAlert(alert.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete alert"
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

              {inactiveAlerts.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Inactive</h3>
                  <div className="space-y-3 opacity-60">
                    {inactiveAlerts.map(alert => (
                      <div key={alert.id} className="bg-gray-800/30 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-gray-300 text-sm mb-0.5">{alert.assetPair}</div>
                          <div className="text-xs text-gray-500 font-mono">
                            {getConditionText(alert.upperThreshold, alert.lowerThreshold)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleAlert(alert.id, alert.active)}
                            className="p-1.5 text-gray-400 hover:text-cyan-400 transition-colors"
                            title="Resume alert"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => removeAlert(alert.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete alert"
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
