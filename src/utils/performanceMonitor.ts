/**
 * performanceMonitor.ts
 *
 * Runtime performance monitoring utilities:
 * - FPS sampling via requestAnimationFrame
 * - Long task detection via PerformanceObserver (tasks >50 ms)
 * - Performance marks for key user interactions
 * - WebSocket message processing time tracking
 * - JS heap usage sampling with a high-usage warning (#322)
 *
 * All state is held in module-level variables so it survives across React
 * render cycles. Listeners receive a snapshot of the current metrics each
 * time any value changes.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface LongTask {
  startTime: number
  duration: number
  name: string
}

export interface PerformanceMark {
  name: string
  startTime: number
  /** Duration in ms from the most recent paired mark, or null for single marks */
  duration: number | null
}

export interface WsMessageTiming {
  /** Timestamp when the message was received */
  receivedAt: number
  /** Processing time in ms */
  processingMs: number
  /** Message type, if available */
  type?: string
}

export interface PerformanceSnapshot {
  /** Current frames per second (rolling 1-second average) */
  fps: number
  /** Whether the tab is currently considered "jank" (fps < 30) */
  isJanky: boolean
  /** Long tasks recorded in the last 60 s */
  longTasks: LongTask[]
  /** Total number of long tasks since monitoring started */
  totalLongTasks: number
  /** Custom performance marks */
  marks: PerformanceMark[]
  /** Recent WS message processing timings */
  wsTiming: WsMessageTiming[]
  /** Average WS message processing time in ms, or null if no samples */
  avgWsProcessingMs: number | null
  /** Used JS heap size in bytes, or null when `performance.memory` is unsupported */
  memoryUsedBytes: number | null
  /** `true` when `memoryUsedBytes` exceeds {@link MEMORY_WARNING_THRESHOLD_BYTES} */
  isMemoryWarning: boolean
}

type Listener = (snapshot: PerformanceSnapshot) => void

// ── Constants ────────────────────────────────────────────────────────────────

const LONG_TASK_THRESHOLD_MS = 50
const MAX_LONG_TASKS = 200
const LONG_TASK_WINDOW_MS = 60_000
const MAX_MARKS = 100
const MAX_WS_TIMINGS = 100

/** Warn when used JS heap size exceeds this (200 MB, per #322's acceptance criteria). */
export const MEMORY_WARNING_THRESHOLD_BYTES = 200 * 1024 * 1024
const MEMORY_SAMPLE_INTERVAL_MS = 2_000

/** Non-standard Chrome-only API for JS heap usage. Absent in Firefox/Safari. */
interface PerformanceMemory {
  usedJSHeapSize: number
}

// ── Module state ─────────────────────────────────────────────────────────────

let fps = 0
let rafHandle: number | null = null
let longTaskObserver: PerformanceObserver | null = null
let isRunning = false
let memoryIntervalHandle: ReturnType<typeof setInterval> | null = null
let memoryUsedBytes: number | null = null

const longTasks: LongTask[] = []
const marks: PerformanceMark[] = []
const wsTiming: WsMessageTiming[] = []
const listeners = new Set<Listener>()

// FPS ring buffer: stores the timestamp of the last N frames
const frameTimestamps: number[] = []
let totalLongTasks = 0

// ── Snapshot ─────────────────────────────────────────────────────────────────

function snapshot(): PerformanceSnapshot {
  const now = Date.now()
  const recentLongTasks = longTasks.filter((t) => now - t.startTime < LONG_TASK_WINDOW_MS)

  const avgWs =
    wsTiming.length > 0
      ? wsTiming.reduce((s, t) => s + t.processingMs, 0) / wsTiming.length
      : null

  return {
    fps,
    isJanky: fps < 30 && fps > 0,
    longTasks: [...recentLongTasks],
    totalLongTasks,
    marks: [...marks],
    wsTiming: [...wsTiming],
    avgWsProcessingMs: avgWs,
    memoryUsedBytes,
    isMemoryWarning: memoryUsedBytes !== null && memoryUsedBytes > MEMORY_WARNING_THRESHOLD_BYTES,
  }
}

function notify() {
  const s = snapshot()
  listeners.forEach((l) => l(s))
}

// ── FPS tracking ─────────────────────────────────────────────────────────────

function rafTick(now: number) {
  frameTimestamps.push(now)

  // Keep only frames within the last second
  while (frameTimestamps.length > 0 && now - frameTimestamps[0] > 1000) {
    frameTimestamps.shift()
  }

  if (frameTimestamps.length >= 2) {
    const elapsed = now - frameTimestamps[0]
    const newFps = Math.round(((frameTimestamps.length - 1) / elapsed) * 1000)
    if (newFps !== fps) {
      fps = newFps
      notify()
    }
  }

  if (isRunning) {
    rafHandle = requestAnimationFrame(rafTick)
  }
}

