/**
 * wsSimulator.ts (#475)
 *
 * Dev-only WebSocket degradation simulator. Sits between the real WS
 * connection and the app's message handlers so the UI can be exercised
 * under flood/throttle/drop conditions, and per-source downtime/divergence,
 * without touching a real backend.
 *
 * IMPORTANT: this module (and its UI counterpart, `SimulatePanel.tsx`) must
 * only ever be reached through a dynamic `import()` guarded by
 * `import.meta.env.DEV` — see the call site in `api/websocket.ts` and the
 * mount point in `App.tsx`. `import.meta.env.DEV` is statically replaced
 * with `false` in a production build, which dead-code-eliminates the
 * guarded branch (import call included), so this file is never reachable
 * from — and never bundled into — a production chunk. Do not import it
 * unconditionally from anywhere.
 */
import type { WsMessage } from '../types'

export type SimulationMode = 'off' | 'throttle' | 'flood' | 'drop'
export type SourceEffect = 'downtime' | 'divergence'

export interface SourceTarget {
  source: string
  effect: SourceEffect
  /** Divergence only: price is perturbed by up to this fraction (0.05 = ±5%). */
  magnitude: number
}

export interface SimulationConfig {
  /** Master switch — when false, messages pass through untouched regardless of `mode`. */
  enabled: boolean
  mode: SimulationMode
  /** Delay applied to every message when `mode === 'throttle'`. */
  throttleMs: number
  /** Extra duplicate messages dispatched per real message when `mode === 'flood'`. */
  floodCopies: number
  /** Probability (0..1) a message is silently dropped when `mode === 'drop'`. */
  dropRate: number
  sourceTargets: SourceTarget[]
}

export interface RecordedFrame {
  msg: WsMessage
  /** Milliseconds since recording started. */
  offsetMs: number
}

const DEFAULT_CONFIG: SimulationConfig = {
  enabled: false,
  mode: 'off',
  throttleMs: 1000,
  floodCopies: 5,
  dropRate: 0.3,
  sourceTargets: [],
}

const MAX_RECORDED_FRAMES = 500

let config: SimulationConfig = { ...DEFAULT_CONFIG, sourceTargets: [] }
const listeners = new Set<(c: SimulationConfig) => void>()

let recording = false
let recordStart = 0
let recordedFrames: RecordedFrame[] = []

/**
 * Small deterministic PRNG (xorshift32) used for drop/divergence decisions
 * instead of `Math.random()`. Given the same seed, a sequence of simulated
 * decisions is fully reproducible — useful for tests and for a "replay this
 * exact degraded session" workflow.
 */
let rngState = 0x9e3779b9
function nextRandom(): number {
  rngState ^= rngState << 13
  rngState ^= rngState >>> 17
  rngState ^= rngState << 5
  rngState |= 0
  return (rngState >>> 0) / 0xffffffff
}

/** Reseeds the PRNG. Exposed for deterministic tests. */
export function seedSimulationRandom(seed: number): void {
  rngState = seed || 1
}

// ── Config ───────────────────────────────────────────────────────────────

export function getSimulationConfig(): SimulationConfig {
  return config
}

export function configureSimulation(patch: Partial<SimulationConfig>): void {
  config = { ...config, ...patch }
  listeners.forEach((l) => l(config))
}

export function resetSimulation(): void {
  config = { ...DEFAULT_CONFIG, sourceTargets: [] }
  recording = false
  recordedFrames = []
  listeners.forEach((l) => l(config))
}

export function subscribeSimulation(listener: (c: SimulationConfig) => void): () => void {
  listeners.add(listener)
  listener(config)
  return () => listeners.delete(listener)
}

// ── Source targeting (downtime / divergence) ────────────────────────────

/**
 * Applies every configured source target to one message.
 * - `downtime`: strips the target source from `sources`; if that empties the
 *   list (every contributing source is "down"), the message is dropped
 *   entirely by returning `null`.
 * - `divergence`: perturbs `price` by up to ±`magnitude` as if that source
 *   were feeding a diverging quote into the aggregate.
 */
