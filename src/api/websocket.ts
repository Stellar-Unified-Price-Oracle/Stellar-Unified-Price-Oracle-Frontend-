import { config } from '../config'
import { TokenStorage } from '../utils/tokenStorage'
import type { WsMessage, WsSubscribeMessage, WsUnsubscribeMessage, WsAuthMessage, WsAuthResponseMessage } from '../types'

type MessageHandler = (msg: WsMessage | WsAuthResponseMessage) => void
type StatusHandler = (status: ConnectionStatus) => void
type TokenProvider = () => Promise<string | null>

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'auth_failed'

// Detect browser support for DecompressionStream (gzip/deflate)
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
    for (const c of chunks) { merged.set(c, offset); offset += c.length }
    return new TextDecoder().decode(merged)
  } catch {
    // Fallback: try reading as plain text
    return data.text()
  }
}

export class WebSocketClient {
  private ws: WebSocket | null = null
  private messageHandlers = new Set<MessageHandler>()
  private statusHandlers = new Set<StatusHandler>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false
  private subscribedPairs = new Set<string>()
  /** Whether the server negotiated compressed binary frames */
  private useCompression = false
  /** Token provider for authentication (Issue #96) */
  private tokenProvider: TokenProvider | null = null
  /** Flag to track if we're authenticated */
  private isAuthenticated = false

  private _status: ConnectionStatus = 'disconnected'
  get status(): ConnectionStatus {
    return this._status
  }

  private setStatus(status: ConnectionStatus) {
    this._status = status
    this.statusHandlers.forEach((h) => h(status))
  }

  /**
   * Set a token provider function for authentication (Issue #96)
   * @param provider - Async function that returns an auth token
   */
  setTokenProvider(provider: TokenProvider): void {
    this.tokenProvider = provider
    // Clear any stored token on setup
    TokenStorage.clearToken()
  }

  connect() {
    if (this.destroyed) return
    this.setStatus('connecting')

    // Append ?compress=1 to signal compression support to the server
    const url = supportsDecompression
      ? `${config.wsUrl}${config.wsUrl.includes('?') ? '&' : '?'}compress=1`
      : config.wsUrl

    this.ws = new WebSocket(url)
    // Request binary for potential compressed frames
    this.ws.binaryType = 'blob'

    this.ws.onopen = () => {
      // Attempt authentication if token provider is set (Issue #96)
      if (this.tokenProvider) {
        this.authenticate()
      } else {
        this.setStatus('connected')
        if (this.subscribedPairs.size > 0) {
          this.send({
            action: 'subscribe',
            assetPairs: Array.from(this.subscribedPairs),
          })
        }
      }
    }

    this.ws.onmessage = async (e) => {
      try {
        let text: string
        if (e.data instanceof Blob) {
          // Binary frame — attempt gzip decompression, fall back to plain text
          text = supportsDecompression ? await decompress(e.data) : await e.data.text()
          this.useCompression = true
        } else {
          text = e.data as string
        }
        const msg = JSON.parse(text)

        // Handle auth response (Issue #96)
        if (msg.type === 'auth_response') {
          this.handleAuthResponse(msg as WsAuthResponseMessage)
          return
        }

        this.messageHandlers.forEach((h) => h(msg as WsMessage | WsAuthResponseMessage))
      } catch {
        // ignore malformed messages
      }
    }

    this.ws.onclose = () => {
      this.useCompression = false
      this.isAuthenticated = false
      this.setStatus('disconnected')
      this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  /**
   * Authenticate with the server using a token (Issue #96)
   */
  private async authenticate(): Promise<void> {
    if (!this.tokenProvider || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.setStatus('auth_failed')
      return
    }

    try {
      const token = await this.tokenProvider()
      if (!token) {
        this.setStatus('auth_failed')
        this.ws?.close()
        return
      }

      // Send auth message
      const authMsg: WsAuthMessage = {
        action: 'auth',
        token,
      }
      this.ws.send(JSON.stringify(authMsg))
    } catch (err) {
      console.error('Authentication error:', err)
      this.setStatus('auth_failed')
      this.ws?.close()
    }
  }

  /**
   * Handle authentication response from server (Issue #96)
   */
  private handleAuthResponse(msg: WsAuthResponseMessage): void {
    if (msg.success) {
      this.isAuthenticated = true
      this.setStatus('connected')

      // Subscribe to pairs if we have any
      if (this.subscribedPairs.size > 0) {
        this.send({
          action: 'subscribe',
          assetPairs: Array.from(this.subscribedPairs),
        })
      }
    } else {
      console.error('Authentication failed:', msg.error)
      this.setStatus('auth_failed')
      // On auth failure, close and reconnect (will retry)
      this.ws?.close()
    }
  }

  private scheduleReconnect() {
    if (this.destroyed || this.reconnectTimer) return
    this.setStatus('reconnecting')
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, config.wsReconnectDelay)
  }

  disconnect() {
    this.destroyed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
    this.isAuthenticated = false
    this.setStatus('disconnected')
  }

  send(msg: WsSubscribeMessage | WsUnsubscribeMessage | WsAuthMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  subscribe(pairs: string | string[]) {
    const arr = typeof pairs === 'string' ? [pairs] : pairs
    arr.forEach((p) => this.subscribedPairs.add(p))
    this.send({ action: 'subscribe', assetPairs: arr })
  }

  unsubscribe(pairs: string | string[]) {
    const arr = typeof pairs === 'string' ? [pairs] : pairs
    arr.forEach((p) => this.subscribedPairs.delete(p))
    this.send({ action: 'unsubscribe', assetPairs: arr })
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler)
    return () => this.statusHandlers.delete(handler)
  }

  /** Returns true if the last received frame was compressed */
  get isCompressed(): boolean {
    return this.useCompression
  }

  /** Returns true if authenticated (Issue #96) */
  get authenticated(): boolean {
    return this.isAuthenticated || !this.tokenProvider
  }
}
