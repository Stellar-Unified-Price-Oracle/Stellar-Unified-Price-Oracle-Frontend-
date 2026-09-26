/**
 * @file Anomaly model evaluation harness (#639).
 *
 * Builds a seeded, replayable labeled corpus of price-history windows and
 * scores `detectAnomalies` against it (precision / recall / F1 / time-to-detect).
 */
import { detectAnomalies, type AnomalyDetectionOptions } from '../utils/anomalyDetection'
import type { PriceHistoryEntry } from '../types/price'

export interface LabeledWindow {
  name: string
  history: PriceHistoryEntry[]
  /** Indices of ticks that are true anomalies. */
  trueAnomalies: number[]
}

export interface EvalScore {
  precision: number
  recall: number
  f1: number
  /** Mean ticks between the true onset and the flagging tick (0 = detected on the tick). */
  meanTimeToDetectTicks: number | null
  tp: number
  fp: number
  fn: number
}

/** mulberry32: small deterministic PRNG. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TICK_MS = 60_000
const SOURCES = ['chainlink', 'redstone', 'band', 'reflector']

/** Build the deterministic corpus. Same seed always yields the same windows. */
export function buildCorpus(seed = 639, windows = 12, length = 80): LabeledWindow[] {
  const rnd = seededRandom(seed)
  const out: LabeledWindow[] = []
  for (let w = 0; w < windows; w++) {
    let price = 100
    const history: PriceHistoryEntry[] = []
    const trueAnomalies: number[] = []
    const kind = w % 3 // 0 spike, 1 source drop, 2 clean (all-negative window)
    const at = 30 + Math.floor(rnd() * 40)
    for (let i = 0; i < length; i++) {
      price = price * (1 + (rnd() - 0.5) * 0.004) // +-0.2% noise
      let sources = SOURCES
      let p = price
      if (kind === 0 && i === at) {
        p = price * (rnd() < 0.5 ? 1.12 : 0.88)
        trueAnomalies.push(i)
      }
      if (kind === 1 && i === at) {
        sources = SOURCES.slice(0, 2)
        trueAnomalies.push(i)
      }
      history.push({ price: p, timestamp: 1_700_000_000_000 + i * TICK_MS, confidence: 0.95, sources })
    }
    out.push({ name: `w${w}-${['spike', 'source-drop', 'clean'][kind]}`, history, trueAnomalies })
  }
  return out
}

/**
 * Evaluate a threshold set over the corpus. A detection is a true positive when it
 * lands on a labeled index or within `tolerance` ticks after it. Spikes also make
 * the following tick a "gap back", which counts as a match within tolerance.
 */
export function evaluate(
  corpus: LabeledWindow[],
  options: AnomalyDetectionOptions = {},
  tolerance = 1,
): EvalScore {
  let tp = 0, fp = 0, fn = 0
  const delays: number[] = []
  for (const w of corpus) {
    const flagged = detectAnomalies(w.history, options).map((a) => a.index)
    const matched = new Set<number>()
    for (const f of flagged) {
      const truth = w.trueAnomalies.find((t) => f >= t && f - t <= tolerance)
      if (truth === undefined) fp++
      else if (!matched.has(truth)) {
        matched.add(truth)
        tp++
        delays.push(f - truth)
      }
    }
    fn += w.trueAnomalies.filter((t) => !matched.has(t)).length
  }
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp)
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn)
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
  const meanTimeToDetectTicks = delays.length ? delays.reduce((s, d) => s + d, 0) / delays.length : null
  return { precision, recall, f1, meanTimeToDetectTicks, tp, fp, fn }
}

/** Documented defaults; see docs/anomaly-evaluation.md. */
export const CHOSEN_THRESHOLDS: AnomalyDetectionOptions = {
  zScoreWindow: 20,
  zScoreThreshold: 3,
  gapThresholdPercent: 5,
  detectSourceDrop: true,
}

/** Documented regression bound: measured score minus this floor fails CI. */
export const REGRESSION_BOUND = { minPrecision: 0.5, minRecall: 0.9, minF1: 0.65 }
