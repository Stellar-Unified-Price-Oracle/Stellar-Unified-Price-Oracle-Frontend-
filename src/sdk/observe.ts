import type { PriceData } from '../types'
import { StreamClient, type StreamStatus, type StreamClientOptions } from './stream'

export type PriceObserver = (price: PriceData) => void

/**
 * Framework-free observer hub. Ref-counts subscriptions per pair so N observers of one
 * pair produce a single upstream subscribe. The socket is created lazily on first subscribe.
 */
export class PriceHub {
  private client: StreamClient | null = null
  private readonly observers = new Map<string, Set<PriceObserver>>()
  private readonly statusObservers = new Set<(s: StreamStatus) => void>()
  private readonly latest = new Map<string, PriceData>()
  private current: StreamStatus = 'idle'

  constructor(private readonly options: Omit<StreamClientOptions, 'pairs'>) {}

  get status(): StreamStatus { return this.current }
  getLatest(pair: string): PriceData | undefined { return this.latest.get(pair) }
  /** Number of active observers for a pair (exposed for tests/diagnostics). */
  refCount(pair: string): number { return this.observers.get(pair)?.size ?? 0 }

  private ensure(): StreamClient {
    if (this.client) return this.client
    const c = new StreamClient({ ...this.options, pairs: [] })
    c.on('status', (s) => { this.current = s; this.statusObservers.forEach((f) => f(s)) })
    c.on('price', (p) => {
      this.latest.set(p.assetPair, p)
      this.observers.get(p.assetPair)?.forEach((f) => f(p))
    })
    this.client = c
    c.connect()
    return c
  }

  subscribe(pair: string, observer: PriceObserver): () => void {
    let set = this.observers.get(pair)
    const first = !set
    if (!set) { set = new Set(); this.observers.set(pair, set) }
    set.add(observer)
    const client = this.ensure()
    if (first) client.subscribe(pair)
    let done = false
    return () => {
      if (done) return
      done = true
      set.delete(observer)
      if (set.size === 0) {
        this.observers.delete(pair)
        this.client?.unsubscribe(pair)
        if (this.observers.size === 0) { this.client?.close(); this.client = null; this.current = 'idle' }
      }
    }
  }

  onStatus(observer: (s: StreamStatus) => void): () => void {
    this.statusObservers.add(observer)
    return () => { this.statusObservers.delete(observer) }
  }
}

export const observe = (hub: PriceHub, pair: string, observer: PriceObserver) => hub.subscribe(pair, observer)
