export type WsEventType = 'connect' | 'disconnect' | 'reconnect' | 'error' | 'latency'

export interface WsEvent {
  type: WsEventType
  timestamp: number
  durationMs?: number
  latencyMs?: number
  detail?: string
}

export interface WsAnalyticsSummary {
  totalConnects: number
  totalDisconnects: number
  totalReconnects: number
  totalErrors: number
  disconnectRate: number
  avgLatencyMs: number | null
  events: WsEvent[]
}

type Listener = (summary: WsAnalyticsSummary) => void

const MAX_EVENTS = 500
const events: WsEvent[] = []
const listeners = new Set<Listener>()
let connectTime: number | null = null
let latencySamples: number[] = []

function summarise(): WsAnalyticsSummary {
  const counts = { connect: 0, disconnect: 0, reconnect: 0, error: 0 }
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

  return {
    totalConnects: counts.connect,
    totalDisconnects: counts.disconnect,
    totalReconnects: counts.reconnect,
    totalErrors: counts.error,
    disconnectRate,
    avgLatencyMs: avg,
    events: [...events],
  }
}

function push(event: WsEvent) {
  if (events.length >= MAX_EVENTS) events.shift()
  events.push(event)
  const s = summarise()
  listeners.forEach((l) => l(s))
}

export const wsAnalytics = {
  recordConnect() {
    connectTime = Date.now()
    push({ type: 'connect', timestamp: Date.now() })
  },
  recordDisconnect() {
    const durationMs = connectTime != null ? Date.now() - connectTime : undefined
    connectTime = null
    push({ type: 'disconnect', timestamp: Date.now(), durationMs })
  },
  recordReconnect() {
    push({ type: 'reconnect', timestamp: Date.now() })
  },
  recordError(detail?: string) {
    push({ type: 'error', timestamp: Date.now(), detail })
  },
  recordLatency(ms: number) {
    latencySamples = [...latencySamples.slice(-99), ms]
    push({ type: 'latency', timestamp: Date.now(), latencyMs: ms })
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
  clear() {
    events.length = 0
    latencySamples = []
    connectTime = null
  },
}
