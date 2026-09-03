/**
 * Visual Regression Flake Detector
 *
 * Identifies tests that exhibit non-deterministic behavior (flakes):
 * - GPU/OS-specific variance (same screenshot differs on Linux vs macOS)
 * - Timing-related flakes (animations, WebSocket updates)
 * - Font loading delays
 * - Network timing inconsistencies
 *
 * Maintains a flake history to track patterns and recommend fixes.
 */

import type { FlakeMetadata, GpuVariance } from './types'

export class FlakeDetector {
  /**
   * In-memory store of flake history (in production, use persistent storage).
   * Key: test name, Value: array of observed diff ratios and metadata.
   */
  private flakeHistory = new Map<
    string,
    Array<{
      diffRatio: number
      timestamp: number
      os: string
      gpu: string
      passed: boolean
    }>
  >()

  /**
   * Register an observation of a test result.
   * Multiple calls per test enable flake detection (same test, different results).
   */
  registerObservation(
    testName: string,
    diffRatio: number,
    passed: boolean,
    context: {
      os: 'windows' | 'macos' | 'linux'
      gpu: string
      timestamp: number
    },
  ): void {
    if (!this.flakeHistory.has(testName)) {
      this.flakeHistory.set(testName, [])
    }

    this.flakeHistory.get(testName)!.push({
      diffRatio,
      timestamp: context.timestamp,
      os: context.os,
      gpu: context.gpu,
      passed,
    })
  }

  /**
   * Analyze all observations for a test to detect flake patterns.
   */
  analyzeFlake(testName: string): FlakeMetadata | null {
    const observations = this.flakeHistory.get(testName)
    if (!observations || observations.length < 2) {
      return null // Need at least 2 observations
    }

    // Compute flake rate: ratio of non-passed runs
    const failureCount = observations.filter((o) => !o.passed).length
    const flakeRate = failureCount / observations.length

    if (flakeRate < 0.05) {
      return null // <5% failure rate = not a flake
    }

    // Determine likely cause by analyzing patterns
    const likelyCause = this.detectFlakelyCause(observations)

    // For GPU variance flakes, collect per-OS stats
    const gpuVariances = likelyCause === 'gpu-variance' ? this.analyzeGpuVariance(observations) : undefined

    return {
      testName,
      flakeRate,
      likelyCause,
      gpuVariances,
      lastOccurrence: Math.max(...observations.map((o) => o.timestamp)),
      flakeCount: failureCount,
    }
  }

  /**
   * Detect likely root cause of flake by analyzing observation patterns.
   */
  private detectFlakelyCause(
    observations: Array<{
      diffRatio: number
      os: string
      gpu: string
      passed: boolean
    }>,
  ): FlakeMetadata['likelyCause'] {
    // Group observations by OS/GPU
    const byOS = new Map<string, typeof observations>()
    for (const obs of observations) {
      const key = obs.os
      if (!byOS.has(key)) byOS.set(key, [])
      byOS.get(key)!.push(obs)
    }

    // GPU variance flake: same test fails on certain OS/GPU combos only
    let osWithConsistentFailure = 0
    for (const [_, osObs] of byOS) {
      const osFailureRate = osObs.filter((o) => !o.passed).length / osObs.length
      if (osFailureRate > 0.5) {
        osWithConsistentFailure++
      }
    }

    if (osWithConsistentFailure > 0 && byOS.size > 1) {
      // Failure consistent on specific OS = GPU variance
      return 'gpu-variance'
    }

    // Timing-related flake: random failures, similar diff ratio
    const failedRatios = observations.filter((o) => !o.passed).map((o) => o.diffRatio)
    const passedRatios = observations.filter((o) => o.passed).map((o) => o.diffRatio)

    if (failedRatios.length > 0 && passedRatios.length > 0) {
      const failedAvg = failedRatios.reduce((a, b) => a + b) / failedRatios.length
      const passedAvg = passedRatios.reduce((a, b) => a + b) / passedRatios.length

      if (Math.abs(failedAvg - passedAvg) < 0.05) {
        // Similar diff ratios when passing vs failing = timing/network issue
        return 'timing'
      }
    }

    return 'unknown'
  }

