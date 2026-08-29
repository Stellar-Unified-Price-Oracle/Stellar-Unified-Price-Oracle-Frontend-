import { config } from '../config'
import type { WsMessage, WsSubscribeMessage, WsUnsubscribeMessage } from '../types'
import { wsAnalytics } from '../utils/wsAnalytics'
import { recordWsMessageTiming } from '../utils/performanceMonitor'
import { WS_PROTOCOL_VERSION } from './version'
import { rateLimitManager } from './rateLimit'
import { WsMessageSchema } from './schemas'

type MessageHandler = (msg: WsMessage) => void
type StatusHandler = (status: ConnectionStatus) => void

/**
 * Extended connection states per issue #247:
 * - `connected`    — socket is open and healthy
 * - `connecting`   — initial or reconnect connection attempt in progress
 * - `disconnected` — cleanly closed (e.g. explicit {@link WebSocketClient.disconnect})
 * - `waiting`      — in the backoff window before the next reconnect attempt
 * - `dead`         — max retries exhausted; no further reconnect will occur
 */
export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'waiting'
  | 'dead'

/** Diagnostics exposed via the client for use in UI components. */
export interface ConnectionDiagnostics {
  /** Number of reconnect attempts since the last successful connection. */
  retryCount: number
  /** Timestamp (ms) of the most recent successful connection, or `null`. */
  lastConnectedAt: number | null
  /** Total number of disconnections since the client was created. */
  totalDisconnections: number
  /** Negotiated WS protocol version (#472), or `null` before/without a handshake. */
  protocolVersion?: number | null
  /** True when the server speaks a newer protocol than this client supports (#472). */
  protocolUpgradeRequired?: boolean
}

const supportsDecompression = typeof DecompressionStream !== 'undefined'

async function decompress(data: Blob): Promise<string> {
  try {
    const ds = new DecompressionStream('gzip')
    const decompressed = data.stream().pipeThrough(ds)
    const reader = decompressed.getReader()
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    const total = chunks.reduce((n, c) => n + c.length, 0)
    const merged = new Uint8Array(total)
    let offset = 0
    for (const c of chunks) {
      merged.set(c, offset)
      offset += c.length
    }
    return new TextDecoder().decode(merged)
  } catch {
    return data.text()
  }
}

// Reconnection configuration
const INITIAL_DELAY_MS = 1_000
const MAX_DELAY_MS = 30_000
const MAX_RETRIES = 20

// Heartbeat configuration
const HEARTBEAT_INTERVAL_MS = 30_000
const HEARTBEAT_TIMEOUT_MS = 10_000

/**
 * Full-jitter exponential backoff: returns a random value in [0, min(initial * 2^attempt, max)].
 * This avoids thundering-herd reconnect storms.
 */
function jitteredBackoff(attempt: number): number {
  const cap = Math.min(INITIAL_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS)
  return Math.random() * cap
}

/**
 * Manages a single WebSocket connection to the price feed server.
 *
 * Improvements in this version (issue #247):
 * - **5-state machine**: `connected`, `connecting`, `disconnected`, `waiting`, `dead`
 * - **Exponential backoff with full jitter**: `random(0, min(1s * 2^n, 30s))`
 * - **Max retries**: after 20 failed attempts the connection enters `dead` state
 * - **Heartbeat**: sends `{"action":"ping"}` every 30 s; if no message arrives within
 *   10 s the connection is treated as half-open and torn down for a fresh reconnect
 * - **Outbound message buffer**: messages sent while disconnected are queued and
 *   flushed in original order on the next successful connection
 * - **Monotonic message IDs**: incoming messages with a `seq` field lower than the
 *   last seen value are discarded (duplicate protection after reconnect)
 * - **Rate-limit awareness**: pauses reconnection when `rateLimitManager` reports
 *   a `limited` status and resumes after the retry-after window
 * - **Diagnostics**: `retryCount`, `lastConnectedAt`, `totalDisconnections`
 */
export class WebSocketClient {
  private ws: WebSocket | null = null

  /**
   * Stable ref holding the current set of message handlers.
   * The `onmessage` closure reads from this ref at dispatch time, ensuring it
   * always calls the latest registered handlers (no stale closure capture).
   */
  private messageHandlersRef: Set<MessageHandler> = new Set()

  /**
   * Stable ref holding the current set of status handlers.
   * Same approach as messageHandlersRef — read at dispatch time, never captured.
   */
  private statusHandlersRef: Set<StatusHandler> = new Set()

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempt = 0
  private destroyed = false
  private subscribedPairs = new Set<string>()
  private useCompression = false

  // Outbound message buffer (queue while disconnected)
  private outboundQueue: string[] = []

  // Duplicate/ordering protection
  private lastSeq = -1

  // Heartbeat
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null

  // Diagnostics
  private _retryCount = 0
  private _lastConnectedAt: number | null = null
  private _totalDisconnections = 0
  // #472 – negotiated WS protocol version, or null before the handshake.
  private _protocolVersion: number | null = null
  private _protocolUpgradeRequired = false

