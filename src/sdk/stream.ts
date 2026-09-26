import type { PriceData } from '../types'
import { computeDelay, DEFAULT_RETRY_POLICY, type RetryPolicy } from './retry'

export type StreamStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed'

export interface StreamEventMap {
  price: PriceData
  heartbeat: { timestamp: number }
  status: StreamStatus
  error: Error
}

/** Minimal socket surface so a non-WebSocket transport (e.g. SSE, #471) can be plugged in. */
export interface StreamSocket {
  send(data: string): void
  close(): void
  onopen: ((event: unknown) => void) | null
  onclose: ((event: unknown) => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onerror: ((event: unknown) => void) | null
}
export type StreamTransport = (url: string) => StreamSocket

export interface StreamClientOptions {
  url: string
  pairs: string[]
  /** Defaults to global WebSocket. */
  transport?: StreamTransport
  retry?: Partial<RetryPolicy>
  random?: () => number
}

export type ParsedFrame =
  | { type: 'price'; data: PriceData }
  | { type: 'heartbeat'; data: { timestamp: number } }

/** Validates an inbound frame; returns null when malformed or unknown. */
export function parseFrame(raw: unknown): ParsedFrame | null {
  let v: unknown = raw
  if (typeof raw === 'string') {
    try { v = JSON.parse(raw) } catch { return null }
  }
  if (typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  if (o.type === 'heartbeat') {
    return { type: 'heartbeat', data: { timestamp: typeof o.timestamp === 'number' ? o.timestamp : Date.now() } }
  }
  if (o.type === 'price_update' || o.type === 'price') {
    const p = (typeof o.data === 'object' && o.data !== null ? o.data : o) as Record<string, unknown>
    if (typeof p.assetPair === 'string' && typeof p.price === 'number' && Number.isFinite(p.price) && typeof p.timestamp === 'number') {
      return { type: 'price', data: p as unknown as PriceData }
    }
  }
  return null
}

type Listener<K extends keyof StreamEventMap> = (payload: StreamEventMap[K]) => void

export class StreamClient {
  private socket: StreamSocket | null = null
  private state: StreamStatus = 'idle'
  private attempt = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private stopped = false
  private readonly listeners: { [K in keyof StreamEventMap]: Set<Listener<K>> } = {
    price: new Set(), heartbeat: new Set(), status: new Set(), error: new Set(),
  }
  private readonly policy: RetryPolicy
  private readonly pairs: Set<string>

  constructor(private readonly options: StreamClientOptions) {
    this.policy = { ...DEFAULT_RETRY_POLICY, maxRetries: Infinity, ...options.retry }
    this.pairs = new Set(options.pairs)
  }

  get status(): StreamStatus { return this.state }

  on<K extends keyof StreamEventMap>(event: K, fn: Listener<K>): () => void {
    this.listeners[event].add(fn)
    return () => { this.listeners[event].delete(fn) }
  }

  connect(): void {
    if (this.socket || this.state === 'closed') return
    this.stopped = false
    this.open()
  }

  subscribe(pair: string): void {
    this.pairs.add(pair)
    this.socket?.send(JSON.stringify({ type: 'subscribe', pairs: [pair] }))
  }
  unsubscribe(pair: string): void {
    if (this.pairs.delete(pair)) this.socket?.send(JSON.stringify({ type: 'unsubscribe', pairs: [pair] }))
  }

  close(): void {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    const s = this.socket
    this.socket = null
    if (s) { s.onopen = s.onclose = s.onmessage = s.onerror = null; s.close() }
    this.setStatus('closed')
  }

  private emit<K extends keyof StreamEventMap>(event: K, payload: StreamEventMap[K]): void {
    this.listeners[event].forEach((fn) => (fn as Listener<K>)(payload))
  }
  private setStatus(s: StreamStatus): void {
    if (this.state === s) return
    this.state = s
    this.emit('status', s)
  }

  private open(): void {
    this.setStatus(this.attempt === 0 ? 'connecting' : 'reconnecting')
    const make = this.options.transport ?? ((u: string) => new WebSocket(u) as unknown as StreamSocket)
    const socket = make(this.options.url)
    this.socket = socket
    socket.onopen = () => {
      this.attempt = 0
      this.setStatus('connected')
      if (this.pairs.size) socket.send(JSON.stringify({ type: 'subscribe', pairs: [...this.pairs] }))
    }
    socket.onmessage = (ev) => {
      const frame = parseFrame(ev.data)
      if (!frame) return
      if (frame.type === 'price') this.emit('price', frame.data)
      else this.emit('heartbeat', frame.data)
    }
    socket.onerror = () => this.emit('error', new Error('Stream transport error'))
    socket.onclose = () => {
      this.socket = null
      if (this.stopped) return
      const delay = computeDelay(this.policy, this.attempt, null, this.options.random ?? Math.random)
      this.attempt += 1
      this.setStatus('reconnecting')
      this.timer = setTimeout(() => this.open(), delay)
    }
  }
}
