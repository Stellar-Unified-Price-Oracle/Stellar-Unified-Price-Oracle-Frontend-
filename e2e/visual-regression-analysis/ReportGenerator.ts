/**
 * Visual Regression Report Generator
 *
 * Synthesizes DiffAnalyzer and FlakeDetector results into actionable reports
 * that developers can use to diagnose and fix visual regressions.
 *
 * Output formats:
 * - JSON: machine-readable analysis for CI integration
 * - HTML: interactive visual report with side-by-side diffs
 * - Markdown: summary for GitHub PR comments
 */

import type { VisualRegressionReport, VisualRegressionReportBatch, ChangeAnalysis, FlakeMetadata } from './types'
import { DiffAnalyzer } from './DiffAnalyzer'
import { FlakeDetector } from './FlakeDetector'

export interface ReportGeneratorOptions {
  /** Output directory for reports. */
  outputDir: string
  /** Include detailed pixel analysis. */
  includePixelData?: boolean
  /** Generate HTML visualization. */
  generateHtml?: boolean
  /** Threshold for what counts as a failure (0–1). */
  failureThreshold?: number
}

export class ReportGenerator {
  private diffAnalyzer = new DiffAnalyzer()
  private flakeDetector = new FlakeDetector()
  private options: ReportGeneratorOptions

  constructor(options: ReportGeneratorOptions) {
    this.options = {
      includePixelData: true,
      generateHtml: true,
      failureThreshold: 0.02,
      ...options,
    }
  }

  /**
   * Generate a comprehensive report for a single test.
   */
  async generateTestReport(
    testName: string,
    baselineImagePath: string,
    currentImagePath: string,
    diffImagePath: string | undefined,
    context: {
      browser: 'chromium' | 'firefox' | 'webkit'
      viewport: { width: number; height: number }
      colorScheme: 'light' | 'dark'
      os: 'windows' | 'macos' | 'linux'
      gpu: string
    },
  ): Promise<VisualRegressionReport> {
    // In production, load actual image buffers from files
    // For now, use stub data
    const baselineBuffer = Buffer.alloc(0)
    const currentBuffer = Buffer.alloc(0)

    // Load and analyze
    await this.diffAnalyzer.loadImages(baselineBuffer, currentBuffer)
    const diffRatio = this.diffAnalyzer.computeDiffRatio()
    const regions = this.diffAnalyzer.detectChangedRegions()
    const analyses = this.diffAnalyzer.generateAnalysis(diffRatio, regions)

    // Check for flakes
    this.flakeDetector.registerObservation(
      testName,
      diffRatio,
      diffRatio <= (this.options.failureThreshold ?? 0.02),
      { os: context.os, gpu: context.gpu, timestamp: Date.now() },
    )

    const flakeMetadata = this.flakeDetector.analyzeFlake(testName)

    // Determine overall severity
    const overallSeverity =
      analyses.length === 0
        ? ('cosmetic' as const)
        : analyses.reduce((max, a) => {
            const severity = { cosmetic: 0, layout: 1, critical: 2 }
            return severity[a.severity] > severity[max] ? a.severity : max
          }, ('cosmetic' as const))

    // Generate recommendation
    const recommendedAction = this.generateRecommendation(
      testName,
      diffRatio,
      overallSeverity,
      analyses,
      flakeMetadata,
    )

    return {
      test: testName,
      baseline: baselineImagePath,
      current: currentImagePath,
      diff: diffImagePath,
      diffPixelRatio: diffRatio,
      changes: analyses,
      overallSeverity,
      flakeDetected: flakeMetadata !== null,
      flakeMetadata,
      recommendedAction,
      timestamp: Date.now(),
      context,
    }
  }

  /**
   * Generate batch report from multiple test results.
   */
  async generateBatchReport(
    batchId: string,
    reports: VisualRegressionReport[],
  ): Promise<VisualRegressionReportBatch> {
    const stats = {
      avgDiffRatio: reports.reduce((sum, r) => sum + r.diffPixelRatio, 0) / reports.length || 0,
      maxDiffRatio: Math.max(...reports.map((r) => r.diffPixelRatio), 0),
      criticalChangeCount: reports.filter((r) => r.overallSeverity === 'critical').length,
      layoutChangeCount: reports.filter((r) => r.overallSeverity === 'layout').length,
      cosmeticChangeCount: reports.filter((r) => r.overallSeverity === 'cosmetic').length,
    }

    return {
      id: batchId,
      totalTests: reports.length,
      testsWithChanges: reports.filter((r) => r.diffPixelRatio > 0).length,
      testsPassed: reports.filter((r) => r.diffPixelRatio <= (this.options.failureThreshold ?? 0.02))
        .length,
      testsWithFlake: reports.filter((r) => r.flakeDetected).length,
      reports,
      stats,
      timestamp: Date.now(),
    }
  }

