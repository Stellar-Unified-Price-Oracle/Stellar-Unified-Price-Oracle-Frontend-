/**
 * PerformanceOverlay
 *
 * A floating DevTools overlay that displays live performance metrics:
 * - Current FPS with colour-coded health indicator
 * - Total long tasks (>50 ms) in the last 60 s
 * - Average WebSocket message processing time
 * - Recent render counts (top 5 most-rendered components)
 *
 * Only rendered in development mode (import.meta.env.DEV).
 * Toggle visibility with Alt+Shift+P, or via the button in the corner.
 *
 * Opt-out: set localStorage key `perf_overlay_hidden=1` to start hidden.
 */

import { memo, useState, useEffect, useCallback } from 'react'
import { subscribePerformance, type PerformanceSnapshot } from '../utils/performanceMonitor'
import { subscribeRenderInfo, getRenderCounts, type RenderInfo } from '../hooks/useRenderTracker'

function fpsColour(fps: number): string {
  if (fps === 0) return 'text-slate-400'
  if (fps >= 55) return 'text-emerald-400'
  if (fps >= 30) return 'text-amber-400'
  return 'text-red-400'
}

function msColour(ms: number): string {
  if (ms < 5) return 'text-emerald-400'
  if (ms < 16) return 'text-amber-400'
  return 'text-red-400'
}

interface RenderRow {
  name: string
  count: number
}

const HIDDEN_STORAGE_KEY = 'perf_overlay_hidden'

export const PerformanceOverlay = memo(function PerformanceOverlay() {
  // All hooks are called unconditionally (Rules of Hooks); the DEV guard below
  // only controls rendering, while each effect self-guards its subscriptions.
  const [visible, setVisible] = useState(
    () => localStorage.getItem(HIDDEN_STORAGE_KEY) !== '1',
  )
  const [perf, setPerf] = useState<PerformanceSnapshot | null>(null)
  const [renderRows, setRenderRows] = useState<RenderRow[]>([])

  const toggleVisible = useCallback(() => {
    setVisible((v) => {
      const next = !v
      localStorage.setItem(HIDDEN_STORAGE_KEY, next ? '0' : '1')
      return next
    })
  }, [])

  // Subscribe to performance snapshots
  useEffect(() => {
    if (!import.meta.env.DEV) return
    return subscribePerformance((s) => setPerf(s))
  }, [])

  // Subscribe to render tracker — update top render counts
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const update = (_info: RenderInfo) => {
      const counts = getRenderCounts()
      const rows = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))
      setRenderRows(rows)
    }
    return subscribeRenderInfo(update)
  }, [])

  // Keyboard shortcut: Alt+Shift+P
  useEffect(() => {
    if (!import.meta.env.DEV) return
    function onKey(e: KeyboardEvent) {
      if (e.altKey && e.shiftKey && e.key === 'P') {
        toggleVisible()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleVisible])

  // Only mount in dev
  if (!import.meta.env.DEV) return null

  if (!visible) {
    return (
      <button
        onClick={toggleVisible}
        title="Show performance overlay (Alt+Shift+P)"
        className="fixed bottom-4 left-4 z-[9999] rounded border border-slate-600 bg-slate-900/90 px-2 py-1 font-mono text-xs text-slate-400 hover:text-slate-100"
        aria-label="Show performance overlay"
      >
        ⚡ perf
      </button>
    )
  }

  const fps = perf?.fps ?? 0
  const longTasks = perf?.longTasks.length ?? 0
  const avgWs = perf?.avgWsProcessingMs ?? null
  const memoryMb = perf?.memoryUsedBytes !== undefined && perf?.memoryUsedBytes !== null
    ? Math.round(perf.memoryUsedBytes / (1024 * 1024))
    : null

  return (
    <aside
      role="complementary"
      aria-label="Performance overlay"
      className="fixed bottom-4 left-4 z-[9999] min-w-48 rounded-lg border border-slate-700 bg-slate-900/95 p-3 font-mono text-xs shadow-2xl backdrop-blur"
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-4">
        <span className="font-semibold text-slate-300">⚡ Performance</span>
        <button
          onClick={toggleVisible}
          title="Hide overlay (Alt+Shift+P)"
          className="text-slate-500 hover:text-slate-200"
          aria-label="Hide performance overlay"
        >
          ✕
        </button>
      </div>

      {/* FPS */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-700 pb-2">
        <span className="text-slate-400">FPS</span>
        <span className={`font-bold ${fpsColour(fps)}`}>
          {fps > 0 ? fps : '—'}
          {perf?.isJanky && <span className="ml-1 text-red-400">⚠ jank</span>}
        </span>
      </div>

      {/* Long tasks */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-700 py-2">
        <span className="text-slate-400">Long tasks (60s)</span>
        <span className={longTasks > 0 ? 'font-bold text-amber-400' : 'text-slate-400'}>
          {longTasks}
        </span>
      </div>

      {/* WebSocket timing */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-700 py-2">
        <span className="text-slate-400">WS avg</span>
        {avgWs !== null ? (
          <span className={`font-bold ${msColour(avgWs)}`}>{avgWs.toFixed(2)} ms</span>
        ) : (
          <span className="text-slate-500">no data</span>
        )}
      </div>

      {/* Memory usage (#322) */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-700 py-2">
        <span className="text-slate-400">JS heap</span>
        {memoryMb !== null ? (
          <span className={perf?.isMemoryWarning ? 'font-bold text-red-400' : 'font-bold text-emerald-400'}>
            {memoryMb} MB
            {perf?.isMemoryWarning && <span className="ml-1">⚠</span>}
          </span>
        ) : (
          <span className="text-slate-500">unsupported</span>
        )}
      </div>

      {/* Top render counts */}
      {renderRows.length > 0 && (
        <div className="mt-2">
          <div className="mb-1 text-slate-500">Top renders</div>
          {renderRows.map((r) => (
            <div key={r.name} className="flex items-center justify-between gap-2 py-0.5">
              <span className="max-w-32 truncate text-slate-400" title={r.name}>
                {r.name}
              </span>
              <span className={r.count > 50 ? 'text-amber-400' : 'text-slate-300'}>
                {r.count}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 text-slate-600">Alt+Shift+P to toggle</div>
    </aside>
  )
})
