import type { PriceData, PriceHistoryResponse } from '../types'

export interface RateLimitState { limit: number | null; remaining: number | null; reset: number | null; retryAfterMs: number | null; headers: Readonly<Record<string, string>> }
export interface TokenBucketOptions { capacity: number; refillPerSecond: number }
export interface OracleClientOptions { baseUrl?: string; fetch?: typeof globalThis.fetch; maxRetries?: number; jitterRatio?: number; sleep?: (ms: number) => Promise<void>; random?: () => number; limiter?: TokenBucketOptions; onRateLimitChange?: (state: RateLimitState) => void }
export interface AlertInput { assetPair: string; upperThreshold?: number; lowerThreshold?: number; percentageThreshold?: number; percentageDirection?: 'up' | 'down' | 'either'; percentageWindow?: '5min' | '15min' | '1hr' | '24hr' }

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
function retryAfterMs(value: string | null): number { if (!value) return 0; const seconds = Number(value); if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000); const date = Date.parse(value); return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0 }

class TokenBucket {
  private tokens: number
  private updatedAt = Date.now()
  private queue: Promise<void> = Promise.resolve()
  constructor(private readonly options: TokenBucketOptions) { this.tokens = options.capacity }
  acquire(): Promise<void> { const next = this.queue.then(async () => { while (true) { const now = Date.now(); this.tokens = Math.min(this.options.capacity, this.tokens + ((now - this.updatedAt) / 1000) * this.options.refillPerSecond); this.updatedAt = now; if (this.tokens >= 1) { this.tokens -= 1; return } await defaultSleep(Math.ceil(((1 - this.tokens) / this.options.refillPerSecond) * 1000)) } }); this.queue = next.catch(() => undefined); return next }
}

export class OracleClient {
  private readonly baseUrl: string
  private readonly fetcher: typeof globalThis.fetch
  private readonly maxRetries: number
  private readonly jitterRatio: number
  private readonly sleep: (ms: number) => Promise<void>
  private readonly random: () => number
  private readonly limiter?: TokenBucket
  private readonly rateLimitListeners = new Set<(state: RateLimitState) => void>()
  private rateLimit: RateLimitState = { limit: null, remaining: null, reset: null, retryAfterMs: null, headers: {} }
  constructor(options: OracleClientOptions = {}) { this.baseUrl = (options.baseUrl ?? '').replace(/\/$/, ''); this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis); this.maxRetries = Math.max(0, options.maxRetries ?? 3); this.jitterRatio = Math.max(0, options.jitterRatio ?? 0.2); this.sleep = options.sleep ?? defaultSleep; this.random = options.random ?? Math.random; this.limiter = options.limiter ? new TokenBucket(options.limiter) : undefined; if (options.onRateLimitChange) this.rateLimitListeners.add(options.onRateLimitChange) }
  get rateLimitState(): RateLimitState { return this.rateLimit }
  onRateLimitChange(listener: (state: RateLimitState) => void): () => void { this.rateLimitListeners.add(listener); return () => this.rateLimitListeners.delete(listener) }
  async getPrice(pair: string): Promise<PriceData> { return this.request<PriceData>(`/api/prices/${encodeURIComponent(pair)}`) }
  async getPrices(): Promise<PriceData[]> { return this.request<PriceData[]>('/api/prices') }
  async getHistory(pair: string, limit = 100, offset = 0): Promise<PriceHistoryResponse> { return this.request<PriceHistoryResponse>(`/api/prices/${encodeURIComponent(pair)}/history?limit=${limit}&offset=${offset}`) }
  async createAlert(input: AlertInput): Promise<unknown> { return this.request('/api/alerts', { method: 'POST', body: JSON.stringify(input) }) }
  subscribe(pairs: string[], onPrice: (price: PriceData) => void): () => void { const socket = new WebSocket(this.baseUrl.replace(/^http/, 'ws') + '/ws'); const open = () => socket.send(JSON.stringify({ type: 'subscribe', pairs })); const message = (event: MessageEvent<string>) => { try { const data: unknown = JSON.parse(event.data); if (typeof data === 'object' && data !== null && 'type' in data && data.type === 'price_update') onPrice(data as PriceData) } catch { /* Ignore malformed events. */ } }; socket.addEventListener('open', open); socket.addEventListener('message', message); return () => { socket.removeEventListener('open', open); socket.removeEventListener('message', message); socket.close() } }
  private async request<T>(path: string, init?: RequestInit): Promise<T> { let attempt = 0; while (true) { await this.limiter?.acquire(); const response = await this.fetcher(`${this.baseUrl}${path}`, { ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init?.headers } }); this.captureRateLimit(response); if (response.ok) return (await response.json()) as T; if ((response.status !== 429 && response.status !== 503) || attempt >= this.maxRetries) throw new Error(`Oracle API request failed (${response.status} ${response.statusText})`); const serverDelay = retryAfterMs(response.headers.get('retry-after')); const exponential = 250 * 2 ** attempt; await this.sleep(Math.max(serverDelay, exponential + exponential * this.jitterRatio * this.random())); attempt += 1 } }
  private captureRateLimit(response: Response): void { const headers: Record<string, string> = {}; response.headers.forEach((value, key) => { if (key.toLowerCase().startsWith('x-ratelimit-') || key.toLowerCase() === 'retry-after') headers[key] = value }); const next: RateLimitState = { limit: Number(response.headers.get('x-ratelimit-limit')) || null, remaining: Number(response.headers.get('x-ratelimit-remaining')) || null, reset: Number(response.headers.get('x-ratelimit-reset')) || null, retryAfterMs: retryAfterMs(response.headers.get('retry-after')) || null, headers }; this.rateLimit = next; this.rateLimitListeners.forEach((listener) => listener(next)) }
}
