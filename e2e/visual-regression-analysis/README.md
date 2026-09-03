# Visual Regression Analysis Toolkit

Production-ready diagnostic tools for analyzing visual regression diffs and identifying root causes.

## Quick Start

### Import the Tools

```typescript
import {
  DiffAnalyzer,
  FlakeDetector,
  ReportGenerator,
  type VisualRegressionReport,
  type FlakeMetadata,
} from './e2e/visual-regression-analysis'
```

### Analyze a Visual Change

```typescript
const analyzer = new DiffAnalyzer()

// Load baseline and current screenshots
const baselineBuffer = fs.readFileSync('e2e/snapshots/dashboard-dark-mobile.png')
const currentBuffer = fs.readFileSync('test-results/dashboard-dark-mobile.png')

await analyzer.loadImages(baselineBuffer, currentBuffer)

// Get overall diff ratio
const diffRatio = analyzer.computeDiffRatio() // 0.045 = 4.5%

// Find changed regions
const regions = analyzer.detectChangedRegions(0.1) // threshold: 10%
// Returns: { x, y, width, height, changePercentage }[]

// Classify severity of each region
const analyses = analyzer.generateAnalysis(diffRatio, regions)
// Returns ChangeAnalysis[] with severity, likelyCauses, affectedComponents
```

### Detect Flaky Tests

```typescript
const flakeDetector = new FlakeDetector()

// Register multiple observations of the same test
for (let i = 0; i < 10; i++) {
  await runVisualTest()
  flakeDetector.registerObservation(
    'dashboard-dark-mobile',
    0.045,
    passed,
    { os: 'linux', gpu: 'nvidia-gtx1080', timestamp: Date.now() }
  )
}

// Analyze flake patterns
const flakeMetadata = flakeDetector.analyzeFlake('dashboard-dark-mobile')
if (flakeMetadata) {
  console.log(`Flake detected: ${flakeMetadata.likelyCause}`)
  console.log(flakeDetector.suggestFixStrategy(flakeMetadata))
}
```

### Generate Reports

```typescript
const generator = new ReportGenerator({
  outputDir: 'reports/',
  generateHtml: true,
  failureThreshold: 0.02, // 2%
})

// Generate single test report
const report = await generator.generateTestReport(
  'dashboard-dark-mobile',
  'e2e/snapshots/dashboard-dark-mobile.png',
  'test-results/dashboard-dark-mobile.png',
  'test-results/visual-regression-diff/dashboard-dark-mobile-diff.png',
  {
    browser: 'chromium',
    viewport: { width: 375, height: 812 },
    colorScheme: 'dark',
    os: 'linux',
    gpu: 'nvidia-gtx1080',
  }
)

// Export as markdown for GitHub PR
const markdown = generator.formatAsMarkdown(batchReport)
console.log(markdown)

// Export as JSON for CI integration
const json = generator.exportAsJson(batchReport)
fs.writeFileSync('reports/visual-regression-analysis.json', json)
```

## API Reference

### DiffAnalyzer

Analyzes pixel differences to identify changed regions and likely CSS causes.

#### Methods

- **`computeDiffRatio(): number`** – Overall diff ratio (0–1)
- **`detectChangedRegions(threshold?: number): ChangedRegion[]`** – Bounding boxes of changed pixels
- **`classifyRegionSeverity(region): ChangeSeverity`** – "cosmetic" | "layout" | "critical"
- **`suggestCssChanges(region): string[]`** – Likely CSS properties (["margin", "padding", ...])
- **`estimateAffectedComponents(region): string[]`** – Component names affected
- **`generateAnalysis(diffRatio, regions): ChangeAnalysis[]`** – Synthesized analysis

#### Example Output

```typescript
const analysis: ChangeAnalysis = {
  region: { x: 120, y: 200, width: 180, height: 40, changePercentage: 1.2 },
  severity: 'layout',
  likelyCauses: ['font-size', 'margin', 'line-height'],
  affectedComponents: ['PriceCard'],
  confidence: 0.95,
  description: 'Layout adjustment in PriceCard: likely font-size or margin changed.'
}
```

### FlakeDetector

Identifies non-deterministic (flaky) tests and suggests fixes.

#### Methods

- **`registerObservation(testName, diffRatio, passed, context)`** – Record test run
- **`analyzeFlake(testName): FlakeMetadata | null`** – Detect flake patterns
- **`suggestFixStrategy(flake): string`** – Actionable fix advice
- **`getRecommendedThreshold(testName): number`** – Platform-specific tolerance
- **`generateFlakeReport(): Record<string, FlakeMetadata>`** – All flakes

#### Flake Types

- **`gpu-variance`** – Consistent failure on specific OS/GPU
  - Fix: Increase threshold for that platform
  
- **`timing`** – Random failures from animation/network delays
  - Fix: Add explicit waits, mock network requests
  
- **`animation`** – CSS animations not properly frozen
  - Fix: Ensure `animation-duration: 0s !important` in stableScreenshot
  
- **`font-loading`** – Fonts loading inconsistently
  - Fix: Add `await page.evaluate(() => document.fonts.ready)`
  
- **`network`** – Network delays affecting render
  - Fix: Use `waitForLoadState('networkidle')`

#### Example Output

```typescript
const flake: FlakeMetadata = {
  testName: 'dashboard-dark-mobile',
  flakeRate: 0.25, // fails 25% of the time
  likelyCause: 'gpu-variance',
  gpuVariances: [
    {
      os: 'linux',
      gpu: 'nvidia-gtx1080',
      observedDiffRatio: 0.08,
      recommendedThreshold: 0.12,
      sampleCount: 8
    }
  ],
  lastOccurrence: 1693584000000,
  flakeCount: 2
}
```