  /**
   * Analyze GPU variance across OS/GPU combinations.
   * Returns recommended thresholds per platform.
   */
  private analyzeGpuVariance(
    observations: Array<{
      diffRatio: number
      os: string
      gpu: string
      passed: boolean
    }>,
  ): GpuVariance[] {
    const byGpu = new Map<string, typeof observations>()

    for (const obs of observations) {
      const key = `${obs.os}/${obs.gpu}`
      if (!byGpu.has(key)) byGpu.set(key, [])
      byGpu.get(key)!.push(obs)
    }

    return Array.from(byGpu.entries()).map(([key, gpuObs]) => {
      const [os, gpu] = key.split('/') as ['windows' | 'macos' | 'linux', string]

      // Max diff ratio observed on this GPU
      const maxDiff = Math.max(...gpuObs.map((o) => o.diffRatio))

      // Recommended threshold: 1.5x the worst observed diff, with minimum safety margin
      const recommendedThreshold = Math.max(0.03, maxDiff * 1.5)

      return {
        os,
        gpu,
        observedDiffRatio: maxDiff,
        recommendedThreshold,
        sampleCount: gpuObs.length,
      }
    })
  }

  /**
   * Suggest a fix strategy based on flake type.
   */
  suggestFixStrategy(flake: FlakeMetadata): string {
    switch (flake.likelyCause) {
      case 'gpu-variance':
        if (flake.gpuVariances && flake.gpuVariances.length > 0) {
          const worstOs = flake.gpuVariances[0].os
          const threshold = flake.gpuVariances[0].recommendedThreshold
          return (
            `GPU variance detected on ${worstOs}. ` +
            `Consider increasing maxDiffPixelRatio to ${(threshold * 100).toFixed(1)}% for this test. ` +
            `Alternatively, update baselines on all target platforms.`
          )
        }
        return 'GPU variance detected. Use platform-specific thresholds.'

      case 'timing':
        return (
          'Timing-related flake detected. ' +
          'Add explicit waits (e.g., waitForLoadState, waitFor animations). ' +
          'Check for WebSocket updates or network delays.'
        )

      case 'animation':
        return (
          'Animation-related flake detected. ' +
          'The stableScreenshot helper may not be freezing all animations. ' +
          'Verify CSS animations are disabled: animation-duration: 0s !important'
        )

      case 'font-loading':
        return (
          'Font loading inconsistency detected. ' +
          'Add explicit wait: await page.evaluate(() => document.fonts.ready). ' +
          'Consider preloading critical fonts.'
        )

      case 'network':
        return (
          'Network timing flake detected. ' +
          'Use waitForLoadState("networkidle") before screenshot. ' +
          'Consider mocking API responses for visual tests.'
        )

      default:
        return 'Unknown flake cause. Review test logs and consider enabling detailed tracing.'
    }
  }

  /**
   * Get the recommended maxDiffPixelRatio for a test based on flake history.
   */
  getRecommendedThreshold(testName: string): number {
    const flake = this.analyzeFlake(testName)
    if (!flake) {
      return 0.02 // Default: 2%
    }

    if (flake.gpuVariances && flake.gpuVariances.length > 0) {
      // Use the worst-case GPU threshold
      return Math.max(...flake.gpuVariances.map((v) => v.recommendedThreshold))
    }

    // For other flake types, increase default tolerance
    return 0.05 // 5% for flaky tests
  }

  /**
   * Generate a report of all detected flakes.
   */
  generateFlakeReport(): Record<string, FlakeMetadata> {
    const report: Record<string, FlakeMetadata> = {}

    for (const [testName] of this.flakeHistory) {
      const flake = this.analyzeFlake(testName)
      if (flake) {
        report[testName] = flake
      }
    }

    return report
  }

  /**
   * Clear history for a specific test.
   */
  clearHistory(testName: string): void {
    this.flakeHistory.delete(testName)
  }

  /**
   * Export history for persistence (JSON serialization).
   */
  exportHistory(): Record<string, object> {
    const exported: Record<string, object> = {}

    for (const [testName, observations] of this.flakeHistory) {
      exported[testName] = observations
    }

    return exported
  }

  /**
   * Import history from persisted storage.
   */
  importHistory(
    data: Record<
      string,
      Array<{
        diffRatio: number
        timestamp: number
        os: string
        gpu: string
        passed: boolean
      }>
    >,
  ): void {
    for (const [testName, observations] of Object.entries(data)) {
      this.flakeHistory.set(testName, observations)
    }
  }
}
