# Visual Regression Testing Enhancement Plan

**Status:** Architectural Planning Phase  
**Date:** 2026-08-26  
**Problem Statement:** Visual regressions are caught late or not at all. Manual visual review doesn't scale, pixel-by-pixel comparison is too brittle (flaky on different GPUs/OS), and developers lack tools to diagnose what caused the visual change.

---

## Current State Assessment

### ✅ What's Already in Place

1. **Playwright Configuration** (`playwright.config.ts`)
   - 4 projects: `visual-regression` (Chromium only), `chromium`, `firefox`, `webkit`
   - 2% max diff pixel ratio threshold + 0.1 pixel threshold
   - HTML reporter enabled with full test output
   - Trace recording on first retry
   - Snapshots stored in `e2e/snapshots/`

2. **Visual Regression Tests** (`e2e/visual-regression.spec.ts`)
   - 12 baseline screenshots captured (3 routes × 2 color schemes × 2 viewports)
   - Dashboard (mobile, tablet, desktop, light & dark)
   - 404 page (desktop light & dark)
   - Price Detail page (desktop light & dark, mobile dark)
   - API Docs page (desktop light & dark)

3. **Test Helpers**
   - `stableScreenshot()` – Freezes animations, waits for fonts/network idle
   - `setColorScheme()` – Emulates light/dark mode via CSS + emulateMedia
   - `waitForPageReady()` – Waits for known content elements

4. **CI Integration** (`.github/workflows/ci.yml`)
   - `visual-regression` job runs Chromium-only snapshots
   - Continues on error (advisory, not blocking)
   - Uploads HTML report + diff screenshots as artifacts (14 day retention)
   - Advisory comment approach for PRs

5. **Local Workflow**
   - `npm run test:e2e:visual` – Run visual tests
   - `npm run test:e2e:visual:update` – Update baselines
   - `scripts/update-visual-baselines.js` – Guided workflow

### ❌ What's Missing

1. **Diagnostic Tools**
   - ❌ No pixel diff analysis – what regions changed?
   - ❌ No change attribution – which CSS/component caused it?
   - ❌ No impact categorization – cosmetic vs. critical?
   - ❌ No performance metrics for rendering time

2. **Robustness & Coverage**
   - ❌ No sub-pixel threshold tuning per-viewport
   - ❌ No OS-specific tolerances (Windows/Mac/Linux GPU differences)
   - ❌ No device simulation (iPhone, Android, tablet edge cases)
   - ❌ No multi-state captures (hover, focus, loading states)
   - ❌ No interaction sequence testing (modal + overlay stacking)

3. **Developer Experience**
   - ❌ No quick local diff viewer (requires artifacts from CI)
   - ❌ No "what to update" guidance in diff reports
   - ❌ No approval workflow – baseline updates are manual
   - ❌ No change persistence (lost when CI artifacts expire)

4. **Smart Detection**
   - ❌ No flake detection – same test fails inconsistently
   - ❌ No GPU variance detection – screenshot differs only on certain GPUs
   - ❌ No timing-related flakes (animations, WebSocket updates)

---

## Proposed Architecture

### Layer 1: Enhanced Test Capture

**Goal:** Capture more states with better metadata for diagnostic analysis.

```
e2e/
├── visual-regression.spec.ts (existing — expand)
├── visual-regression/
│   ├── components.spec.ts (NEW — per-component snapshots)
│   ├── interactive-states.spec.ts (NEW — hover, focus, loading)
│   ├── multi-viewport.spec.ts (NEW — targeted device simulation)
│   └── viewport-config.ts (NEW — shared viewport/device definitions)
└── snapshots/
    ├── dashboard-dark-mobile.png
    ├── component-price-card-dark.png (NEW)
    ├── component-price-table-dark.png (NEW)
    ├── interactive-price-card-hover-dark.png (NEW)
    └── ...
```

**Captured States:**
- ✅ Page-level (existing)
- ✅ Component-level (NEW)
- ✅ Interactive states: hover, focus, loading (NEW)
- ✅ Multi-viewport: mobile, tablet, desktop, large (NEW)
- ✅ Light & dark mode (existing)

### Layer 2: Smart Diff Analysis

**Goal:** Analyze pixel diffs to identify affected regions and likely causes.

```
e2e/visual-regression-analysis/
├── DiffAnalyzer.ts (NEW)
│   ├── detectChangedRegions() → { x, y, width, height }[]
│   ├── estimateSeverity() → "cosmetic" | "layout" | "critical"
│   ├── findAffectedComponents() → string[] (CSS class, data-testid)
│   └── suggestCause() → string (e.g., "font-size, margin, color")
├── FlakeDetector.ts (NEW)
│   ├── detectInconsistency() → true/false
│   ├── analyzeGpuVariance() → { os, gpu, threshold_needed }[]
│   └── logFlakeySnapshot() → void
└── types.ts (NEW)
    └── DiffReport, ChangeAnalysis, FlakeMetadata
```