// ── Long task detection ───────────────────────────────────────────────────────

function startLongTaskObserver(): void {
  if (typeof PerformanceObserver === 'undefined') return
  try {
    longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration >= LONG_TASK_THRESHOLD_MS) {
          if (longTasks.length >= MAX_LONG_TASKS) longTasks.shift()
          longTasks.push({
            startTime: entry.startTime,
            duration: entry.duration,
            name: entry.name,
          })
          totalLongTasks++
          notify()
        }
      }
    })
    longTaskObserver.observe({ entryTypes: ['longtask'] })
  } catch {
    // Browser may not support longtask — silently skip
  }
}

// ── Memory sampling ──────────────────────────────────────────────────────────

function sampleMemory(): void {
  const mem = (performance as Performance & { memory?: PerformanceMemory }).memory
  if (!mem) return
  memoryUsedBytes = mem.usedJSHeapSize
  notify()
}

function startMemorySampler(): void {
  if (memoryIntervalHandle !== null) return
  sampleMemory()
  memoryIntervalHandle = setInterval(sampleMemory, MEMORY_SAMPLE_INTERVAL_MS)
}

function stopMemorySampler(): void {
  if (memoryIntervalHandle !== null) {
    clearInterval(memoryIntervalHandle)
    memoryIntervalHandle = null
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Starts the FPS sampler and long task observer.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function startPerformanceMonitor(): void {
  if (isRunning) return
  isRunning = true
  rafHandle = requestAnimationFrame(rafTick)
  startLongTaskObserver()
  startMemorySampler()
}

/**
 * Stops the FPS sampler, disconnects the long task observer, and stops memory sampling.
 */
export function stopPerformanceMonitor(): void {
  isRunning = false
  if (rafHandle !== null) {
    cancelAnimationFrame(rafHandle)
    rafHandle = null
  }
  if (longTaskObserver) {
    longTaskObserver.disconnect()
    longTaskObserver = null
  }
  stopMemorySampler()
}

/**
 * Records a named performance mark. If a previous mark with `pairedWith`
 * exists, also records the elapsed duration between them.
 *
 * Usage:
 *   recordPerfMark('dashboard:render:start')
 *   // … work …
 *   recordPerfMark('dashboard:render:end', 'dashboard:render:start')
 */
export function recordPerfMark(name: string, pairedWith?: string): void {
  // Also emit a native browser performance mark for DevTools timeline
  try {
    performance.mark(name)
    if (pairedWith) {
      const measureName = `${pairedWith} → ${name}`
      try {
        performance.measure(measureName, pairedWith, name)
      } catch {
        // mark may not exist yet
      }
    }
  } catch {
    // ignore — not supported in all environments
  }

  let duration: number | null = null
  if (pairedWith) {
    // Find the most recent paired mark (avoid Array.findLast for lib compat)
    let paired: PerformanceMark | undefined
    for (let i = marks.length - 1; i >= 0; i--) {
      if (marks[i].name === pairedWith) {
        paired = marks[i]
        break
      }
    }
    if (paired) duration = performance.now() - paired.startTime
  }

  if (marks.length >= MAX_MARKS) marks.shift()
  marks.push({ name, startTime: performance.now(), duration })
  notify()
}

/**
 * Records the processing time for a single WebSocket message.
 * Call with the timestamp captured *before* processing begins and the type
 * string from the parsed message.
 */
export function recordWsMessageTiming(startMs: number, type?: string): void {
  const processingMs = performance.now() - startMs
  if (wsTiming.length >= MAX_WS_TIMINGS) wsTiming.shift()
  wsTiming.push({ receivedAt: Date.now(), processingMs, type })
  notify()
}

/**
 * Subscribes to performance snapshot updates.
 * Returns an unsubscribe function.
 */
export function subscribePerformance(listener: Listener): () => void {
  listeners.add(listener)
  listener(snapshot()) // fire immediately with current state
  return () => listeners.delete(listener)
}

/**
 * Returns the current performance snapshot without subscribing.
 */
export function getPerformanceSnapshot(): PerformanceSnapshot {
  return snapshot()
}

/**
 * Clears all accumulated data. Useful for tests.
 */
export function resetPerformanceMonitor(): void {
  longTasks.length = 0
  marks.length = 0
  wsTiming.length = 0
  frameTimestamps.length = 0
  fps = 0
  totalLongTasks = 0
  memoryUsedBytes = null
  notify()
}
