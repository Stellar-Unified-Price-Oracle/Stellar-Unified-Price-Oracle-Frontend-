import { config } from '../config'
import { showApiErrorToast } from '../context/ToastContext'

export type CircuitState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerOptions {
  /** Failures within `windowMs` required to open the circuit. */
  failureThreshold: number
  /** Rolling window in ms over which failures are counted. */
  windowMs: number
  /** How long the circuit stays open before allowing a half-open test request. */
  cooldownMs: number
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = config.circuitBreaker

interface CircuitEntry {
  state: CircuitState
  failureTimestamps: number[]
  cooldownTimer: ReturnType<typeof setTimeout> | null
  halfOpenInFlight: boolean
}

export type CircuitStateListener = (key: string, state: CircuitState) => void

/**
 * Per-endpoint-group circuit breaker.
 *
 * Tracks failures per `key` (an endpoint group, e.g. `/api/prices`). After
 * `failureThreshold` failures within `windowMs`, the circuit opens and
 * `canRequest` returns false for that key until `cooldownMs` has elapsed, at
 * which point a single test request is allowed through (half-open). A
 * successful half-open request closes the circuit; a failed one re-opens it.
 */
class CircuitBreaker {
  private entries = new Map<string, CircuitEntry>()
  private options: CircuitBreakerOptions
  private listeners = new Set<CircuitStateListener>()

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  private getEntry(key: string): CircuitEntry {
    let entry = this.entries.get(key)
    if (!entry) {
      entry = { state: 'closed', failureTimestamps: [], cooldownTimer: null, halfOpenInFlight: false }
      this.entries.set(key, entry)
    }
    return entry
  }

  private setState(key: string, entry: CircuitEntry, state: CircuitState): void {
    if (entry.state === state) return
    entry.state = state
    for (const listener of this.listeners) listener(key, state)

    if (state === 'open') {
      showApiErrorToast(`Repeated failures detected for ${key} — pausing requests temporarily.`)
    } else if (state === 'closed') {
      showApiErrorToast(`Connection to ${key} recovered.`)
    }
  }

  /** Returns whether a request to `key` may be attempted right now. */
  canRequest(key: string): boolean {
    const entry = this.getEntry(key)
    if (entry.state === 'closed') return true
    if (entry.state === 'open') return false
    // half-open: allow exactly one in-flight test request at a time
    if (entry.halfOpenInFlight) return false
    entry.halfOpenInFlight = true
    return true
  }

  /** Records a successful request against `key`. */
  recordSuccess(key: string): void {
    const entry = this.getEntry(key)
    entry.failureTimestamps = []
    entry.halfOpenInFlight = false
    if (entry.cooldownTimer) {
      clearTimeout(entry.cooldownTimer)
      entry.cooldownTimer = null
    }
    this.setState(key, entry, 'closed')
  }

  /** Records a failed request against `key`, possibly opening the circuit. */
  recordFailure(key: string): void {
    const entry = this.getEntry(key)
    entry.halfOpenInFlight = false

    if (entry.state === 'half-open') {
      this.openCircuit(key, entry)
      return
    }

    const now = Date.now()
    entry.failureTimestamps.push(now)
    entry.failureTimestamps = entry.failureTimestamps.filter((t) => now - t <= this.options.windowMs)

    if (entry.failureTimestamps.length >= this.options.failureThreshold) {
      this.openCircuit(key, entry)
    }
  }

  private openCircuit(key: string, entry: CircuitEntry): void {
    this.setState(key, entry, 'open')
    entry.failureTimestamps = []

    if (entry.cooldownTimer) clearTimeout(entry.cooldownTimer)
    entry.cooldownTimer = setTimeout(() => {
      entry.cooldownTimer = null
      this.setState(key, entry, 'half-open')
    }, this.options.cooldownMs)
  }

  /** Returns the current state for `key` (defaults to `closed` if unknown). */
  getState(key: string): CircuitState {
    return this.entries.get(key)?.state ?? 'closed'
  }

  /** Returns a snapshot of every known endpoint group's state, for devtools display. */
  getAllStates(): Record<string, CircuitState> {
    return Object.fromEntries([...this.entries].map(([key, entry]) => [key, entry.state]))
  }

  onStateChange(listener: CircuitStateListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Resets all breaker state. Exposed for test isolation between cases. */
  reset(): void {
    for (const entry of this.entries.values()) {
      if (entry.cooldownTimer) clearTimeout(entry.cooldownTimer)
    }
    this.entries.clear()
  }
}

export class CircuitOpenError extends Error {
  readonly key: string
  constructor(key: string) {
    super(`Circuit breaker is open for ${key}; request blocked.`)
    this.name = 'CircuitOpenError'
    this.key = key
  }
}

export const circuitBreaker = new CircuitBreaker()

/** Derives the circuit-breaker grouping key for a request path, e.g. `/api/prices/BTC/history` -> `/api/prices`. */
export function circuitKeyForPath(path: string): string {
  const clean = path.split('?')[0]
  const parts = clean.split('/').filter(Boolean)
  return '/' + parts.slice(0, 2).join('/')
}