function applySourceTargets(msg: WsMessage): WsMessage | null {
  if (msg.type !== 'price_update' || config.sourceTargets.length === 0) return msg

  let sources = msg.sources
  let price = msg.price
  let confidence = msg.confidence

  for (const target of config.sourceTargets) {
    if (!msg.sources.includes(target.source)) continue
    if (target.effect === 'downtime') {
      sources = sources.filter((s) => s !== target.source)
      confidence = Math.max(0, confidence - 1 / Math.max(1, msg.sources.length))
    } else {
      const drift = (nextRandom() * 2 - 1) * target.magnitude
      price = price * (1 + drift)
    }
  }

  if (sources.length === 0) return null
  if (sources === msg.sources && price === msg.price && confidence === msg.confidence) return msg
  return { ...msg, sources, price, confidence }
}

// ── Recording ────────────────────────────────────────────────────────────

function recordIfActive(msg: WsMessage): void {
  if (!recording || recordedFrames.length >= MAX_RECORDED_FRAMES) return
  recordedFrames.push({ msg, offsetMs: Date.now() - recordStart })
}

export function startRecording(): void {
  recording = true
  recordStart = Date.now()
  recordedFrames = []
}

/** Stops recording and returns the captured frames. */
export function stopRecording(): RecordedFrame[] {
  recording = false
  return recordedFrames
}

export function isRecording(): boolean {
  return recording
}

export function getRecordedFrames(): RecordedFrame[] {
  return recordedFrames
}

// ── Live interception ────────────────────────────────────────────────────

/**
 * Core interceptor called for every real inbound WS message. Records it
 * (if a recording is in progress), applies source targeting, then the
 * volume-shaping `mode`, dispatching zero or more messages via `dispatch`.
 *
 * Safe to call unconditionally — when `enabled` is false this is a
 * transparent passthrough (still records, so a session can be captured
 * without simulation active).
 */
export function applySimulation(msg: WsMessage, dispatch: (m: WsMessage) => void): void {
  recordIfActive(msg)

  if (!config.enabled) {
    dispatch(msg)
    return
  }

  const transformed = applySourceTargets(msg)
  if (transformed === null) return // every contributing source is simulated "down" — silent drop

  switch (config.mode) {
    case 'drop':
      if (nextRandom() < config.dropRate) return // silent drop
      dispatch(transformed)
      return
    case 'throttle':
      setTimeout(() => dispatch(transformed), config.throttleMs)
      return
    case 'flood':
      dispatch(transformed)
      for (let i = 0; i < config.floodCopies; i++) dispatch(transformed)
      return
    case 'off':
    default:
      dispatch(transformed)
  }
}

// ── Replay engine ────────────────────────────────────────────────────────

export interface ReplayHandle {
  /** Cancels any frames not yet dispatched. */
  stop: () => void
}

/**
 * Deterministic playback of a recorded (or canned) sequence. Every frame is
 * scheduled from the *same* start anchor — never chained off the previous
 * frame's timer — so relative offsets never accumulate drift no matter how
 * busy the event loop is or how long between frames.
 */
export function replaySequence(frames: RecordedFrame[], dispatch: (m: WsMessage) => void): ReplayHandle {
  const timers = frames.map((frame) => setTimeout(() => dispatch(frame.msg), Math.max(0, frame.offsetMs)))
  return {
    stop: () => timers.forEach((t) => clearTimeout(t)),
  }
}

/** A small built-in fixture so the panel has something to replay without recording a live session first. */
export function buildSampleSequence(assetPair = 'BTC/USD'): RecordedFrame[] {
  const base = {
    type: 'price_update' as const,
    assetPair,
    confidence: 0.98,
    sources: ['chainlink', 'redstone'],
  }
  const now = Date.now()
  return [
    { msg: { ...base, price: 50_000, timestamp: now }, offsetMs: 0 },
    { msg: { ...base, price: 50_120, timestamp: now + 500 }, offsetMs: 500 },
    { msg: { ...base, price: 49_800, timestamp: now + 1200 }, offsetMs: 1200 },
    { msg: { ...base, price: 50_050, timestamp: now + 2000 }, offsetMs: 2000 },
  ]
}
