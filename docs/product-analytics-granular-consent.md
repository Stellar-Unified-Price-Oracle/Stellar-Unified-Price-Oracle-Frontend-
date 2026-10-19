# Granular Product Analytics Opt-In & Opt-Out Controls

This document details the architecture, privacy guarantees, data categories, and user controls for product analytics in the Stellar Unified Price Oracle frontend (#847).

---

## 1. Privacy Principles

1. **No Personal Identifiable Information (PII)**:
   - Wallet public keys, account secrets, and network IP addresses are never transmitted to telemetry providers.
2. **Do Not Track (DNT) & Global Privacy Control (GPC)**:
   - If the user's browser transmits `DNT: 1` or `navigator.globalPrivacyControl === true`, all analytics collection is automatically disabled by default, and a status banner informs the user in the Settings panel.
3. **Zero Third-Party Advertising Cookies**:
   - Telemetry is handled exclusively through privacy-focused backends (such as self-hosted Plausible or Umami instances) or direct server beacon payloads.
4. **Granular Control**:
   - Rather than an all-or-nothing toggle, users can independently opt in or out of specific functional telemetry categories.
5. **Fail-Closed & Persistent**:
   - In private browsing or when storage errors occur, the system degrades gracefully without crashing and defaults to respecting user privacy.

---

## 2. Granular Data Categories

| Category Key | Category Name | Description | Examples |
|---|---|---|---|
| `navigation` | Navigation & Page Views | Tracks route transitions and page load paths to assess UI navigation hierarchy. | Route changes, page views, external documentation links |
| `feature` | Feature Usage & Interactions | Measures interactions with core functional tools to guide product development. | Price CSV/JSON export, alert creation & dismissal, search queries, chart zoom/pan |
| `performance` | Performance & Diagnostics | Gathers Web Vitals and technical runtime metrics to keep dashboard queries fast. | LCP, FID, CLS Web Vitals, API latency, websocket reconnection counts |
| `engagement` | UI Engagement & Usability | Detects UI friction and feature discoverability. | Keyboard shortcut triggers, settings/alert drawer toggles, metric helper views |

---

## 3. Architecture & Data Flow

```
[User Interface]
       │
       ├── SettingsPanel (Granular Toggles + Master Switch)
       └── AnalyticsConsentBanner (First-Run Prompt: Accept All, Decline All, Customize)
               │
               ▼
   [analyticsConsent Utility]
       ├── isDoNotTrackActive()
       ├── isCategoryAllowed(category)
       ├── getAnalyticsConsent() / saveAnalyticsConsent()
       └── Event Dispatch ('stellar:analytics-consent-changed')
               │
               ▼
   [Storage Layer (localStorage)]
       ├── STORAGE_KEYS.analyticsConsent ('analytics-consent' JSON)
       └── STORAGE_KEYS.analyticsOptOut (Legacy compatibility sync)
               │
               ▼
   [Dispatch Pipeline (trackAnalytics / useAnalytics)]
       ├── Checks isCategoryAllowed(category)
       ├── Filters disallowed categories before dispatch
       └── Sends payload to configured provider or beacon endpoint
```

---

## 4. User-Facing Controls

### Settings Drawer (`SettingsPanel.tsx`)
- **Master Telemetry Switch**: Globally enables or disables all product analytics.
- **Granular Category Toggles**: Individual accessible switch controls for each data category.
  - When master analytics is off, individual category controls are visually and semantically disabled with ARIA attributes.
- **Quick Action Buttons**: "All" (opt in to all categories) and "None" (opt out of all categories).
- **Default Restoration**: "Reset categories to defaults" button returns configuration to baseline.
- **Local Persistence Indicator**: Confirms when preferences are saved locally on the device.

### Consent Banner (`AnalyticsConsentBanner.tsx`)
- Displays non-intrusively to users who have not yet made an explicit choice.
- Never displays if Do Not Track (DNT) is detected or if an explicit choice was already recorded.
- Includes **Accept All**, **Decline All**, and **Customize Categories** actions with accessible keyboard navigation and ARIA landmarks.

---

## 5. Backward Compatibility

For users migrating from earlier versions:
- If `STORAGE_KEYS.analyticsOptOut === '1'`, the user is seamlessly imported as `enabled: false` across all categories with `hasExplicitChoice: true`.
- If `STORAGE_KEYS.analyticsOptOut === '0'`, the user is imported as `enabled: true` with `hasExplicitChoice: true`.
- Saving granular consent updates the legacy `analyticsOptOut` key (`'0'` if enabled, `'1'` if disabled) ensuring older readers or external scripts continue to respect user consent.
