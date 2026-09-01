/**
 * @file useHmrMonitor.ts
 * 
 * Development-only hook to monitor and log HMR activity.
 * Helps debug slow HMR, full reloads, and connection issues.
 * 
 * Usage:
 * ```tsx
 * // In your root App component
 * if (import.meta.env.DEV) {
 *   useHmrMonitor()
 * }
 * ```
 */

import { useEffect, useRef } from 'react'

interface HmrEvent {
  type: 'connect' | 'update' | 'error' | 'full-reload' | 'disconnect'
  timestamp: number
  message?: string
  duration?: number
}

const events: HmrEvent[] = []
const maxEvents = 100  // Keep last 100 events

function logHmrEvent(
  type: HmrEvent['type'],
  message?: string,
  duration?: number,
): void {
  const event: HmrEvent = {
    type,
    timestamp: Date.now(),
    message,
    duration,
  }

  events.push(event)
  if (events.length > maxEvents) {
    events.shift()
  }

  // Format log message
  const icon = {
    connect: '✓',
    update: '⚡',
    error: '✗',
    'full-reload': '🔄',
    disconnect: '⚠',
  }[type]

  const emoji = icon
  const timeStr = duration ? `${duration}ms` : ''
  const msg = message ? ` (${message})` : ''

  if (type === 'error') {
    console.error(`[HMR] ${emoji} Error${msg} ${timeStr}`)
  } else if (type === 'update' && duration && duration > 1000) {
    console.warn(`[HMR] ${emoji} Slow update${msg} ${timeStr}`)
  } else {
    console.log(`[HMR] ${emoji} ${type}${msg} ${timeStr}`)
  }
}

/**
 * Monitor HMR activity for performance and debugging.
 * 
 * Logs to console and stores events in window.__hmrEvents for inspection.
 * 
 * In console, view all events:
 * ```
 * window.__hmrEvents
 * ```
 */
export function useHmrMonitor(): void {
  const updateStartRef = useRef<number | null>(null)

  useEffect(() => {
    if (!import.meta.hot || !import.meta.env.DEV) {
      return
    }

    // Expose events for inspection
    if (typeof window !== 'undefined') {
      ;(window as Record<string, unknown>).__hmrEvents = events
      ;(window as Record<string, unknown>).__hmrClear = () => {
        events.length = 0
        console.log('[HMR] Events cleared')
      }
    }

    // Track HMR connection
    const _handleConnect = () => {
      logHmrEvent('connect', 'WebSocket connected')
    }

    const _handleDisconnect = () => {
      logHmrEvent('disconnect', 'WebSocket disconnected')
    }

    const handleBeforeUpdate = () => {
      updateStartRef.current = Date.now()
    }

    const handleUpdate = (payload: { event: string; updates?: Array<{ event: string; desc: string }> }) => {
      const duration = updateStartRef.current ? Date.now() - updateStartRef.current : 0
      updateStartRef.current = null

      const descriptions = payload.updates?.map(u => u.desc).join(', ') || 'unknown'
      logHmrEvent('update', descriptions, duration)
    }

    const handleError = (payload: { event: string; err?: Error }) => {
      logHmrEvent('error', payload.err?.message || 'unknown error')
    }

    const handleFullReload = (payload: { event: string; reason?: string }) => {
      logHmrEvent('full-reload', payload.reason || 'forced full reload')
    }

    // Register listeners
    import.meta.hot.on('vite:beforeUpdate', handleBeforeUpdate)
    import.meta.hot.on('vite:beforeFullReload', handleBeforeUpdate)
    import.meta.hot.on('vite:afterUpdate', handleUpdate)
    import.meta.hot.on('vite:error', handleError)
    import.meta.hot.on('full-reload', handleFullReload)

    // Log initial connection
    logHmrEvent('connect', 'HMR monitor initialized')

    // Cleanup
    return () => {
      import.meta.hot?.off('vite:beforeUpdate', handleBeforeUpdate)
      import.meta.hot?.off('vite:beforeFullReload', handleBeforeUpdate)
      import.meta.hot?.off('vite:afterUpdate', handleUpdate)
      import.meta.hot?.off('vite:error', handleError)
      import.meta.hot?.off('full-reload', handleFullReload)
    }
  }, [])
}

/**
 * Returns all logged HMR events (for inspection or export).
 */
export function getHmrEvents(): HmrEvent[] {
  return [...events]
}

/**
 * Exports HMR events as JSON for analysis.
 */
export function exportHmrEvents(): void {
  const json = JSON.stringify(events, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hmr-events-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Analyze HMR performance.
 */
export function analyzeHmrPerformance(): {
  totalUpdates: number
  avgUpdateTime: number
  slowestUpdate: HmrEvent
  errorCount: number
  fullReloadCount: number
} {
  const updates = events.filter(e => e.type === 'update')
  const errors = events.filter(e => e.type === 'error')
  const reloads = events.filter(e => e.type === 'full-reload')

  const avgUpdateTime =
    updates.length > 0
      ? updates.reduce((sum, e) => sum + (e.duration || 0), 0) / updates.length
      : 0

  const slowestUpdate =
    updates.length > 0
      ? updates.reduce((slowest, e) => (e.duration || 0) > (slowest.duration || 0) ? e : slowest)
      : ({} as HmrEvent)

  return {
    totalUpdates: updates.length,
    avgUpdateTime: Math.round(avgUpdateTime),
    slowestUpdate,
    errorCount: errors.length,
    fullReloadCount: reloads.length,
  }
}

/**
 * Console command to print HMR stats.
 * 
 * Usage in browser console:
 * ```
 * window.__hmrStats()
 * ```
 */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as Record<string, unknown>).__hmrStats = () => {
    const stats = analyzeHmrPerformance()
    console.table(stats)
    console.log('Full events:', events)
  }
}
