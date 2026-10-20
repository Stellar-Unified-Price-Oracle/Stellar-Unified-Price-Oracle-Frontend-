# Keyboard & Pointer Interaction Matrix

This document defines the multi-modal interaction testing matrix, accessibility guarantees, and regression suites implemented across desktop and mobile form factors for the Stellar Unified Price Oracle frontend (#863).

---

## 1. Objectives & Compliance Standards

To prevent regression in accessibility and input usability, all interactive components must adhere to:

- **WCAG 2.1 SC 2.1.1 (Keyboard)**: All functional controls must be reachable and operable through a keyboard interface without requiring specific timings for individual keystrokes.
- **WCAG 2.1 SC 2.1.2 (No Keyboard Trap)**: When keyboard focus moves into a component (such as a modal dialog), focus can be moved away from that component using standard keyboard keys (`Escape` or `Tab`).
- **WCAG 2.1 SC 2.4.3 (Focus Order)**: Focusable components receive focus in an order that preserves meaning and operability.
- **WCAG 2.1 SC 2.5.1 (Pointer Gestures)**: All functionality can be operated with a single pointer without path-based gestures.
- **WCAG 2.1 SC 2.5.2 (Pointer Cancellation)**: Down-event of the pointer does not execute the function directly; activation occurs on up-event or allows aborting.
- **WCAG 2.1 SC 4.1.3 (Status Messages)**: Real-time query result filtering and warnings must be announced politely via `aria-live` without stealing focus.

---

## 2. Interaction Modality Matrix

| Surface / Component | Modality | Primary Trigger | Target Behavior | Accessibility / Regression Check |
|---|---|---|---|---|
| **Skip Navigation** | Keyboard | `Tab` into page, `Enter` | Jumps focus directly to `<main id="main-content">` | Must not be visible until focused; activates smoothly |
| **Roadmap Disclosure** (`RoadmapCard`) | Keyboard & Pointer | `Enter`, `Space`, or Pointer Click | Toggles visibility of the public change history timeline | `aria-expanded` toggles; `aria-controls` points to timeline element |
| **Status Metric Counters** (`Roadmap`) | Pointer & Touch | Pointer click / Touch tap | Toggles filter for that status | `aria-pressed` updates; polite live region announces filtered count |
| **Data Quality Concern Modal** (`DataQualityReportModal`) | Keyboard | `Tab`, `Shift+Tab` | Loops focus strictly inside modal elements (`Close`, inputs, `Cancel`, `Submit`) | Focus trap loops cleanly; disabled elements excluded from cycle |
| **Modal Dismissal** | Multi-Modal | `Escape` key, backdrop click, Close button | Closes modal and restores focus to previous active element | Opener element regains focus; cleanup event listeners |
| **Duplicate Alert Warning** (`DuplicateReportAlert`) | Pointer & Screen Reader | Automatic on input + Pointer click on dismiss | Informs user of potential duplicate submissions | Non-intrusive `aria-live="polite"` warning; dismissible without submit blockage |
| **Search & Filters** (`Roadmap`, `Dashboard`) | Multi-Modal | Keyboard typing, Enter, pointer clear click | Filters records dynamically | Live result counter (`role="status" aria-live="polite"`) updates |

---

## 3. Test Suites & Execution

### Deterministic Unit / Integration Suite (Vitest)
Executes deterministic event verification in `src/test/interactionMatrix.test.tsx`:
```bash
npm run test:run src/test/interactionMatrix.test.tsx
```

Verifies:
1. `RoadmapCard` keyboard disclosure via `Space` and `Enter`.
2. `DataQualityReportModal` bidirectional focus trapping and `Escape` key dismissal.
3. Pointer click outside backdrop dismissal.
4. `DuplicateReportAlert` accessible `aria-live="polite"` warning and pointer dismiss.
5. `ReportButton` modal open and `Escape` key dismissal.

### End-to-End Browser Test Matrix (Playwright)
Executes multi-modal browser simulations across desktop, mobile touch, and safari viewports:

```bash
# Run full interaction matrix
npm run test:e2e:interaction-matrix

# Run dedicated desktop keyboard project
npm run test:e2e:keyboard

# Run dedicated desktop pointer project
npm run test:e2e:pointer

# Run mobile touch emulation project
npm run test:e2e:touch
```

Playwright matrix projects defined in `playwright.config.ts`:
- `interaction-desktop-keyboard`: Desktop Chrome without touch emulation, focusing on Tab/Enter/Escape navigation.
- `interaction-desktop-pointer`: Desktop Chrome with mouse hover and fine pointer click.
- `interaction-mobile-touch`: Pixel 5 touch emulation with mobile layout, testing tap responsiveness without hover reliance.
- `interaction-safari-touch`: iPhone 13 Safari touch emulation.