### ReportGenerator

Synthesizes DiffAnalyzer and FlakeDetector results into actionable reports.

#### Methods

- **`generateTestReport(...): VisualRegressionReport`** – Single test analysis
- **`generateBatchReport(batchId, reports): VisualRegressionReportBatch`** – Multi-test summary
- **`formatAsMarkdown(batch): string`** – GitHub PR comment
- **`exportAsJson(batch): string`** – CI integration

#### Markdown Output Example

```markdown
## Visual Regression Analysis

### Summary
- **Total tests**: 12
- **Passed**: 11
- **Changes detected**: 1
- **Flaky tests**: 0
- **Max diff**: 4.50%

### Changes by Severity
- 🔴 Critical: 0
- 🟡 Layout: 1
- 🟢 Cosmetic: 0

### Failed Tests

#### 🟡 dashboard-dark-mobile
Diff: **4.50%**
- Region: (120, 200) 180×40
- Likely causes: font-size, margin, line-height
- Components: PriceCard
- ⚠️ Layout change detected in PriceCard. Verify this is intentional...
```

## Types

### ChangeAnalysis

```typescript
interface ChangeAnalysis {
  region: ChangedRegion
  severity: 'cosmetic' | 'layout' | 'critical'
  affectedComponents: string[]
  likelyCauses: string[]
  confidence: number // 0–1
  description: string
}
```

### FlakeMetadata

```typescript
interface FlakeMetadata {
  testName: string
  flakeRate: number // 0–1
  likelyCause: 'gpu-variance' | 'timing' | 'animation' | 'font-loading' | 'network' | 'unknown'
  gpuVariances?: GpuVariance[]
  lastOccurrence: number
  flakeCount: number
}
```

### VisualRegressionReport

```typescript
interface VisualRegressionReport {
  test: string
  baseline: string
  current: string
  diff?: string
  diffPixelRatio: number
  changes: ChangeAnalysis[]
  overallSeverity: 'cosmetic' | 'layout' | 'critical'
  flakeDetected: boolean
  flakeMetadata?: FlakeMetadata
  recommendedAction: string
  timestamp: number
  context: {
    browser: 'chromium' | 'firefox' | 'webkit'
    viewport: { width: number; height: number }
    colorScheme: 'light' | 'dark'
  }
}
```

## Integration with Playwright

### Hook into Test Results

```typescript
// playwright.config.ts or test hooks
import { DiffAnalyzer, ReportGenerator } from './e2e/visual-regression-analysis'

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== 'passed' && testInfo.title.includes('visual')) {
    // Generate analysis report
    const generator = new ReportGenerator({ outputDir: 'reports/' })
    const report = await generator.generateTestReport(
      testInfo.title,
      // ... paths and context ...
    )
    
    // Save report
    const reports = JSON.parse(fs.readFileSync('reports/visual-reports.json', 'utf-8') || '[]')
    reports.push(report)
    fs.writeFileSync('reports/visual-reports.json', JSON.stringify(reports, null, 2))
  }
})
```

### CI Pipeline Integration

```bash
#!/bin/bash
# Run visual tests
npx playwright test --project=visual-regression

# Analyze results
node -e "
const { ReportGenerator } = require('./e2e/visual-regression-analysis')
const generator = new ReportGenerator({ outputDir: 'reports/' })
// Parse test results and generate reports
"

# Comment PR with analysis
# (GitHub Actions script)
```

## Advanced Usage

### Custom Diff Thresholds

```typescript
// Per-viewport thresholds
const mobileThreshold = 0.03 // 3% for mobile
const desktopThreshold = 0.02 // 2% for desktop

const regions = analyzer.detectChangedRegions(
  viewport.width < 600 ? mobileThreshold : desktopThreshold
)
```

### Flake History Persistence

```typescript
// Save flake history to file
const history = flakeDetector.exportHistory()
fs.writeFileSync('reports/flake-history.json', JSON.stringify(history, null, 2))

// Load in next run
const history = JSON.parse(fs.readFileSync('reports/flake-history.json', 'utf-8'))
flakeDetector.importHistory(history)
```

### Batch Analysis with Progress

```typescript
const generator = new ReportGenerator({ outputDir: 'reports/' })
const reports: VisualRegressionReport[] = []

for (const testResult of testResults) {
  const report = await generator.generateTestReport(...)
  reports.push(report)
  
  if (report.overallSeverity === 'critical') {
    console.error(`❌ Critical issue: ${report.test}`)
  }
}

const batch = await generator.generateBatchReport('run-123', reports)
console.log(`Analyzed ${batch.totalTests} tests, ${batch.testsWithChanges} with changes`)
```

## Best Practices

1. **Use component-level snapshots** – Catch issues early, narrower scope
2. **Monitor flake history** – Persistent storage for trend analysis
3. **Per-platform thresholds** – Account for GPU variance
4. **Actionable recommendations** – Let tools guide developers
5. **Review severity, not diff ratio** – Layout changes matter more than cosmetic

## Performance

- DiffAnalyzer: ~100–200 ms per full-page screenshot (1440×900)
- FlakeDetector: O(n) where n = observation count
- ReportGenerator: ~50 ms to synthesize 10 reports

Ideal for CI pipelines (post-test step).

## Contributing

- Add new severity types: Update `ChangeSeverity` type + heuristics
- Add new flake detection: Update `detectFlakelyCause()` method
- Add new report formats: Extend `ReportGenerator` class

---

**Version:** 1.0.0  
**Last Updated:** 2026-08-26
