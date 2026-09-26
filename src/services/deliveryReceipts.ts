/**
 * @file Alert delivery receipts, retry and dead-letter tracking (#650).
 *
 * Tracks per-alert, per-channel delivery status (queued -> delivered | failed),
 * retries with exponential backoff, and moves repeatedly failing deliveries to a
 * dead-letter list. Non-2xx webhook responses count as failures. Channels that
 * accumulate consecutive dead letters are flagged so the UI can warn in-app.
 *
 * Assumption: no backend delivery-receipt endpoint exists; the caller supplies a
 * `send` function that resolves with an HTTP-like status (or throws).
 */
import type { NotificationChannelId } from '../types'

export type DeliveryStatus = 'queued' | 'delivered' | 'failed'

export interface DeliveryReceipt {
  alertId: string
  channel: NotificationChannelId
  status: DeliveryStatus
  attempts: number
  lastError?: string
  updatedAt: number
}

export interface DeadLetter extends DeliveryReceipt {
  status: 'failed'
  lastError: string
}

export type SendFn = () => Promise<{ status: number }>

export const MAX_ATTEMPTS = 4
export const BASE_BACKOFF_MS = 500
export const FAILING_CHANNEL_THRESHOLD = 3
const MAX_RECEIPTS = 500

export function backoffMs(attempt: number, base = BASE_BACKOFF_MS): number {
  return base * 2 ** Math.max(0, attempt - 1)
}

/** 2xx is success; everything else (including redirects) is a failure. */
export function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300
}

export class DeliveryTracker {
  private receipts = new Map<string, DeliveryReceipt>()
  private consecutiveDead = new Map<NotificationChannelId, number>()
  private listeners = new Set<() => void>()

  constructor(
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
    private readonly now: () => number = Date.now,
    private readonly maxAttempts = MAX_ATTEMPTS,
  ) {}

  private key(alertId: string, channel: NotificationChannelId) {
    return `${alertId}::${channel}`
  }

  private set(r: DeliveryReceipt) {
    const k = this.key(r.alertId, r.channel)
    this.receipts.delete(k)
    this.receipts.set(k, r)
    while (this.receipts.size > MAX_RECEIPTS) this.receipts.delete(this.receipts.keys().next().value as string)
    this.listeners.forEach((l) => l())
  }

  subscribe(l: () => void): () => void {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }

  async deliver(alertId: string, channel: NotificationChannelId, send: SendFn): Promise<DeliveryReceipt> {
    let receipt: DeliveryReceipt = { alertId, channel, status: 'queued', attempts: 0, updatedAt: this.now() }
    this.set(receipt)
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      let error: string | undefined
      try {
        const res = await send()
        if (isSuccessStatus(res.status)) {
          receipt = { ...receipt, status: 'delivered', attempts: attempt, lastError: undefined, updatedAt: this.now() }
          this.consecutiveDead.set(channel, 0)
          this.set(receipt)
          return receipt
        }
        error = `HTTP ${res.status}`
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
      }
      receipt = { ...receipt, attempts: attempt, lastError: error, updatedAt: this.now() }
      if (attempt < this.maxAttempts) {
        this.set({ ...receipt, status: 'queued' })
        await this.sleep(backoffMs(attempt))
      }
    }
    receipt = { ...receipt, status: 'failed' }
    this.consecutiveDead.set(channel, (this.consecutiveDead.get(channel) ?? 0) + 1)
    this.set(receipt)
    return receipt
  }

  getReceipts(filter?: { alertId?: string; channel?: NotificationChannelId }): DeliveryReceipt[] {
    return [...this.receipts.values()].filter(
      (r) => (!filter?.alertId || r.alertId === filter.alertId) && (!filter?.channel || r.channel === filter.channel),
    )
  }

  getDeadLetters(): DeadLetter[] {
    return this.getReceipts().filter((r): r is DeadLetter => r.status === 'failed' && !!r.lastError)
  }

  /** Channels with enough consecutive dead letters to warrant an in-app warning. */
  getFailingChannels(threshold = FAILING_CHANNEL_THRESHOLD): NotificationChannelId[] {
    return [...this.consecutiveDead.entries()].filter(([, n]) => n >= threshold).map(([c]) => c)
  }
}

export const deliveryTracker = new DeliveryTracker()
