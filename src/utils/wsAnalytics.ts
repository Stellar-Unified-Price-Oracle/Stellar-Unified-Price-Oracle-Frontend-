export type WsEventType = 'connect' | 'disconnect' | 'reconnect' | 'error' | 'latency' | 'drop'

export interface WsEvent {
  type: WsEventType
  timestamp: number
  durationMs?: number
  latencyMs?: number
  detail?: string
}

/** Per-minute rolling counters used to drive the message-rate sparkline (#473). */
export interface WsRateBucket {
  /** Bucket start, floored to the minute (ms since epoch). */
  minute: number
  messages: number
  bytes: number
  drops: number
  reconnects: number
}

export interface WsLatencyPercentiles {
  p50: number | null
  p95: number | null
  p99: number | null
}

export interface WsAnalyticsSummary {
  totalConnects: number
  totalDisconnects: number
  totalReconnects: number
  totalErrors: number
  /** Total application messages successfully received and parsed. */
  totalMessages: number
  /** Total messages discarded (malformed JSON, failed schema validation, out-of-order/duplicate seq). */
  totalDrops: number
  /** Total bytes received across all counted messages. */
  totalBytes: number
  disconnectRate: number
  /** Average round-trip ping latency (heartbeat), unrelated to message parse time. */
  avgLatencyMs: number | null
  /** Receive-to-parse latency percentiles computed from real per-message timing samples. */
  messageLatencyPercentiles: WsLatencyPercentiles
  /** Per-minute message-rate history, oldest first, capped to {@link RATE_BUCKET_WINDOW} entries. */
  rateBuckets: WsRateBucket[]
  /** Negotiated WS protocol version (#472) or `null` before the handshake. */
  protocolVersion: number | null
  /** True when the server is newer than this client supports (#472). */
  protocolUpgradeRequired: boolean
  events: WsEvent[]
}

type Listener = (summary: WsAnalyticsSummary) => void

const MAX_EVENTS = 500
/** Rolling window of receive-to-parse latency samples kept for percentile calculation. */
const MAX_LATENCY_SAMPLES = 200
/** How many one-minute buckets to retain for the rate sparkline (30 min of history). */
const RATE_BUCKET_WINDOW = 30
/**
 * Coalesces the high-frequency `recordMessage` notifications so a burst of WS
 * ticks triggers at most one subscriber re-render per window, instead of one
 * per message — keeps the diagnostics panel off the main-thread critical path.
 */
const NOTIFY_THROTTLE_MS = 250

const events: WsEvent[] = []
const listeners = new Set<Listener>()
let connectTime: number | null = null
let latencySamples: number[] = []
let messageLatencySamples: number[] = []
let rateBuckets: WsRateBucket[] = []
let totalMessages = 0
let totalBytes = 0
let protocolVersion: number | null = null
let protocolUpgradeRequired = false
let notifyTimer: ReturnType<typeof setTimeout> | null = null

/** Nearest-rank percentile over an already ascending-sorted array. */
function percentile(sortedAsc: number[], p: number): number | null {
  if (sortedAsc.length === 0) return null
  const rank = Math.ceil(p * sortedAsc.length) - 1
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, rank))
  return sortedAsc[idx]
}

/** Gets (creating if needed) the current minute's rate bucket, evicting the oldest past the window. */
function touchBucket(): WsRateBucket {
  const minute = Math.floor(Date.now() / 60_000) * 60_000
  const last = rateBuckets[rateBuckets.length - 1]
  if (last && last.minute === minute) return last
  const bucket: WsRateBucket = { minute, messages: 0, bytes: 0, drops: 0, reconnects: 0 }
  rateBuckets.push(bucket)
  if (rateBuckets.length > RATE_BUCKET_WINDOW) rateBuckets.shift()
  return bucket
}

/**
 * Clears only the metrics that describe the *current* connection's live
 * performance (receive-to-parse latency samples). Called on every drop and
 * every (re)connect so stale measurements from a dead socket never blend
 * into the new connection's percentiles.
 *
 * Lifetime counters (totals) and the per-minute rate/drop/reconnect history
 * are intentionally left alone — those are a time series meant to span
 * reconnects so an operator can see the rate impact around a disconnect.
 */
function resetSessionMetrics(): void {
  messageLatencySamples = []
}

