/**
 * Visual Regression Analysis Types
 *
 * Defines the structure of diff analysis reports, change detection, and flake metadata.
 */

/** Pixel coordinates and dimensions of a changed region. */
export interface ChangedRegion {
  x: number
  y: number
  width: number
  height: number
  /** Percentage of pixels that changed in this region (0–100). */
  changePercentage: number
}

/** Severity classification for a visual change. */
export type ChangeSeverity = 'cosmetic' | 'layout' | 'critical'

/** Analysis of a single visual change. */
export interface ChangeAnalysis {
  /** Bounding box of the changed region(s). */
  region: ChangedRegion
  /** Severity: cosmetic (colors, shadows) vs layout (positioning, size) vs critical (rendering). */
  severity: ChangeSeverity
  /** Component names/selectors likely affected (from CSS class inspection). */
  affectedComponents: string[]
  /** Likely CSS properties that changed (e.g., "font-size, margin, color"). */
  likelyCauses: string[]
  /** Confidence score 0–1 that this diagnosis is correct. */
  confidence: number
  /** Human-readable description of the change. */
  description: string
}

/** GPU/OS-specific variance metadata. */
export interface GpuVariance {
  os: 'windows' | 'macos' | 'linux'
  gpu: string
  /** Observed diff pixel ratio on this platform. */
  observedDiffRatio: number
  /** Recommended threshold for this platform. */
  recommendedThreshold: number
  sampleCount: number
}

/** Flake detection and tracking metadata. */
export interface FlakeMetadata {
  /** Test name that exhibited flake. */
  testName: string
  /** How often this test fails inconsistently (0–1). */
  flakeRate: number
  /** Likely root cause: GPU variance, timing, animation, network. */
  likelyCause: 'gpu-variance' | 'timing' | 'animation' | 'network' | 'font-loading' | 'unknown'
  /** For GPU variance flakes, per-OS thresholds. */
  gpuVariances?: GpuVariance[]
  /** Last occurrence timestamp. */
  lastOccurrence: number
  /** Count of flake occurrences in history. */
  flakeCount: number
}

/** Complete visual regression analysis report. */
export interface VisualRegressionReport {
  /** Test name (e.g., "dashboard-dark-mobile"). */
  test: string
  /** Path to baseline snapshot. */
  baseline: string
  /** Path to current screenshot. */
  current: string
  /** Path to diff visualization (if Playwright generated it). */
  diff?: string
  /** Overall diff pixel ratio. */
  diffPixelRatio: number
  /** Detected changes with analysis. */
  changes: ChangeAnalysis[]
  /** Overall severity: max of all changes. */
  overallSeverity: ChangeSeverity
  /** Whether this test exhibits flake. */
  flakeDetected: boolean
  /** Flake metadata if detected. */
  flakeMetadata?: FlakeMetadata
  /** Recommended action for developer. */
  recommendedAction: string
  /** Timestamp of analysis. */
  timestamp: number
  /** Playwright test info (browser, viewport, colorScheme). */
  context: {
    browser: 'chromium' | 'firefox' | 'webkit'
    viewport: { width: number; height: number }
    colorScheme: 'light' | 'dark'
  }
}

/** Batch report of multiple test analyses. */
export interface VisualRegressionReportBatch {
  /** Batch ID (e.g., git commit SHA). */
  id: string
  /** Total tests analyzed. */
  totalTests: number
  /** Tests with changes. */
  testsWithChanges: number
  /** Tests that passed (no changes). */
  testsPassed: number
  /** Tests with detected flake. */
  testsWithFlake: number
  /** Individual test reports. */
  reports: VisualRegressionReport[]
  /** Summary statistics. */
  stats: {
    avgDiffRatio: number
    maxDiffRatio: number
    criticalChangeCount: number
    layoutChangeCount: number
    cosmeticChangeCount: number
  }
  timestamp: number
}