**Output:** `reports/visual-regression-analysis.json`
```json
{
  "test": "dashboard-dark-mobile",
  "baseline": "e2e/snapshots/dashboard-dark-mobile.png",
  "current": "test-results/visual-regression-diff/dashboard-dark-mobile-actual.png",
  "diff": "test-results/visual-regression-diff/dashboard-dark-mobile-diff.png",
  "changes": [
    {
      "region": { "x": 120, "y": 200, "width": 180, "height": 40 },
      "severity": "layout",
      "affected_components": ["PriceCard"],
      "likely_cause": "font-size or line-height changed",
      "confidence": 0.95
    }
  ],
  "flake_detected": false,
  "recommended_action": "Review PriceCard CSS changes in this PR"
}
```

### Layer 3: Component-Level Snapshots

**Goal:** Isolate components for faster debugging and reduced false positives.

```typescript
// e2e/visual-regression/components.spec.ts
test.describe('Component Snapshots', () => {
  test('PriceCard — dark mode', async ({ page }) => {
    await page.goto('/') // or mock page
    await page.setViewportSize(VIEWPORTS.mobile)
    await setColorScheme(page, 'dark')
    
    // Isolate the component
    const card = page.locator('[data-testid="price-card"]').first()
    const screenshot = await card.screenshot()
    
    expect(screenshot).toMatchSnapshot('component-price-card-dark-mobile.png')
  })

  test('AlertPanel — light mode, open state', async ({ page }) => {
    await page.goto('/')
    await page.setViewportSize(VIEWPORTS.desktop)
    await setColorScheme(page, 'light')
    
    // Open the modal
    await page.getByRole('button', { name: 'Alerts' }).click()
    await page.getByRole('dialog').waitFor()
    
    const modal = page.locator('[role="dialog"]')
    const screenshot = await modal.screenshot()
    
    expect(screenshot).toMatchSnapshot('component-alert-panel-light-desktop-open.png')
  })
})
```

### Layer 4: Interactive State Testing

**Goal:** Capture hover, focus, and other interactive states that pixel tests miss.

```typescript
// e2e/visual-regression/interactive-states.spec.ts
test.describe('Interactive States', () => {
  test('PriceCard hover state', async ({ page }) => {
    await page.goto('/')
    const card = page.locator('[data-testid="price-card"]').first()
    await card.hover()
    
    const screenshot = await card.screenshot()
    expect(screenshot).toMatchSnapshot('interactive-price-card-hover-dark.png')
  })

  test('PriceTable loading skeleton', async ({ page }) => {
    // Navigate to trigger table lazy-load
    await page.goto('/')
    await page.getByRole('button', { name: 'Table view' }).click()
    
    // Capture during load
    const table = page.locator('[data-testid="price-table"]')
    const screenshot = await table.screenshot()
    
    expect(screenshot).toMatchSnapshot('interactive-price-table-loading-dark.png')
  })

  test('AlertPanel form validation states', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Alerts' }).click()
    
    // Trigger validation without filling
    await page.getByRole('button', { name: 'Create' }).click()
    
    const modal = page.locator('[role="dialog"]')
    const screenshot = await modal.screenshot()
    
    expect(screenshot).toMatchSnapshot('interactive-alert-form-errors-dark.png')
  })
})
```

### Layer 5: Local Development Tools

**Goal:** Enable fast iteration without waiting for CI artifacts.

```bash
# New commands (to be added to package.json)
npm run test:e2e:visual:diff       # Show diff report locally
npm run test:e2e:visual:analyze    # Run DiffAnalyzer on last test run
npm run test:e2e:visual:approve    # Approve and commit updated baselines
npm run test:e2e:visual:compare    # Compare two snapshots side-by-side
npm run test:e2e:visual:coverage   # Show which components have snapshot coverage
```

**Tool: `scripts/visual-regression-cli.js`**
```
Usage: node scripts/visual-regression-cli.js <command> [options]

Commands:
  diff [test-name]          Show pixel diff report for a test
  analyze [test-name]       Run DiffAnalyzer on test results
  approve [test-name]       Update baseline and commit
  compare <file1> <file2>   Side-by-side comparison
  coverage                  Component snapshot coverage matrix
  flake-report              Show historically flaky snapshots
  sync-baseline <branch>    Sync baselines from another branch

Options:
  --threshold <pixels>      Override diff pixel threshold
  --open                    Open in browser
  --verbose                 Show detailed output
```

