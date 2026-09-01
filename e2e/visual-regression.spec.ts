/**
 * Visual Regression Tests
 *
 * Captures screenshots of key pages at multiple viewports (mobile, tablet, desktop)
 * and in both dark/light mode. Compares against baseline snapshots stored in
 * e2e/snapshots/. CI fails if pixel diff exceeds the configured threshold.
 *
 * Baseline update workflow:
 *   npx playwright test --update-snapshots
 *   git add e2e/snapshots/
 *   git commit -m "chore: update visual regression baselines"
 *
 * The --update-snapshots flag regenerates all baselines. After reviewing the
 * diffs in the HTML report, commit the approved screenshots.
 */

import { test, expect, type Page } from '@playwright/test'

// ── Viewport definitions ────────────────────────────────────────────────────

const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
} as const

// ── Screenshot helper ───────────────────────────────────────────────────────

/**
 * Waits for the page to reach a stable visual state before capturing.
 * Stops animations, waits for network idle and any pending fonts/images.
 */
async function stableScreenshot(page: Page): Promise<Buffer> {
  // Freeze CSS animations and transitions so screenshots are deterministic
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  })

  // Wait for fonts and lazy images
  await page.evaluate(() => document.fonts.ready)
  await page.waitForLoadState('networkidle')

  return page.screenshot({ fullPage: true })
}

/**
 * Forces the colour-scheme to light or dark via a `<meta>` + CSS class override.
 * The app respects `prefers-color-scheme` through Tailwind's `dark:` variant.
 */
async function setColorScheme(page: Page, scheme: 'light' | 'dark'): Promise<void> {
  await page.emulateMedia({ colorScheme: scheme })
  // Also set the data-theme attribute used by some Tailwind setups
  await page.evaluate((s) => {
    document.documentElement.setAttribute('data-theme', s)
    document.documentElement.classList.toggle('dark', s === 'dark')
  }, scheme)
}

// ── Wait helper ─────────────────────────────────────────────────────────────

async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle')
  // Allow up to 10 s for the main heading or a known content element
  await Promise.race([
    page.getByRole('heading', { name: 'Price Oracle Dashboard' }).waitFor({ timeout: 10_000 }).catch(() => {}),
    page.getByRole('main').waitFor({ timeout: 10_000 }).catch(() => {}),
  ])
}

// ── Dashboard — viewport-specific screenshots ───────────────────────────────

for (const [name, size] of Object.entries(VIEWPORTS) as [keyof typeof VIEWPORTS, typeof VIEWPORTS[keyof typeof VIEWPORTS]][]) {
  test.describe(`Dashboard — ${name} (${size.width}×${size.height})`, () => {
    test.use({ viewport: size })

    test(`dark mode baseline — ${name}`, async ({ page }) => {
      await setColorScheme(page, 'dark')
      await page.goto('/')
      await waitForPageReady(page)

      const screenshot = await stableScreenshot(page)
      expect(screenshot).toMatchSnapshot(`dashboard-dark-${name}.png`, {
        maxDiffPixelRatio: 0.02,
      })
    })

    test(`light mode baseline — ${name}`, async ({ page }) => {
      await setColorScheme(page, 'light')
      await page.goto('/')
      await waitForPageReady(page)

      const screenshot = await stableScreenshot(page)
      expect(screenshot).toMatchSnapshot(`dashboard-light-${name}.png`, {
        maxDiffPixelRatio: 0.02,
      })
    })
  })
}

// ── 404 Not-Found page ──────────────────────────────────────────────────────

test.describe('404 page', () => {
  test('dark mode baseline — desktop', async ({ page }) => {
    test.info().annotations.push({ type: 'description', description: 'Visual baseline for 404 page' })
    await page.setViewportSize(VIEWPORTS.desktop)
    await setColorScheme(page, 'dark')
    await page.goto('/this-route-does-not-exist-xyz')
    await page.waitForLoadState('networkidle')
    await page.getByRole('heading', { name: /404|not found/i }).waitFor({ timeout: 10_000 })

    const screenshot = await stableScreenshot(page)
    expect(screenshot).toMatchSnapshot('not-found-dark-desktop.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('light mode baseline — desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await setColorScheme(page, 'light')
    await page.goto('/this-route-does-not-exist-xyz')
    await page.waitForLoadState('networkidle')
    await page.getByRole('heading', { name: /404|not found/i }).waitFor({ timeout: 10_000 })

    const screenshot = await stableScreenshot(page)
    expect(screenshot).toMatchSnapshot('not-found-light-desktop.png', {
      maxDiffPixelRatio: 0.02,
    })
  })
})

// ── Price Detail page ───────────────────────────────────────────────────────

test.describe('Price Detail page', () => {
  test('dark mode baseline — desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await setColorScheme(page, 'dark')
    await page.goto('/prices/BTC%2FUSD')
    await page.waitForLoadState('networkidle')
    // Accept the page whether it shows chart or an error/loading state
    await Promise.race([
      page.getByRole('button', { name: /go back/i }).waitFor({ timeout: 10_000 }).catch(() => {}),
      page.getByRole('alert').waitFor({ timeout: 10_000 }).catch(() => {}),
    ])

    const screenshot = await stableScreenshot(page)
    expect(screenshot).toMatchSnapshot('price-detail-dark-desktop.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('light mode baseline — desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await setColorScheme(page, 'light')
    await page.goto('/prices/BTC%2FUSD')
    await page.waitForLoadState('networkidle')
    await Promise.race([
      page.getByRole('button', { name: /go back/i }).waitFor({ timeout: 10_000 }).catch(() => {}),
      page.getByRole('alert').waitFor({ timeout: 10_000 }).catch(() => {}),
    ])

    const screenshot = await stableScreenshot(page)
    expect(screenshot).toMatchSnapshot('price-detail-light-desktop.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('dark mode baseline — mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await setColorScheme(page, 'dark')
    await page.goto('/prices/BTC%2FUSD')
    await page.waitForLoadState('networkidle')
    await Promise.race([
      page.getByRole('button', { name: /go back/i }).waitFor({ timeout: 10_000 }).catch(() => {}),
      page.getByRole('alert').waitFor({ timeout: 10_000 }).catch(() => {}),
    ])

    const screenshot = await stableScreenshot(page)
    expect(screenshot).toMatchSnapshot('price-detail-dark-mobile.png', {
      maxDiffPixelRatio: 0.02,
    })
  })
})

// ── API Docs page ───────────────────────────────────────────────────────────

test.describe('API Docs page', () => {
  test('dark mode baseline — desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await setColorScheme(page, 'dark')
    await page.goto('/api-docs')
    await page.waitForLoadState('networkidle')
    await page.getByRole('main').waitFor({ timeout: 10_000 }).catch(() => {})

    const screenshot = await stableScreenshot(page)
    expect(screenshot).toMatchSnapshot('api-docs-dark-desktop.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('light mode baseline — desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop)
    await setColorScheme(page, 'light')
    await page.goto('/api-docs')
    await page.waitForLoadState('networkidle')
    await page.getByRole('main').waitFor({ timeout: 10_000 }).catch(() => {})

    const screenshot = await stableScreenshot(page)
    expect(screenshot).toMatchSnapshot('api-docs-light-desktop.png', {
      maxDiffPixelRatio: 0.02,
    })
  })
})
