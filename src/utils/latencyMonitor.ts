export interface LatencySample {
  endpoint: string
  latencyMs: number
  timestamp: number
  ok: boolean
}

export interface LatencyStats {
  p50: number | null
  p95: number | null
  p99: number | null
  avg: number | null
  count: number
}

type Listener = (samples: LatencySample[]) => void

const MAX_SAMPLES = 500
const HIGH_LATENCY_THRESHOLD_MS = 2000
const samples: LatencySample[] = []
const listeners = new Set<Listener>()
let alertThresholdMs = HIGH_LATENCY_THRESHOLD_MS

function notify() {
  const snapshot = [...samples]
  listeners.forEach((l) => l(snapshot))
}

export function recordLatency(endpoint: string, latencyMs: number, ok: boolean) {
  if (samples.length >= MAX_SAMPLES) samples.shift()
  samples.push({ endpoint, latencyMs, timestamp: Date.now(), ok })
  if (latencyMs > alertThresholdMs) {
    console.warn(`[Latency] High latency on ${endpoint}: ${latencyMs}ms (threshold: ${alertThresholdMs}ms)`)
  }
  notify()
}

export function setLatencyAlertThreshold(ms: number) {
  alertThresholdMs = ms
}

export function getLatencyAlertThreshold(): number {
  return alertThresholdMs
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

export function getLatencyStats(endpoint?: string): LatencyStats {
  const filtered = endpoint ? samples.filter((s) => s.endpoint === endpoint) : samples
  const sorted = filtered.map((s) => s.latencyMs).sort((a, b) => a - b)
  const avg = sorted.length > 0 ? sorted.reduce((a, b) => a + b, 0) / sorted.length : null
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    avg,
    count: sorted.length,
  }
}

export function getSamples(last = 100): LatencySample[] {
  return samples.slice(-last)
}

export function subscribeLatency(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function exportLatency(): string {
  return JSON.stringify(samples, null, 2)
}

/**
 * Wraps a fetch call to automatically track latency.
 */
export async function trackedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const endpoint = typeof input === 'string' ? input.split('?')[0] : String(input).split('?')[0]
  const start = performance.now()
  try {
    const res = await fetch(input, init)
    recordLatency(endpoint, Math.round(performance.now() - start), res.ok)
    return res
  } catch (err) {
    recordLatency(endpoint, Math.round(performance.now() - start), false)
    throw err
  }
}
