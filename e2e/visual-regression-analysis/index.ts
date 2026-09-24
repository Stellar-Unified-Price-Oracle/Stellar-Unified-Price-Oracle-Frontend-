/**
 * Visual Regression Analysis Toolkit
 *
 * Exports all diagnostic tools for analyzing visual regression diffs,
 * detecting flakes, and generating actionable reports.
 */

export { DiffAnalyzer } from './DiffAnalyzer'
export { FlakeDetector } from './FlakeDetector'
export { ReportGenerator, type ReportGeneratorOptions } from './ReportGenerator'
export type {
  ChangeAnalysis,
  ChangedRegion,
  ChangeSeverity,
  FlakeMetadata,
  GpuVariance,
  VisualRegressionReport,
  VisualRegressionReportBatch,
} from './types'