  /**
   * Generate actionable recommendation for developer.
   */
  private generateRecommendation(
    testName: string,
    diffRatio: number,
    severity: string,
    analyses: ChangeAnalysis[],
    flakeMetadata: FlakeMetadata | null,
  ): string {
    if (flakeMetadata) {
      // This test exhibits flake
      const fixStrategy = this.flakeDetector.suggestFixStrategy(flakeMetadata)
      return `⚠️  Flaky test detected: ${fixStrategy}`
    }

    if (diffRatio <= (this.options.failureThreshold ?? 0.02)) {
      // No significant change
      return '✅ No significant visual change detected.'
    }

    if (severity === 'cosmetic') {
      if (analyses.length > 0) {
        const causes = analyses[0].likelyCauses.join(', ')
        return (
          `📝 Minor visual change detected (${causes}). ` +
          `Review the diff to confirm it's intentional, then update baselines: npm run test:e2e:visual:update`
        )
      }
      return '📝 Minor visual change. Review and approve if intentional.'
    }

    if (severity === 'layout') {
      const components = analyses.map((a) => a.affectedComponents.join(', ')).filter((c) => c)[0] || 'components'
      return (
        `⚠️  Layout change detected in ${components}. ` +
        `Verify this is intentional, then update baselines. `
      )
    }

    // Critical
    return (
      `🚨 Critical rendering issue detected! ` +
      `This is likely not intentional. Review CSS changes in this PR, then update baselines if correct.`
    )
  }

  /**
   * Format report as markdown for GitHub PR comment.
   */
  formatAsMarkdown(batch: VisualRegressionReportBatch): string {
    const lines: string[] = []

    lines.push('## Visual Regression Analysis')
    lines.push('')

    // Summary stats
    lines.push('### Summary')
    lines.push(`- **Total tests**: ${batch.totalTests}`)
    lines.push(`- **Passed**: ${batch.testsPassed}`)
    lines.push(`- **Changes detected**: ${batch.testsWithChanges}`)
    lines.push(`- **Flaky tests**: ${batch.testsWithFlake}`)
    lines.push(`- **Max diff**: ${(batch.stats.maxDiffRatio * 100).toFixed(2)}%`)
    lines.push('')

    // Change breakdown
    lines.push('### Changes by Severity')
    lines.push(`- 🔴 Critical: ${batch.stats.criticalChangeCount}`)
    lines.push(`- 🟡 Layout: ${batch.stats.layoutChangeCount}`)
    lines.push(`- 🟢 Cosmetic: ${batch.stats.cosmeticChangeCount}`)
    lines.push('')

    // Individual test results (failures only)
    const failures = batch.reports.filter((r) => r.diffPixelRatio > (this.options.failureThreshold ?? 0.02))
    if (failures.length > 0) {
      lines.push('### Failed Tests')
      lines.push('')

      for (const report of failures) {
        const emoji = {
          cosmetic: '🟢',
          layout: '🟡',
          critical: '🔴',
        }[report.overallSeverity]

        lines.push(`#### ${emoji} ${report.test}`)
        lines.push(`Diff: **${(report.diffPixelRatio * 100).toFixed(2)}%**`)

        if (report.changes.length > 0) {
          const firstChange = report.changes[0]
          lines.push(`- Region: (${firstChange.region.x}, ${firstChange.region.y}) ${firstChange.region.width}×${firstChange.region.height}`)
          lines.push(`- Likely causes: ${firstChange.likelyCauses.join(', ')}`)
          lines.push(`- Components: ${firstChange.affectedComponents.join(', ')}`)
        }

        lines.push(`- ${report.recommendedAction}`)
        lines.push('')
      }
    }

    // Flaky tests
    if (batch.testsWithFlake > 0) {
      lines.push('### Flaky Tests (Non-Deterministic)')
      lines.push('')

      for (const report of batch.reports.filter((r) => r.flakeDetected)) {
        lines.push(`- **${report.test}**: ${report.flakeMetadata?.likelyCause}`)
        lines.push(`  ${this.flakeDetector.suggestFixStrategy(report.flakeMetadata!)}`)
      }

      lines.push('')
    }

    // Action items
    lines.push('### Recommended Actions')
    lines.push('')
    if (batch.stats.criticalChangeCount > 0) {
      lines.push(`1. 🔴 Review ${batch.stats.criticalChangeCount} critical change(s)`)
    }
    if (batch.stats.layoutChangeCount > 0) {
      lines.push(`2. 🟡 Verify ${batch.stats.layoutChangeCount} layout change(s)`)
    }
    lines.push(`3. Update baselines if changes are intentional: \`npm run test:e2e:visual:update\``)
    lines.push(`4. Commit updated snapshots: \`git add e2e/snapshots/\``)

    lines.push('')
    lines.push('[View detailed report](https://github.com/actions/runs/)')

    return lines.join('\n')
  }

  /**
   * Export report as JSON.
   */
  exportAsJson(batch: VisualRegressionReportBatch): string {
    return JSON.stringify(batch, null, 2)
  }
}
