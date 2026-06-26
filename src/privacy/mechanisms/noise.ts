/**
 * Noise mechanisms for local differential privacy (issue #118).
 *
 * All noise is added client-side (local DP) so the server never sees
 * individual contributions.
 *
 * Mechanisms:
 *  - Laplace   – numeric queries (count, sum, average)
 *  - Gaussian  – high-dimensional numeric queries (with (ε,δ)-DP)
 *  - Randomized response – boolean / binary choice data
 *  - Exponential – categorical / ordinal data (not needed for current events,
 *                  included for completeness)
 */

/** Laplace noise: noise ~ Lap(0, sensitivity/epsilon). <1ms per call. */
export function laplace(value: number, sensitivity: number, epsilon: number): number {
  if (epsilon <= 0) throw new RangeError('epsilon must be > 0')
  const b = sensitivity / epsilon
  const u = Math.random() - 0.5
  // Inverse CDF of Laplace: -b * sign(u) * ln(1 - 2|u|)
  return value - b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u))
}

/**
 * Gaussian noise: noise ~ N(0, sigma²) where sigma = sensitivity * sqrt(2 ln(1.25/δ)) / ε.
 * Provides (ε, δ)-DP. Use when ε > 1 or for high-dimensional data.
 */
export function gaussian(value: number, sensitivity: number, epsilon: number, delta: number): number {
  if (epsilon <= 0) throw new RangeError('epsilon must be > 0')
  if (delta <= 0 || delta >= 1) throw new RangeError('delta must be in (0,1)')
  const sigma = (sensitivity * Math.sqrt(2 * Math.log(1.25 / delta))) / epsilon
  // Box-Muller transform
  const u1 = Math.random() || Number.EPSILON
  const u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return value + sigma * z
}

/**
 * Randomized response for boolean data.
 * With probability p = e^ε/(1+e^ε) the true value is reported; otherwise flipped.
 * Returns the reported boolean.
 */
export function randomizedResponse(value: boolean, epsilon: number): boolean {
  if (epsilon <= 0) throw new RangeError('epsilon must be > 0')
  const p = Math.exp(epsilon) / (1 + Math.exp(epsilon))
  return Math.random() < p ? value : !value
}

/**
 * Exponential mechanism for a set of categorical options.
 * Scores must be supplied; higher score = more preferred.
 * Sensitivity is the max difference in score for adjacent databases.
 *
 * Returns the index of the selected option.
 */
export function exponential(scores: number[], sensitivity: number, epsilon: number): number {
  if (epsilon <= 0) throw new RangeError('epsilon must be > 0')
  if (scores.length === 0) throw new RangeError('scores must be non-empty')

  const weights = scores.map((s) => Math.exp((epsilon * s) / (2 * sensitivity)))
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r <= 0) return i
  }
  return weights.length - 1
}
