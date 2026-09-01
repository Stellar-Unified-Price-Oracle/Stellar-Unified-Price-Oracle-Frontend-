import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['list'], ['html', { outputFolder: 'reports/playwright', open: 'never' }]]
    : 'list',
  use: {
    // Set by the preview-deployment workflow to point E2E runs at a live PR
    // preview instead of a locally-built server (#378).
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  // Visual-regression snapshot configuration
  // Snapshots are stored next to the spec files under e2e/snapshots/
  snapshotDir: './e2e/snapshots',
  // Compare screenshots with a 2 % pixel-ratio tolerance by default.
  // Per-snapshot overrides in the spec take precedence.
  expect: {
    toMatchSnapshot: {
      maxDiffPixelRatio: 0.02,
      // Pixel threshold: ignore sub-pixel colour differences (0–1 scale)
      threshold: 0.1,
    },
  },
  projects: [
    // Visual regression runs on Chromium only to produce deterministic baselines.
    // Full cross-browser E2E coverage is handled by the other projects below.
    {
      name: 'visual-regression',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/visual-regression.spec.ts',
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: '**/visual-regression.spec.ts',
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: '**/visual-regression.spec.ts',
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: '**/visual-regression.spec.ts',
    },
  ],
  // Skip spinning up a local server when testing against a remote preview URL.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run preview',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