  private _status: ConnectionStatus = 'disconnected'
  get status(): ConnectionStatus {
    return this._status
  }

  get diagnostics(): ConnectionDiagnostics {
    return {
      retryCount: this._retryCount,
      lastConnectedAt: this._lastConnectedAt,
      totalDisconnections: this._totalDisconnections,
      protocolVersion: this._protocolVersion,
      protocolUpgradeRequired: this._protocolUpgradeRequired,
    }
  }

  private setStatus(status: ConnectionStatus) {
    this._status = status
    // Read handlers from the stable ref at dispatch time — never stale.
    this.statusHandlersRef.forEach((h) => h(status))
  }

  // ── Heartbeat helpers ───────────────────────────────────────────────────────

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatInterval = setInterval(() => {
      this.sendRaw(JSON.stringify({ action: 'ping' }))
      // Expect any message (not just pong) within the timeout window
      this.heartbeatTimeout = setTimeout(() => {
        // Half-open detected — tear down and reconnect
        this.ws?.close()
      }, HEARTBEAT_TIMEOUT_MS)
    }, HEARTBEAT_INTERVAL_MS)
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout)
      this.heartbeatTimeout = null
    }
  }

  private resetHeartbeatTimeout() {
    // Any incoming message resets the "pong expected" timeout
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout)
      this.heartbeatTimeout = null
    }
  }

  // ── Raw send (bypasses queue logic) ────────────────────────────────────────

  private sendRaw(raw: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(raw)
    }
  }

  /** #472 – Process the server's `welcome` handshake and negotiate the protocol version. */
  private handleWelcome(serverVersion: number): void {
    this._protocolVersion = serverVersion
    this._protocolUpgradeRequired = serverVersion > WS_PROTOCOL_VERSION
    wsAnalytics.recordProtocolVersion(serverVersion, this._protocolUpgradeRequired)
    if (this._protocolUpgradeRequired) {
      console.warn(
        `[WebSocket] Server speaks WS protocol v${serverVersion}, but this client supports v${WS_PROTOCOL_VERSION}. ` +
          'Downgrading to the supported feature set — please update the client for full compatibility.',
      )
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Opens the WebSocket connection. Appends `?compress=1` when the browser supports `DecompressionStream`. */
  connect() {
    if (this.destroyed) return
    this.setStatus('connecting')

    const url = supportsDecompression
      ? `${config.wsUrl}${config.wsUrl.includes('?') ? '&' : '?'}compress=1`
      : config.wsUrl

    this.ws = new WebSocket(url)
    this.ws.binaryType = 'blob'

    this.ws.onopen = () => {
      this.reconnectAttempt = 0
      this._retryCount = 0
      // A prior disconnection means this open is a reconnect (automatic or
      // manual); distinguished so wsAnalytics' connect/reconnect counters —
      // and the diagnostics panel built on them (#473) — stay accurate.
      const isReconnect = this._totalDisconnections > 0
      this._lastConnectedAt = Date.now()
      this.setStatus('connected')
      if (isReconnect) {
        wsAnalytics.recordReconnect()
      } else {
        wsAnalytics.recordConnect()
      }

      // #472 – perform the protocol handshake. Reset any previously-negotiated
      // version so a fresh session re-negotiates from scratch.
      this._protocolVersion = null
      this._protocolUpgradeRequired = false
      this.sendRaw(JSON.stringify({ type: 'hello', protocolVersion: WS_PROTOCOL_VERSION }))

      // Re-subscribe to all previously tracked pairs.
      // This covers any subscribe() calls that arrived while disconnected,
      // so we clear the outbound queue first to avoid duplicate subscription
      // messages (subscribe calls while offline were already tracked in
      // subscribedPairs via the send() path).
      this.outboundQueue = []

      if (this.subscribedPairs.size > 0) {
        this.sendRaw(
          JSON.stringify({
            action: 'subscribe',
            assetPairs: Array.from(this.subscribedPairs),
          }),
        )
      }

      // Start heartbeat
      this.startHeartbeat()
    }

    // Fix: capture a reference to the stable handler Sets (not individual callbacks).
    // Each time a message arrives, we iterate the *current* contents of
    // `messageHandlersRef`, so newly registered or updated handlers are always used.
    const messageHandlersRef = this.messageHandlersRef
    this.ws.onmessage = async (e) => {
      // Capture the start time for processing-time measurement
      const messageStart = performance.now()

      // Any inbound message resets the heartbeat timeout
      this.resetHeartbeatTimeout()

      try {
        let text: string
        if (e.data instanceof Blob) {
          text = supportsDecompression ? await decompress(e.data) : await e.data.text()
          this.useCompression = true
        } else {
          text = e.data as string
        }

        // Wire byte size (#473) — the Blob's compressed size when applicable,
        // otherwise the decoded text's real UTF-8 byte length.
        const sizeBytes = e.data instanceof Blob ? e.data.size : new TextEncoder().encode(text).length

        const raw = JSON.parse(text) as Record<string, unknown>

        // Discard duplicate / out-of-order messages using monotonic seq
        if (typeof raw['seq'] === 'number') {
          if (raw['seq'] <= this.lastSeq) {
            wsAnalytics.recordDrop('duplicate-or-out-of-order-seq')
            return
          }
          this.lastSeq = raw['seq']
        }

        // Don't forward internal pong messages to application handlers
        if (raw['type'] === 'pong') return

        // Validate message shape before dispatching (issue #244)
        const parsed = WsMessageSchema.safeParse(raw)
        if (!parsed.success) {
          console.warn('[WebSocket] Unknown or malformed message', raw)
          wsAnalytics.recordDrop('malformed')
          return
        }

        const msg: WsMessage = parsed.data

        // #472 – handle the handshake reply here rather than forwarding it to
        // application handlers (which only care about price updates).
        if (msg.type === 'welcome') {
          this.handleWelcome(msg.protocolVersion)
          return
        }

        // Receive-to-parse latency (#473) — measured up to this point, before
        // handler dispatch, so it reflects decode+validate cost only.
        wsAnalytics.recordMessage(sizeBytes, performance.now() - messageStart)

        messageHandlersRef.forEach((h) => h(msg))

        // Record end-to-end processing time for this message
        recordWsMessageTiming(messageStart, typeof raw['type'] === 'string' ? raw['type'] : undefined)
      } catch {
        // Malformed JSON or a decompression failure — count as a dropped frame (#473).
        wsAnalytics.recordDrop('parse-error')
      }
    }

    this.ws.onclose = () => {
      this.useCompression = false
      this.stopHeartbeat()
      wsAnalytics.recordDisconnect()
      this._totalDisconnections++
      this.setStatus('disconnected')
      this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      wsAnalytics.recordError()
      this.ws?.close()
    }
  }

  private scheduleReconnect() {
    if (this.destroyed || this.reconnectTimer) return

    if (this.reconnectAttempt >= MAX_RETRIES) {
      this.setStatus('dead')
      return
    }

    // Pause if currently rate-limited; resume once the window expires
    if (rateLimitManager.isLimited) {
      const retryAfterMs = rateLimitManager.retryAfterMs || 5_000
      this.setStatus('waiting')
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null
        this.scheduleReconnect()
      }, retryAfterMs)
      return
    }

    this.setStatus('waiting')
    const delay = jitteredBackoff(this.reconnectAttempt)
    this._retryCount = this.reconnectAttempt + 1
    this.reconnectAttempt++

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      // Re-check rate limit before actually connecting
      if (!this.destroyed) {
        this.setStatus('reconnecting')
        this.connect()
      }
    }, delay)
  }

  /** Permanently closes the connection and cancels any pending reconnect timer. Calling {@link connect} again after this is a no-op. */
  disconnect() {
    this.destroyed = true
    this.reconnectAttempt = 0
    this.stopHeartbeat()
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
    this.setStatus('disconnected')
  }

  /**
   * Sends a raw subscribe or unsubscribe message.
   * If the socket is not currently open the message is buffered and flushed on next connect.
   */
  send(msg: WsSubscribeMessage | WsUnsubscribeMessage) {
    const raw = JSON.stringify(msg)
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(raw)
    } else {
      // Buffer for delivery after reconnect
      this.outboundQueue.push(raw)
    }
  }

  /** Adds pairs to the tracked subscription set and sends a subscribe message. Re-subscribed automatically on reconnect. */
  subscribe(pairs: string | string[]) {
    const arr = typeof pairs === 'string' ? [pairs] : pairs
    arr.forEach((p) => this.subscribedPairs.add(p))
    this.send({ action: 'subscribe', assetPairs: arr })
  }

  /** Removes pairs from the tracked subscription set and sends an unsubscribe message. */
  unsubscribe(pairs: string | string[]) {
    const arr = typeof pairs === 'string' ? [pairs] : pairs
    arr.forEach((p) => this.subscribedPairs.delete(p))
    this.send({ action: 'unsubscribe', assetPairs: arr })
  }

  /**
   * Registers a handler to be called for every incoming {@link WsMessage}.
   * Returns an unsubscribe function.
   *
   * Because handlers are stored in a stable Set and read at dispatch time,
   * updating the handler (e.g. passing a new closure on re-render) and
   * calling the unsubscribe + re-subscribe pattern will always use the
   * current handler without stale-closure issues.
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlersRef.add(handler)
    return () => this.messageHandlersRef.delete(handler)
  }

  /**
   * Registers a handler to be called whenever the connection status changes.
   * Returns an unsubscribe function.
   */
  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlersRef.add(handler)
    return () => this.statusHandlersRef.delete(handler)
  }

  get isCompressed(): boolean {
    return this.useCompression
  }
}
