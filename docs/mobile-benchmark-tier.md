# Benchmark Key Dashboard Interactions on a Documented Mobile Device Tier (#862)

## Overview

Modern decentralized finance applications must ensure fluid, predictable responsiveness on resource-constrained mobile hardware. On the Stellar network, where transactions settle in seconds, oracle dashboard latency directly affects a trader or validator's situational awareness.

This document establishes the **Tier-2 Mobile Reference Profile**, specifies strict **Service Level Agreement (SLA) latency budgets** for key dashboard interactions, describes the benchmarking methodology, and details both the automated CLI test runner and the interactive in-app benchmark panel.

---

## 1. Documented Mobile Device Tier Specification

The Oracle Frontend benchmarks against a standardized **Tier-2 Mobile Reference** device profile, consistent with W3C Web Performance and Google Lighthouse mobile reference hardware standards.

| Parameter | Specification | Rationale |
| :--- | :--- | :--- |
| **Reference Device** | **Moto G4 / Snapdragon 617-class SoC** | Represents the 50th–75th percentile global mobile device profile. |
| **CPU Emulation** | **4× Slowdown Factor** | Simulates mid/low-tier octa-core ARM Cortex-A53 CPU throttling under sustained thermal load. |
| **RAM Budget** | **2 GB System RAM / ≤ 64 MB JS Heap** | Guards against mobile browser garbage collection stalls and out-of-memory tab crashes. |
| **Network Profile** | **Fast 3G** (1.6 Mbps down, 750 kbps up, 150 ms RTT) | Emulates real-world mobile cell edge connectivity and high latency spikes. |
| **Screen Viewports** | **360 × 640 dp** (Android baseline) & **375 × 812 dp** (iOS baseline) | Tests responsive layout wrapping, horizontal overflow, and virtualized list viewport culling. |
| **Touch Standards** | **≥ 44 × 44 px target size** with visual tap-state feedback | Meets WCAG 2.1 Target Size (Enhanced) Level AAA criteria. |

---

## 2. Key Dashboard Interaction Budgets (SLAs)

Every critical dashboard interaction has an explicit, measurable latency budget. Measurements are evaluated at the **95th percentile (P95)** over multiple execution cycles:

```text
STATUS CRITERIA:
  PASS : P95 <= Target Budget
  WARN : Target Budget < P95 <= Warn Threshold (1.5x)
  FAIL : P95 > Warn Threshold
```

| Interaction Benchmark | Target Budget (P95) | Warn Threshold | Description & Invariants |
| :--- | :---: | :---: | :--- |
| **`timeframe_switch`** | **≤ 100 ms** | 150 ms | Resamples 1,000 raw price history points into 15m OHLC candles, recalculates SMA-20, EMA-12, and statistical volatility bands. |
| **`pair_selection`** | **≤ 120 ms** | 180 ms | Switches the active pair, queries multi-source quotes, derives median consensus across 5 oracle providers, and checks deviation thresholds. |
| **`feed_filter_search`** | **≤ 50 ms** | 75 ms | Performs real-time multi-term search and confidence filtering across 350+ price feeds without UI thread jank. |
| **`governance_export_serialization`** | **≤ 150 ms** | 220 ms | Serializes 500+ immutable governance audit log events to RFC 4180 CSV and audit JSON documents without blocking rendering. |
| **`conflict_disclosures_filter`** | **≤ 60 ms** | 90 ms | Evaluates multi-category materiality and provenance verification status across 120+ operator disclosures. |

---

## 3. Benchmarking Architecture & Harness

The benchmark harness is located in [`src/perf/mobileBenchmarks.ts`](../src/perf/mobileBenchmarks.ts).

### Features
1. **High-Resolution Clock**: Uses monotonic `performance.now()` for sub-millisecond precision.
2. **Warmup Cycles**: Executes warmup cycles prior to sample capture to allow V8/SpiderMonkey JIT compiler optimization, eliminating cold-start bias.
3. **Hardware Slowdown Scaling**: Applies a `cpuSlowdownFactor` (default `4x`) to benchmark runs executing on modern desktop hardware, producing realistic mobile estimates.
4. **Deterministic Datasets**: Uses synthetic, seeded generators (`generateSyntheticFeeds`, `generateSyntheticHistory`, `generateSyntheticGovernanceEvents`, `generateSyntheticDisclosures`) to guarantee reproducibility across CI runs.
5. **Statistical Distribution**: Captures min, max, mean, median (P50), and 95th percentile (P95).

---

## 4. How to Run Benchmarks

### 4.1 CLI Automated Runner
Run the benchmark suite from the terminal via npm:

```bash
npm run bench:mobile
```

Or customize iteration counts:
```bash
node scripts/benchmark-mobile.mjs 20
```

#### Example Output:
```text
================================================================================
  Mobile Device Tier Interaction Benchmarks (#862)
================================================================================
Tier Reference:     Tier-2 Mobile Reference
Device Hardware:    Moto G4 / Snapdragon 617-class SoC
CPU Emulation:      4x Slowdown Factor
Memory Budget:      64 MB JS Heap
Network Profile:    Fast 3G (1.6 Mbps down, 750 kbps up, 150 ms RTT)
Viewport Baseline:  360x640 (Mobile Android default)
Iterations:         10 cycles (warmup: 2)
--------------------------------------------------------------------------------
Interaction                               Budget        P95 (ms)      Status
--------------------------------------------------------------------------------
Timeframe & Interval Switch               <= 100 ms     2.81 ms       PASS
Feed / Pair Selection                     <= 120 ms     0.10 ms       PASS
Feed Search & Multi-Facet Filter          <= 50 ms      2.20 ms       PASS
Governance Audit Export Serialization     <= 150 ms     11.51 ms      PASS
Operator Disclosures Filter Evaluation    <= 60 ms      0.45 ms       PASS
--------------------------------------------------------------------------------
Summary: 5 passed, 0 warned, 0 failed out of 5 benchmarks.

SUCCESS: All dashboard interactions satisfied Tier-2 mobile SLA budgets!
```

### 4.2 Interactive In-App UI Component
The [`MobileBenchmarkPanel`](../src/components/MobileBenchmarkPanel.tsx) component provides an interactive interface for running benchmarks directly in mobile browsers:

- **Run Benchmarks**: One-click execution with real-time spinner and ARIA live region status announcements.
- **Specification Inspector**: Collapsible details reviewing Tier-2 mobile constraints.
- **Visual Budget Comparison**: Progress bars displaying ratio of measured latency against SLA target.
- **JSON Audit Export**: Instant browser download of benchmark telemetry (`mobile-benchmarks-tier2-<timestamp>.json`).
- **Resilient States**: Includes full coverage for empty states, running/loading states, and error alerts with retry triggers.

---

## 5. Automated Testing & Continuous Integration

- **Engine Unit Tests**: [`src/perf/mobileBenchmarks.test.ts`](../src/perf/mobileBenchmarks.test.ts) (13 tests verifying data generators, statistical calculations, and SLA compliance).
- **Component Tests**: [`src/components/MobileBenchmarkPanel.test.tsx`](../src/components/MobileBenchmarkPanel.test.tsx) (5 tests covering rendering, execution, accessibility, and JSON export).
- **Exit Code Guard**: `scripts/benchmark-mobile.mjs` exits with code `0` on success and `1` on budget failure, enabling seamless gating in GitHub Actions CI workflows.
