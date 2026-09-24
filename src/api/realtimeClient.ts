/**
 * Realtime price feed client (#471).
 *
 * Wraps {@link WebSocketClient} and transparently falls back to
 * {@link SseClient} when the WebSocket transport is exhausted without ever
 * successfully connecting (e.g. a network that blocks the WS upgrade). This
 * is the class `PriceContext` talks to — its public surface mirrors
 * `WebSocketClient` so callers don't need to know which transport is active.
 * Both transports emit the identical `WsMessage` shape, so the
 * optimistic-update + REST-confirm path is unaffected by which one is live.
 * The active transport is exposed via `diagnostics.transport` for the UI
 * (see `ConnectionBadge`'s "SSE" indicator).
 */
import { config } from '../config'
import type { WsMessage } from '../types'
import { WebSocketClient, type ConnectionStatus, type ConnectionDiagnostics } from './websocket'
import { SseClient, deriveSseUrl } from './sseTransport'

type MessageHandler = (msg: WsMessage) => void
type StatusHandler = (status: ConnectionStatus) => void

export class RealtimeClient {
  private ws: WebSocketClient | null = null
  private sse: SseClient | null = null
  private transport: 'ws' | 'sse' = 'ws'
  private everConnected = false
  private destroyed = false
  private readonly subscribedPairs = new Set<string>()

  private readonly messageHandlersRef: Set<MessageHandler> = new Set()
  private readonly statusHandlersRef: Set<StatusHandler> = new Set()

  private _status: ConnectionStatus = 'disconnected'
  get status(): ConnectionStatus {
    return this._status
  }

  get diagnostics(): ConnectionDiagnostics {
    const active = this.transport === 'ws' ? this.ws?.diagnostics : this.sse?.diagnostics
    return {
      retryCount: active?.retryCount ?? 0,
      lastConnectedAt: active?.lastConnectedAt ?? null,
      totalDisconnections: active?.totalDisconnections ?? 0,
      protocolVersion: active?.protocolVersion ?? null,
      protocolUpgradeRequired: active?.protocolUpgradeRequired ?? false,
      isPaused: active?.isPaused ?? false,
      transport: this.transport,
    }
  }

  private setStatus(status: ConnectionStatus) {
    this._status = status
    this.statusHandlersRef.forEach((h) => h(status))
  }

  connect() {
    if (this.destroyed) return
    this.startWs()
  }

  private startWs() {
    const client = new WebSocketClient()
    this.ws = client
    this.transport = 'ws'

    client.onMessage((msg) => this.messageHandlersRef.forEach((h) => h(msg)))
    client.onStatusChange((status) => {
      if (status === 'connected') this.everConnected = true
      // Fall back to SSE only if the WS transport never once connected —
      // an established connection that later dies should keep retrying WS.
      if (status === 'dead' && !this.everConnected) {
        this.fallBackToSse()
        return
      }
      this.setStatus(status)
    })

    if (this.subscribedPairs.size > 0) client.subscribe(Array.from(this.subscribedPairs))
    client.connect()
  }

  private fallBackToSse() {
    if (typeof EventSource === 'undefined') {
      // No SSE support in this environment either — surface the original dead state.
      this.setStatus('dead')
      return
    }

    this.ws?.disconnect()
    this.ws = null
    this.transport = 'sse'

    const sse = new SseClient(deriveSseUrl(config.wsUrl))
    this.sse = sse
    sse.onMessage((msg) => this.messageHandlersRef.forEach((h) => h(msg)))
    sse.onStatusChange((status) => this.setStatus(status))

    if (this.subscribedPairs.size > 0) sse.subscribe(Array.from(this.subscribedPairs))
    sse.connect()
  }

  disconnect() {
    this.destroyed = true
    this.ws?.disconnect()
    this.sse?.disconnect()
    this.setStatus('disconnected')
  }

  subscribe(pairs: string | string[]) {
    const arr = typeof pairs === 'string' ? [pairs] : pairs
    arr.forEach((p) => this.subscribedPairs.add(p))
    if (this.transport === 'ws') this.ws?.subscribe(arr)
    else this.sse?.subscribe(arr)
  }

  unsubscribe(pairs: string | string[]) {
    const arr = typeof pairs === 'string' ? [pairs] : pairs
    arr.forEach((p) => this.subscribedPairs.delete(p))
    if (this.transport === 'ws') this.ws?.unsubscribe(arr)
    else this.sse?.unsubscribe(arr)
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
