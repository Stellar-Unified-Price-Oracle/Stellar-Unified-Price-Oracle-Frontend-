# Mobile Responsive Testing Strategy

**Problem:** Mobile layouts may break without detection.  
**Solution:** Comprehensive Playwright tests for mobile viewport sizes + responsive behavior verification.

**Status:** Current State Analysis + Enhanced Test Plan

---

## Current Testing Coverage

### ✅ What's Already in Place

**Responsive Tests** (`e2e/responsive.spec.ts`):
- Mobile viewport (375×812)
- Tablet viewport (768×1024)
- Desktop viewport (1440×900)
- Tests for: overflow, navigation, menu, search, forms

**Visual Regression Tests** (`e2e/visual-regression.spec.ts`):
- Dashboard: 3 viewports × 2 color schemes = 6 baselines
- Price Detail: 2 viewports × 2 color schemes = 4 baselines
- 404 page: desktop only
- API Docs: desktop only
- Total: ~12 snapshots

**Helper Functions:**
- `stableScreenshot()` – Freezes animations, waits for network
- `setColorScheme()` – Emulates light/dark
- `waitForPageReady()` – Waits for content

### ❌ What's Missing

**Coverage Gaps:**
- 404 page: only desktop, missing mobile/tablet
- API Docs: only desktop, missing mobile/tablet
- Price Detail: missing tablet viewport
- No deep-dive component layout tests (PriceCard, PriceTable, etc. in isolation)
- No layout shift detection (Cumulative Layout Shift metric)
- No test for specific mobile patterns (stacked navigation, sticky headers, scrolling)
- No landscape mobile orientation
- No edge case viewports (small phones, large tablets)

**Behavioral Gaps:**
- No touch/swipe gesture testing
- No bottom sheet/modal overflow handling
- No keyboard input on mobile (virtual keyboard height)
- No specific mobile state transitions (page navigation flow on mobile)

---

## Enhanced Mobile Testing Plan

### New Test Suite: `e2e/mobile-responsive.spec.ts`

Comprehensive mobile-specific testing covering:

1. **Viewport Coverage**
   - Small phones (320×568) – SE / older iPhones
   - Standard phones (375×812) – iPhone 12/13
   - Large phones (428×926) – iPhone 14/15
   - Tablet portrait (768×1024) – iPad
   - Tablet landscape (1024×768) – iPad landscape
   - Foldable (540×720 + 540×720)

2. **Layout & Rendering**
   - No horizontal overflow (critical metric)
   - Text legibility (font sizes readable)
   - Touch target sizes (min 44×44 px)
   - Spacing & padding (content not crammed)
   - Image scaling (no distortion)

3. **Mobile-Specific Features**
   - Bottom navigation (visible, reachable)
   - Hamburger menu (on mobile, hidden on desktop)
   - Back button (on detail pages)
   - Search bar (visible, functional)
   - Modal/drawer behavior (full-height, swiped)