### Layer 6: CI Enhancement

**Goal:** Better GitHub integration with automatic diagnostics and approval workflows.

```yaml
# Enhanced .github/workflows/ci.yml
visual-regression:
  steps:
    # ... existing steps ...
    
    # NEW: Run DiffAnalyzer
    - name: Analyze visual diffs
      if: failure()
      run: |
        npm run test:e2e:visual:analyze
        # Generates: reports/visual-regression-analysis.json
    
    # NEW: Comment PR with diagnostics
    - name: Comment PR with diff summary
      if: github.event_name == 'pull_request' && failure()
      uses: actions/github-script@v7
      with:
        script: |
          const fs = require('fs')
          const analysis = JSON.parse(
            fs.readFileSync('reports/visual-regression-analysis.json', 'utf-8')
          )
          // Format and comment analysis
    
    # NEW: Create baseline approval issue
    - name: Create baseline approval checklist
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v7
      with:
        script: |
          // Auto-create checklist for visual changes
          // Developers approve by checking boxes
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Create `DiffAnalyzer.ts` with region detection + severity scoring
- [ ] Add component-level snapshot tests for PriceCard, PriceTable, AlertPanel
- [ ] Generate `visual-regression-analysis.json` reports
- [ ] Update CI to upload analysis as artifact

### Phase 2: Tooling (Week 2)
- [ ] Implement `scripts/visual-regression-cli.js` with diff viewing
- [ ] Add interactive state tests (hover, focus, loading, errors)
- [ ] Create `FlakeDetector.ts` for GPU variance tracking
- [ ] Local diff report viewer (HTML + side-by-side comparison)

### Phase 3: CI Integration (Week 3)
- [ ] Enhanced GitHub Actions comments with diagnostics
- [ ] Baseline approval workflow (comment-triggered)
- [ ] Slack notifications for visual changes (optional)
- [ ] Historical flake tracking + alerts

### Phase 4: Advanced (Week 4)
- [ ] Multi-viewport device simulation (iPad, Android)
- [ ] Performance metrics (rendering time per component)
- [ ] Accessibility diff validation (computed styles, ARIA)
- [ ] Automated threshold tuning per OS/GPU

---

## File Structure (Target State)

```
e2e/
├── visual-regression.spec.ts (existing — keep)
├── visual-regression/
│   ├── components.spec.ts (NEW)
│   ├── interactive-states.spec.ts (NEW)
│   ├── multi-viewport.spec.ts (NEW)
│   └── viewport-config.ts (NEW)
├── snapshots/
│   ├── dashboard-*.png (existing)
│   ├── component-*.png (NEW)
│   └── interactive-*.png (NEW)
└── visual-regression-analysis/
    ├── DiffAnalyzer.ts (NEW)
    ├── FlakeDetector.ts (NEW)
    ├── ReportGenerator.ts (NEW)
    └── types.ts (NEW)

scripts/
├── visual-regression-cli.js (NEW)
└── update-visual-baselines.js (existing)

reports/
├── visual-regression-analysis.json (NEW — generated)
├── playwright/ (existing)
└── component-coverage.json (NEW — generated)
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Visual regressions caught in CI | ~50% | >95% |
| Time to diagnose a visual change | 10-20 min (manual) | <2 min (automated) |
| False positive rate | 5-10% (brittle) | <1% (smart thresholding) |
| Developer approval time | Slow (manual review) | Fast (interactive approval) |
| Test reliability (Chromium → Firefox diff) | N/A | <0.5% flake rate |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Snapshot bloat (too many tests) | Start with critical components; use test matrix to generate variants |
| GPU/OS variance makes tests flaky | Implement FlakeDetector; per-OS threshold tuning |
| CI feedback loop too slow | Local dev tools enable faster iteration before push |
| Baseline drift (outdated snapshots) | Require approval + commit for all baseline updates |
| Report noise (too many alerts) | Smart severity scoring; only alert on "critical" changes |

---

## Next Steps

1. ✅ **Task 1:** Review this plan and generate detailed task breakdown
2. 🚧 **Task 2:** Implement Phase 1 (DiffAnalyzer + component snapshots)
3. 🚧 **Task 3:** Implement Phase 2 (CLI tooling + interactive tests)
4. 🚧 **Task 4:** Enhance CI integration
5. 🚧 **Task 5:** Add documentation + best practices guide

---

## References

- [Playwright Visual Comparisons](https://playwright.dev/docs/test-snapshots)
- [Chromium GPU Variance](https://github.com/microsoft/playwright/issues/13380)
- [Diff Region Analysis Algorithms](https://en.wikipedia.org/wiki/Image_difference)