function summarise(): WsAnalyticsSummary {
  const counts = { connect: 0, disconnect: 0, reconnect: 0, error: 0, drop: 0 }
  for (const e of events) {
    if (e.type in counts) counts[e.type as keyof typeof counts]++
  }
  const windowMs = 5 * 60 * 1000 // 5 min window for rate
  const now = Date.now()
  const recent = events.filter((e) => e.type === 'disconnect' && now - e.timestamp < windowMs)
  const disconnectRate = recent.length / 5 // per minute

  const avg =
    latencySamples.length > 0
      ? latencySamples.reduce((a, b) => a + b, 0) / latencySamples.length
      : null

  const sortedMessageLatency = [...messageLatencySamples].sort((a, b) => a - b)

  return {
    totalConnects: counts.connect,
    totalDisconnects: counts.disconnect,
    totalReconnects: counts.reconnect,
    totalErrors: counts.error,
    totalMessages,
    totalDrops: counts.drop,
    totalBytes,
    disconnectRate,
    avgLatencyMs: avg,
    messageLatencyPercentiles: {
      p50: percentile(sortedMessageLatency, 0.5),
      p95: percentile(sortedMessageLatency, 0.95),
      p99: percentile(sortedMessageLatency, 0.99),
    },
    rateBuckets: [...rateBuckets],
    protocolVersion,
    protocolUpgradeRequired,
    events: [...events],
  }
}

function push(event: WsEvent) {
  if (events.length >= MAX_EVENTS) events.shift()
  events.push(event)
  const s = summarise()
  listeners.forEach((l) => l(s))
}

/** Throttled notify for high-frequency callers (see {@link NOTIFY_THROTTLE_MS}). */
function scheduleNotify(): void {
  if (notifyTimer !== null) return
  notifyTimer = setTimeout(() => {
    notifyTimer = null
    const s = summarise()
    listeners.forEach((l) => l(s))
  }, NOTIFY_THROTTLE_MS)
}

export const wsAnalytics = {
  recordConnect() {
    connectTime = Date.now()
    resetSessionMetrics()
    push({ type: 'connect', timestamp: Date.now() })
  },
  recordDisconnect() {
    const durationMs = connectTime != null ? Date.now() - connectTime : undefined
    connectTime = null
    resetSessionMetrics()
    push({ type: 'disconnect', timestamp: Date.now(), durationMs })
  },
  recordReconnect() {
    connectTime = Date.now()
    resetSessionMetrics()
    touchBucket().reconnects++
    push({ type: 'reconnect', timestamp: Date.now() })
  },
  recordError(detail?: string) {
    push({ type: 'error', timestamp: Date.now(), detail })
  },
  /** Round-trip heartbeat/ping latency — distinct from per-message parse latency below. */
  recordLatency(ms: number) {
    latencySamples = [...latencySamples.slice(-99), ms]
    push({ type: 'latency', timestamp: Date.now(), latencyMs: ms })
  },
  /**
   * Records one successfully-parsed inbound application message: its wire
   * byte size and the receive-to-parse latency measured by the caller
   * (typically `performance.now()` at message receipt through validation).
   * Notifications are throttled — see {@link NOTIFY_THROTTLE_MS} — so a burst
   * of ticks costs at most one subscriber update per window.
   */
  recordMessage(sizeBytes: number, latencyMs: number) {
    totalMessages++
    totalBytes += sizeBytes
    if (messageLatencySamples.length >= MAX_LATENCY_SAMPLES) messageLatencySamples.shift()
    messageLatencySamples.push(latencyMs)
    const bucket = touchBucket()
    bucket.messages++
    bucket.bytes += sizeBytes
    scheduleNotify()
  },
  /** Records a discarded inbound frame (malformed JSON, failed validation, duplicate/out-of-order seq). */
  recordDrop(detail?: string) {
    touchBucket().drops++
    push({ type: 'drop', timestamp: Date.now(), detail })
  },
  recordProtocolVersion(version: number, upgradeRequired: boolean) {
    protocolVersion = version
    protocolUpgradeRequired = upgradeRequired
    const s = summarise()
    listeners.forEach((l) => l(s))
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    listener(summarise())
    return () => listeners.delete(listener)
  },
  getSummary(): WsAnalyticsSummary {
    return summarise()
  },
  exportEvents(): string {
    return JSON.stringify(events, null, 2)
  },
  /** Full diagnostics snapshot (summary + raw event log) for the panel's export button. */
  exportDiagnosticsSnapshot(): string {
    return JSON.stringify({ exportedAt: new Date().toISOString(), summary: summarise() }, null, 2)
  },
  clear() {
    events.length = 0
    latencySamples = []
    messageLatencySamples = []
    rateBuckets = []
    totalMessages = 0
    totalBytes = 0
    connectTime = null
    if (notifyTimer !== null) {
      clearTimeout(notifyTimer)
      notifyTimer = null
    }
  },
}
