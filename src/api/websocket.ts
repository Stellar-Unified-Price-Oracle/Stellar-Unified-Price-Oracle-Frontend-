import { config } from '../config'
import type { WsMessage, WsSubscribeMessage, WsUnsubscribeMessage } from '../types'

type MessageHandler = (msg: WsMessage) => void
type StatusHandler = (status: ConnectionStatus) => void

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting'

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
  private useCompression = false

  private _status: ConnectionStatus = 'disconnected'
  get status(): ConnectionStatus {
    return this._status
  }

  private setStatus(status: ConnectionStatus) {
    this._status = status
    this.statusHandlers.forEach((h) => h(status))
  }

  connect() {
    if (this.destroyed) return
    this.setStatus('connecting')

    const url = supportsDecompression
      ? `${config.wsUrl}${config.wsUrl.includes('?') ? '&' : '?'}compress=1`
      : config.wsUrl

    this.ws = new WebSocket(url)
    this.ws.binaryType = 'blob'

    this.ws.onopen = () => {
      this.setStatus('connected')
      if (this.subscribedPairs.size > 0) {
        this.send({
          action: 'subscribe',
          assetPairs: Array.from(this.subscribedPairs),
        })
      }
    }

    this.ws.onmessage = async (e) => {
      try {
        let text: string
        if (e.data instanceof Blob) {
          text = supportsDecompression ? await decompress(e.data) : await e.data.text()
          this.useCompression = true
        } else {
          text = e.data as string
        }
        const msg = JSON.parse(text)
        this.messageHandlers.forEach((h) => h(msg as WsMessage))
      } catch {
        // ignore malformed messages
      }
    }

    this.ws.onclose = () => {
      this.useCompression = false
      this.setStatus('disconnected')
      this.scheduleReconnect()
    }

    this.ws.onerror = () => {
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
    this.setStatus('disconnected')
  }

  send(msg: WsSubscribeMessage | WsUnsubscribeMessage) {
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

  get isCompressed(): boolean {
    return this.useCompression
  }
}
