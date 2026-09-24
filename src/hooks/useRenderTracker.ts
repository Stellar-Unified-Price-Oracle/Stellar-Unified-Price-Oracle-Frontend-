/**
 * useRenderTracker
 *
 * Instruments React component render counts and tracks *which* props or state
 * values changed between renders. This is a development-only tool — in
 * production it is a no-op that adds zero overhead.
 *
 * Usage:
 *   function MyComponent(props: Props) {
 *     useRenderTracker('MyComponent', props)
 *     …
 *   }
 *
 * Or with explicit tracked values:
 *   useRenderTracker('MyComponent', { prices, filter, sort })
 *
 * Render data is pushed to the performanceMonitor as performance marks and
 * logged to the console in DEV mode so it appears in DevTools.
 */

import { useRef, useEffect } from 'react'
import { recordPerfMark } from '../utils/performanceMonitor'

export interface RenderInfo {
  componentName: string
  renderCount: number
  changedKeys: string[]
  timestamp: number
}

// Registry of component render counts — survives remounts within a session
const renderCounts = new Map<string, number>()

// Listeners so external observers (e.g. PerformanceOverlay) can react
type RenderListener = (info: RenderInfo) => void
const renderListeners = new Set<RenderListener>()

export function subscribeRenderInfo(listener: RenderListener): () => void {
  renderListeners.add(listener)
  return () => renderListeners.delete(listener)
}

export function getRenderCounts(): Map<string, number> {
  return new Map(renderCounts)
}

function detectChanges(
  prev: Record<string, unknown> | null,
  current: Record<string, unknown>,
): string[] {
  if (!prev) return Object.keys(current)
  return Object.keys(current).filter((k) => !Object.is(prev[k], current[k]))
}

/**
 * Tracks renders for a component. Pass the component name and any props or
 * state values you want to observe for changes. No-ops in production.
 */
export function useRenderTracker(
  componentName: string,
  trackedValues?: Record<string, unknown>,
): void {
  if (import.meta.env.PROD) return

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const prevValuesRef = useRef<Record<string, unknown> | null>(null)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const countRef = useRef(0)

  countRef.current += 1
  renderCounts.set(componentName, countRef.current)

  const changedKeys = trackedValues
    ? detectChanges(prevValuesRef.current, trackedValues)
    : []

  prevValuesRef.current = trackedValues ? { ...trackedValues } : null

  const info: RenderInfo = {
    componentName,
    renderCount: countRef.current,
    changedKeys,
    timestamp: performance.now(),
  }

  // Push to perf marks for DevTools timeline visibility
  recordPerfMark(`render:${componentName}:${countRef.current}`)

  // Notify listeners
  renderListeners.forEach((l) => l(info))

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (import.meta.env.DEV && changedKeys.length > 0) {
      console.debug(
        `[RenderTracker] %c${componentName}%c render #${countRef.current}`,
        'color: #7dd3fc; font-weight: bold',
        'color: inherit',
        changedKeys.length > 0
          ? { changedKeys, values: changedKeys.reduce<Record<string, unknown>>((acc, k) => {
              if (trackedValues) acc[k] = trackedValues[k]
              return acc
            }, {}) }
          : '(initial mount)',
      )
    }
  })
}
