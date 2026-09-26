# Anomaly model evaluation

`src/analytics/anomalyEval.ts` builds a seeded corpus (seed 639: 12 windows x 80 ticks; spike, source-drop and clean windows) and scores `detectAnomalies` against labeled anomaly indices. A detection counts as a true positive on the labeled tick or up to 1 tick after.

Chosen thresholds (`CHOSEN_THRESHOLDS`): z-score window 20, z threshold 3, gap 5%, source-drop on.

CI gate (`src/analytics/anomalyEval.test.ts`, run by `npm run test:run`) fails when precision < 0.5, recall < 0.9 or F1 < 0.65 (`REGRESSION_BOUND`). Measured scores: run the test suite or call `evaluate(buildCorpus(), CHOSEN_THRESHOLDS)`; the bounds are set below the measured values with margin. Note: the corpus is synthetic (real labeled history is not available in this repo); the "gap back" tick after a spike is expected to count as a tolerated match, while a source drop that also yields extra flags lowers precision.
