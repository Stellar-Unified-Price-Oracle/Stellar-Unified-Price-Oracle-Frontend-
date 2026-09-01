/**
 * memoryProfiler.ts (#504)
 *
 * Long-session memory profiling harness. `performanceMonitor.ts` samples a
 * single current heap value; this module keeps a rolling *history* of
 * samples — JS heap, DOM node count, and per-subsystem sizes — so sustained
 * growth (leaks) across hours-long monitoring sessions can be observed and
 * asserted on, not just point-in-time usage.
 *
 * Subsystems (price store, alert history, chart buffers, …) contribute their
 * current size via `registerMemoryProbe` rather than this module reaching
 * into their internals. Multiple probes registered under the same subsystem
 * name are summed (e.g. several mounted chart components).
 */

export interface MemorySample {
  timestamp: number
  /** Used JS heap size in bytes, or null when `performance.memory` is unsupported. */
  heapUsedBytes: number | null
  /** Total DOM element count, or null outside a DOM environment. */
  domNodeCount: number | null
  /** Per-subsystem size at this sample, keyed by subsystem name. */
  subsystems: Record<string, number>
}

export interface MemoryGrowth {
  /** Time covered by the current sample window, in ms. */
  windowMs: number
  heapBytesPerHour: number | null
  domNodesPerHour: number | null
  subsystemsPerHour: Record<string, number>
}

export interface MemoryProfilerSnapshot {
  samples: MemorySample[]
  latest: MemorySample | null
  growth: MemoryGrowth | null
}

type Listener = (snapshot: MemoryProfilerSnapshot) => void
type ProbeFn = () => number

/** Non-standard Chrome-only API for JS heap usage. Absent in Firefox/Safari. */
interface PerformanceMemory {
  usedJSHeapSize: number
}

const SAMPLE_INTERVAL_MS = 30_000
/** ~4 hours of history at the default sample interval. */
const MAX_SAMPLES = 480

const samples: MemorySample[] = []
const probes = new Map<string, { subsystem: string; fn: ProbeFn }>()
const listeners = new Set<Listener>()

let intervalHandle: ReturnType<typeof setInterval> | null = null
let probeCounter = 0

function readHeapUsedBytes(): number | null {
  const mem = (performance as Performance & { memory?: PerformanceMemory }).memory
  return mem ? mem.usedJSHeapSize : null
}

function readDomNodeCount(): number | null {
  if (typeof document === 'undefined') return null
  return document.getElementsByTagName('*').length
}

function readSubsystemTotals(): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const { subsystem, fn } of probes.values()) {
    try {
      totals[subsystem] = (totals[subsystem] ?? 0) + fn()
    } catch {
      // A probe throwing (e.g. its store not ready yet) must not break sampling.
    }
  }
  return totals
}

/**
 * Computes first-vs-last growth rates across a sample window. Exported so a
 * CI test can assert bounded growth after simulating hours of WS updates
 * (feed it synthetic samples, or the real ones after fast-forwarding timers).
 */
export function computeGrowth(sampleList: MemorySample[]): MemoryGrowth | null {
  if (sampleList.length < 2) return null
  const first = sampleList[0]
  const last = sampleList[sampleList.length - 1]
  const windowMs = last.timestamp - first.timestamp
  if (windowMs <= 0) return null

  const hours = windowMs / (60 * 60 * 1000)
  const perHour = (a: number | null, b: number | null): number | null =>
    a === null || b === null ? null : (b - a) / hours

  const subsystemsPerHour: Record<string, number> = {}
  const keys = new Set([...Object.keys(first.subsystems), ...Object.keys(last.subsystems)])
  for (const key of keys) {
    subsystemsPerHour[key] = ((last.subsystems[key] ?? 0) - (first.subsystems[key] ?? 0)) / hours
  }

  return {
    windowMs,
    heapBytesPerHour: perHour(first.heapUsedBytes, last.heapUsedBytes),
    domNodesPerHour: perHour(first.domNodeCount, last.domNodeCount),
    subsystemsPerHour,
  }
}

function snapshot(): MemoryProfilerSnapshot {
  return {
    samples: [...samples],
    latest: samples[samples.length - 1] ?? null,
    growth: computeGrowth(samples),
  }
}

function notify(): void {
  const s = snapshot()
  listeners.forEach((l) => l(s))
}

function sample(): void {
  if (samples.length >= MAX_SAMPLES) samples.shift()
  samples.push({
    timestamp: Date.now(),
    heapUsedBytes: readHeapUsedBytes(),
    domNodeCount: readDomNodeCount(),
    subsystems: readSubsystemTotals(),
  })
  notify()
}

/**
 * Registers a subsystem size probe (e.g. price store entry count, alert
 * history length, chart buffer point count). Returns an unregister function
 * — call it on unmount for probes scoped to a component instance.
 */
export function registerMemoryProbe(subsystem: string, fn: ProbeFn): () => void {
  const id = `${subsystem}:${probeCounter++}`
  probes.set(id, { subsystem, fn })
  return () => probes.delete(id)
}

/**
 * Starts periodic sampling. Safe to call multiple times — a no-op once
 * already running. Works in both dev and CI/test environments (jsdom
 * provides `document`; `performance.memory` degrades to null where unsupported).
 */
export function startMemoryProfiler(intervalMs = SAMPLE_INTERVAL_MS): void {
  if (intervalHandle !== null) return
  sample()
  intervalHandle = setInterval(sample, intervalMs)
}

export function stopMemoryProfiler(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
}

/** Takes a sample immediately, outside the regular interval. Useful for tests. */
export function sampleMemoryNow(): MemorySample {
  sample()
  return samples[samples.length - 1]
}

/** Subscribes to memory profiler snapshots. Returns an unsubscribe function. */
export function subscribeMemoryProfiler(listener: Listener): () => void {
  listeners.add(listener)
  listener(snapshot())
  return () => listeners.delete(listener)
}

export function getMemoryProfilerSnapshot(): MemoryProfilerSnapshot {
  return snapshot()
}

/** Clears all accumulated samples. Useful for tests. */
export function resetMemoryProfiler(): void {
  samples.length = 0
  notify()
}
