/**
 * Server-Sent Events fallback transport for the price feed (#471).
 *
 * Some corporate/enterprise networks block the WebSocket upgrade handshake
 * outright. {@link SseClient} streams the same `price_update` event shape as
 * {@link WebSocketClient} over a plain `EventSource`, so `PriceContext`'s
 * optimistic-update + REST-confirm path is unaffected by which transport is
 * actually active.
 *
 * It reuses `WebSocketClient`'s reconnect backoff and heartbeat-timeout
 * constants (imported from `./websocket`) so both transports fail over with
 * identical timing/jitter — only the underlying wire mechanism differs.
 *
 * SSE has no client→server channel, so `subscribe`/`unsubscribe` are encoded
 * as a `pairs` query parameter and applied by reopening the stream.
 */
import type { WsMessage } from '../types'
import { wsAnalytics } from '../utils/wsAnalytics'
import { WsMessageSchema } from './schemas'
import {
  type ConnectionStatus,
  type ConnectionDiagnostics,
  MAX_RETRIES,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  jitteredBackoff,
} from './websocket'

type MessageHandler = (msg: WsMessage) => void
type StatusHandler = (status: ConnectionStatus) => void

/** Derives the SSE endpoint from the configured WS URL: swap scheme, sibling `/events` path. */
export function deriveSseUrl(wsUrl: string): string {
  const httpUrl = wsUrl.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://')
  const [base, query] = httpUrl.split('?')
  const path = base.endsWith('/') ? `${base}events` : `${base}/events`
  return query ? `${path}?${query}` : path
}

export class SseClient {
  private es: EventSource | null = null
  private readonly messageHandlersRef: Set<MessageHandler> = new Set()
  private readonly statusHandlersRef: Set<StatusHandler> = new Set()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempt = 0
  private destroyed = false
  private readonly subscribedPairs = new Set<string>()
  private heartbeatCheckTimer: ReturnType<typeof setInterval> | null = null
  private lastMessageAt = 0

  private _retryCount = 0
  private _lastConnectedAt: number | null = null
  private _totalDisconnections = 0
  private _status: ConnectionStatus = 'disconnected'

  constructor(private readonly baseUrl: string) {}

  get status(): ConnectionStatus {
    return this._status
  }

  get diagnostics(): ConnectionDiagnostics {
    return {
      retryCount: this._retryCount,
      lastConnectedAt: this._lastConnectedAt,
      totalDisconnections: this._totalDisconnections,
      transport: 'sse',
    }
  }

  private setStatus(status: ConnectionStatus) {
    this._status = status
    this.statusHandlersRef.forEach((h) => h(status))
  }

  private buildUrl(): string {
    if (this.subscribedPairs.size === 0) return this.baseUrl
    const pairs = encodeURIComponent(Array.from(this.subscribedPairs).join(','))
    return `${this.baseUrl}${this.baseUrl.includes('?') ? '&' : '?'}pairs=${pairs}`
  }

  connect() {
    if (this.destroyed || typeof EventSource === 'undefined') return
    this.setStatus('connecting')

    const es = new EventSource(this.buildUrl())
    this.es = es

    es.onopen = () => {
      this.reconnectAttempt = 0
      this._retryCount = 0
      this._lastConnectedAt = Date.now()
      this.lastMessageAt = Date.now()
      this.setStatus('connected')
      this.startHeartbeatCheck()
    }

    es.onmessage = (e: MessageEvent<string>) => {
      this.lastMessageAt = Date.now()
      try {
        const raw = JSON.parse(e.data) as Record<string, unknown>
        const parsed = WsMessageSchema.safeParse(raw)
        if (!parsed.success) return
        const msg = parsed.data
        if (msg.type === 'welcome' || msg.type === 'paused' || msg.type === 'resumed') return
        this.messageHandlersRef.forEach((h) => h(msg))
      } catch {
        // ignore malformed messages
      }
    }

    es.onerror = () => {
      wsAnalytics.recordError('sse')
      this.teardown()
      this.scheduleReconnect()
    }
  }

  private teardown() {
    this.stopHeartbeatCheck()
    this.es?.close()
    this.es = null
    this._totalDisconnections++
    wsAnalytics.recordDisconnect()
    this.setStatus('disconnected')
  }

  private startHeartbeatCheck() {
    this.stopHeartbeatCheck()
    this.heartbeatCheckTimer = setInterval(() => {
      if (Date.now() - this.lastMessageAt > HEARTBEAT_INTERVAL_MS + HEARTBEAT_TIMEOUT_MS) {
        // No traffic at all within the window — treat the stream as half-open.
        this.teardown()
        this.scheduleReconnect()
      }
    }, HEARTBEAT_INTERVAL_MS)
  }

  private stopHeartbeatCheck() {
    if (this.heartbeatCheckTimer) {
      clearInterval(this.heartbeatCheckTimer)
      this.heartbeatCheckTimer = null
    }
  }

  private scheduleReconnect() {
    if (this.destroyed || this.reconnectTimer) return
    if (this.reconnectAttempt >= MAX_RETRIES) {
      this.setStatus('dead')
      return
    }
    this.setStatus('waiting')
    const delay = jitteredBackoff(this.reconnectAttempt)
    this._retryCount = this.reconnectAttempt + 1
    this.reconnectAttempt++
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.destroyed) {
        this.setStatus('reconnecting')
        this.connect()
      }
    }, delay)
  }

  disconnect() {
    this.destroyed = true
    this.reconnectAttempt = 0
    this.stopHeartbeatCheck()
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.es?.close()
    this.es = null
    this.setStatus('disconnected')
  }

  /** Adds pairs and reopens the stream with the full current pair set (SSE can't patch a subscription in place). */
  subscribe(pairs: string | string[]) {
    const arr = typeof pairs === 'string' ? [pairs] : pairs
    arr.forEach((p) => this.subscribedPairs.add(p))
    this.reopen()
  }

  unsubscribe(pairs: string | string[]) {
    const arr = typeof pairs === 'string' ? [pairs] : pairs
    arr.forEach((p) => this.subscribedPairs.delete(p))
    this.reopen()
  }

  private reopen() {
    if (this.destroyed || !this.es) return
    this.es.close()
    this.connect()
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlersRef.add(handler)
    return () => this.messageHandlersRef.delete(handler)
  }

  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlersRef.add(handler)
    return () => this.statusHandlersRef.delete(handler)
  }
}
