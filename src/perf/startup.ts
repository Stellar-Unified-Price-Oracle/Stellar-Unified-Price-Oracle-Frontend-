/**
 * Staged startup instrumentation.
 *
 * The dashboard boots in stages so the shell can paint before optional
 * subsystems (live socket, analytics, settings, alert modal) are allowed to
 * compete for the main thread and the network. Every stage is measured from
 * `markBoot()` and checked against a budget so regressions are visible both at
 * runtime (dev warnings) and in the report consumed by tests/tooling.
 */

export type StartupStage = 'shell' | 'first-price' | 'live' | 'idle'

export interface StageBudget {
  /** Milliseconds from boot that this stage is expected to complete within. */
  budgetMs: number
  description: string
}

/**
 * Budgets are calibrated for a mid-range device on a cold cache. They are the
 * contract for the startup path: the shell must not wait on live data, the
 * first price must not wait on the socket, and optional work must not run
 * until the browser is idle.
 */
export const STARTUP_BUDGETS: Record<StartupStage, StageBudget> = {
  shell: { budgetMs: 1500, description: 'Nav + skeleton grid painted' },
  'first-price': { budgetMs: 3000, description: 'First prices rendered from REST' },
  live: { budgetMs: 5000, description: 'WebSocket connected' },
  idle: { budgetMs: 8000, description: 'Deferred (idle) work dispatched' },
}

export const STARTUP_STAGES = Object.keys(STARTUP_BUDGETS) as StartupStage[]

export interface StageRecord {
  stage: StartupStage
  /** Milliseconds from boot when the stage completed. */
  at: number
  budgetMs: number
  overBudget: boolean
}

export interface StartupReport {
  /** True once `markBoot()` has run. */
  booted: boolean
  stages: StageRecord[]
  overBudget: StartupStage[]
  /** Wall-clock milliseconds since boot, or 0 before boot. */
  elapsedMs: number
}

type ReportListener = (report: StartupReport) => void

let bootAt: number | null = null
const records = new Map<StartupStage, StageRecord>()
const listeners = new Set<ReportListener>()

function now(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

function emitPerformanceMarks(stage: StartupStage): void {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') return
  try {
    performance.mark(`startup:${stage}`)
    if (typeof performance.measure === 'function') {
      performance.measure(`startup:${stage}`, 'startup:boot', `startup:${stage}`)
    }
  } catch {
    // performance entries are best-effort; never let instrumentation throw
  }
}

/** Start the startup clock. Safe to call more than once; the first call wins. */
export function markBoot(): void {
  if (bootAt !== null) return
  bootAt = now()
  records.clear()
  if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
    try {
      performance.mark('startup:boot')
    } catch {
      // ignore
    }
  }
}

function bootTime(): number {
  if (bootAt === null) markBoot()
  return bootAt as number
}

/**
 * Record a stage completion. The earliest mark for a stage wins, so StrictMode
 * double-invocation and WebSocket reconnects cannot overwrite the real number.
 * Returns the record for the stage (existing or newly created).
 */
export function markStage(stage: StartupStage, detail?: Record<string, unknown>): StageRecord {
  const existing = records.get(stage)
  if (existing) return existing

  const at = Math.round(now() - bootTime())
  const { budgetMs } = STARTUP_BUDGETS[stage]
  const record: StageRecord = {
    stage,
    at,
    budgetMs,
    overBudget: at > budgetMs,
  }

  records.set(stage, record)
  emitPerformanceMarks(stage)

  if (record.overBudget && import.meta.env.DEV) {
    console.warn(
      `[startup] stage "${stage}" took ${at}ms, budget ${budgetMs}ms`,
      detail ?? '',
    )
  }

  const report = getStartupReport()
  listeners.forEach((listener) => listener(report))
  return record
}

export function getStartupReport(): StartupReport {
  const stages = STARTUP_STAGES.map((stage) => records.get(stage)).filter(
    (record): record is StageRecord => record !== undefined,
  )
  return {
    booted: bootAt !== null,
    stages,
    overBudget: stages.filter((record) => record.overBudget).map((record) => record.stage),
    elapsedMs: bootAt === null ? 0 : Math.round(now() - bootAt),
  }
}

/** Subscribe to stage completions. Returns an unsubscribe function. */
export function onStartupStage(listener: ReportListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Clear all recorded stages and subscribers. Intended for tests and HMR. */
export function resetStartup(): void {
  bootAt = null
  records.clear()
  listeners.clear()
}

/**
 * Run `callback` on the next idle period. Falls back to a macrotask when the
 * browser (or jsdom) has no `requestIdleCallback`.
 */
export function runWhenIdle(callback: () => void, timeout = 2000): void {
  if (typeof window === 'undefined') {
    callback()
    return
  }

  const requestIdle = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
    }
  ).requestIdleCallback

  if (typeof requestIdle === 'function') {
    requestIdle(callback, { timeout })
  } else {
    window.setTimeout(callback, 1)
  }
}

/**
 * Run `callback` after the browser has painted the current frame (two rAFs, so
 * the first paint has landed). Falls back to a macrotask when rAF is missing.
 */
export function afterFirstPaint(callback: () => void): void {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    if (typeof window === 'undefined') {
      callback()
    } else {
      window.setTimeout(callback, 1)
    }
    return
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(callback)
  })
}
