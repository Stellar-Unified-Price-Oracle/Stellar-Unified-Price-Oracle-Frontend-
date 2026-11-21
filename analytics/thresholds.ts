// Anomaly detection thresholds.
//
// These values are consumed by the anomaly evaluator and validated by the CI
// gate in `analytics/anomalyEval.test.ts` ('CI gate: chosen thresholds stay
// within the documented bound'). The gate requires the chosen thresholds to
// keep precision >= 0.5 on the replayed fixture corpus.
//
// History: the previous precision threshold of 0.5 combined with the looser
// score cutoff produced precision ~0.29 on the replayed history (issue #963).
// Raising the score cutoff to 0.6 filters the low-confidence detections that
// were dragging precision down, restoring precision above the documented 0.5
// bound without changing the fixture corpus.

export interface AnomalyThresholds {
  /** Minimum anomaly score for a detection to be reported. */
  scoreCutoff: number;
  /** Minimum precision the chosen thresholds must achieve in the CI gate. */
  precisionBound: number;
  /** Minimum recall the chosen thresholds must achieve in the CI gate. */
  recallBound: number;
}

export const DEFAULT_ANOMALY_THRESHOLDS: AnomalyThresholds = {
  scoreCutoff: 0.6,
  precisionBound: 0.5,
  recallBound: 0.4,
};

export function getAnomalyThresholds(
  overrides: Partial<AnomalyThresholds> = {},
): AnomalyThresholds {
  return { ...DEFAULT_ANOMALY_THRESHOLDS, ...overrides };
}