4. **Responsive Interactions**
   - Swipe gestures (left/right navigation)
   - Long-press (context menus)
   - Scroll behavior (smooth, no jank)
   - Orientation changes (portrait ↔ landscape)
   - Keyboard appearance (input doesn't get hidden)

5. **Visual Baselines**
   - All major pages in all viewports + color schemes
   - Component isolation (PriceCard, PriceTable on mobile)
   - Empty states (no price feeds, errors)
   - Loading states (skeleton screens)

---

## Implementation Details

### Viewport Definitions

```typescript
const VIEWPORTS = {
  // Small phones
  phoneSmall: { width: 320, height: 568, deviceName: 'iPhone SE' },
  
  // Standard phones
  phoneStandard: { width: 375, height: 812, deviceName: 'iPhone 12/13' },
  
  // Large phones
  phoneLarge: { width: 428, height: 926, deviceName: 'iPhone 14/15' },
  
  // Tablets
  tabletPortrait: { width: 768, height: 1024, deviceName: 'iPad' },
  tabletLandscape: { width: 1024, height: 768, deviceName: 'iPad Landscape' },
  
  // Desktop (baseline)
  desktop: { width: 1440, height: 900, deviceName: 'Desktop' },
  
  // Foldable (emerging platform)
  foldable: { width: 540, height: 720, deviceName: 'Samsung Galaxy Fold' },
} as const
```

### Test Categories

#### 1. Layout Integrity Tests
```typescript
test('no horizontal overflow on all mobile viewports', async ({ page }) => {
  for (const [name, viewport] of Object.entries(MOBILE_VIEWPORTS)) {
    await page.setViewportSize(viewport)
    const hasOverflow = await page.evaluate(() => 
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(hasOverflow, `${name} should not have horizontal overflow`).toBe(false)
  }
})
```

#### 2. Touch Target Size Tests
```typescript
test('interactive elements meet minimum touch target size', async ({ page }) => {
  const buttons = page.locator('button')
  for (const button of await buttons.all()) {
    const box = await button.boundingBox()
    expect(box?.width, 'Button width >= 44px').toBeGreaterThanOrEqual(44)
    expect(box?.height, 'Button height >= 44px').toBeGreaterThanOrEqual(44)
  }
})
```

#### 3. Text Legibility Tests
```typescript
test('text is readable on mobile (font-size >= 12px, line-height >= 1.4)', async ({ page }) => {
  const headings = page.locator('h1, h2, h3, h4, h5, h6')
  for (const heading of await headings.all()) {
    const size = await heading.evaluate(el => 
      parseInt(window.getComputedStyle(el).fontSize)
    )
    expect(size, 'Heading font-size >= 16px').toBeGreaterThanOrEqual(16)
  }
})
```

#### 4. Component Isolation Tests
```typescript
test('PriceCard layout on mobile viewport', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.phoneStandard)
  const card = page.locator('[data-testid="price-card"]').first()
  
  // Card should be full width or nearly full
  const box = await card.boundingBox()
  const viewport = page.viewportSize()
  expect(box!.width).toBeGreaterThan(viewport!.width * 0.8)
  
  // Card should be clickable
  await card.click()
})
```

#### 5. Visual Baselines for Mobile
```typescript
test('dashboard layout — mobile dark mode', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.phoneStandard)
  await setColorScheme(page, 'dark')
  await page.goto('/')
  
  const screenshot = await stableScreenshot(page)
  expect(screenshot).toMatchSnapshot('dashboard-mobile-dark.png')
})
```

#### 6. Gesture & Interaction Tests
```typescript
test('swipe left navigates to next price card', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.phoneStandard)
  await page.goto('/')
  
  const firstCard = page.locator('[data-testid="price-card"]').first()
  
  // Simulate swipe: drag from right to left
  await firstCard.dragTo(firstCard, {
    sourcePosition: { x: 300, y: 200 },
    targetPosition: { x: 50, y: 200 },
  })
  
  // Next card should be visible (or same card if only one)
  await expect(page.locator('[data-testid="price-card"]')).toBeTruthy()
})
```

---

## Files to Create/Modify

### New Files
- `e2e/mobile-responsive.spec.ts` (600+ lines)
  - Comprehensive mobile tests for all pages
  - Component isolation tests
  - Gesture tests
  - Visual baselines for mobile+tablet

- `e2e/mobile-edge-cases.spec.ts` (200+ lines)
  - Small phones (320×568)
  - Large phones (428×926)
  - Foldable devices
  - Landscape orientation
  - Keyboard appearance simulation

- `e2e/mobile-performance.spec.ts` (150+ lines)
  - Layout Shift detection
  - Scroll performance
  - Touch response time
  - Bundle size on mobile networks

### Modified Files
- `e2e/visual-regression.spec.ts`
  - Add tablet snapshots for 404 page
  - Add tablet snapshot for Price Detail
  - Add mobile landscape orientation

- `playwright.config.ts`
  - Add `mobile-tests` project (run only mobile suites)
  - Add device definitions for realistic testing

- `package.json`
  - Add `test:e2e:mobile` command

---

## Measuring Success

### Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Mobile viewport coverage | ~50% | >95% (all pages, all major viewports) |
| Touch target size compliance | Unknown | 100% (all interactive elements ≥44×44px) |
| Horizontal overflow incidents | Varies | 0 (catch before shipping) |
| Mobile-specific bugs in production | ~5/month | <1/month (via proactive testing) |
| Layout Shift on mobile | Unknown | CLS < 0.1 (Google Core Web Vital) |

### CI Integration

```yaml
# In .github/workflows/ci.yml
mobile-responsive:
  runs-on: ubuntu-latest
  steps:
    - name: Run mobile-specific tests
      run: npm run test:e2e:mobile
    
    - name: Generate mobile report
      if: always()
      run: |
        npx playwright show-report reports/playwright-mobile
```

---

## Rollout Plan

### Phase 1 (Week 1): Core Mobile Tests
- [ ] Create `e2e/mobile-responsive.spec.ts`
- [ ] Add tests for Dashboard, Price Detail, 404, API Docs on mobile/tablet
- [ ] Add layout integrity tests (no overflow, spacing, touch targets)
- [ ] Add visual baselines for mobile

### Phase 2 (Week 2): Enhanced Coverage
- [ ] Create `e2e/mobile-edge-cases.spec.ts` (small phones, large phones, landscape)
- [ ] Add gesture tests (swipe, long-press)
- [ ] Add keyboard simulation tests

### Phase 3 (Week 3): Performance & Metrics
- [ ] Create `e2e/mobile-performance.spec.ts`
- [ ] Add Layout Shift detection
- [ ] Add scroll performance metrics
- [ ] CI integration with alerts

### Phase 4 (Week 4): Documentation & Automation
- [ ] Document best practices
- [ ] Create developer guide
- [ ] Automate snapshot updates
- [ ] CI pre-merge verification

---

## Implementation Priority

**High Priority** (Phase 1):
- Layout integrity (no horizontal overflow)
- Touch target sizes
- Visual baselines (all pages, all viewports)
- Navigation on mobile (hamburger, bottom nav)

**Medium Priority** (Phase 2):
- Edge case viewports (small/large phones, landscape)
- Gesture support (swipe, long-press)
- Modal/drawer behavior

**Low Priority** (Phase 3):
- Performance metrics (CLS, scroll smoothness)
- Keyboard simulation
- Foldable device support

---

## Best Practices

1. **Test real viewports** – Use actual device dimensions, not made-up sizes
2. **Test touch targets** – Ensure all interactive elements are ≥44×44px
3. **Test in portrait AND landscape** – Many mobile issues only appear in one orientation
4. **Test content overflow** – Pages should scroll, not overflow horizontally
5. **Test with simulated network** – Mobile users often have slow connections
6. **Test on actual devices** – Playwright local testing + real device testing in CI (optional)

---

## References

- [Playwright Mobile Testing](https://playwright.dev/docs/mobile)
- [Google Mobile Usability](https://developers.google.com/search/mobile-sites)
- [WCAG Mobile Accessibility](https://www.w3.org/WAI/mobile/)
- [Touch Target Sizes (44×44px minimum)](https://material.io/design/layout/spacing-methods.html#touch-targets)
- [Core Web Vitals for Mobile](https://web.dev/vitals/)
