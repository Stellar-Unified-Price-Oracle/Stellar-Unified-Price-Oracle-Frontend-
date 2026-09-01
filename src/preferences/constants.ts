import type {
  AccessibilityPreferences,
  DataPreferences,
  LayoutPreferences,
  Preferences,
  PrivacyPreferences,
  LocaleCode,
} from './types'
import type { BacktestPreset } from '../utils/backtest'

export const DEFAULT_BACKTEST_PRESETS: BacktestPreset[] = [
  {
    id: 'conservative-median',
    name: 'Conservative Median',
    config: {
      mode: 'median',
      outlierThresholdPercent: 1.5,
      minSources: 2,
      confidenceWeighting: true,
      maxStalenessSec: 300,
    },
  },
  {
    id: 'strict-outlier',
    name: 'Strict Outlier Filter',
    config: {
      mode: 'trimmed_mean',
      outlierThresholdPercent: 0.8,
      minSources: 3,
      confidenceWeighting: true,
      maxStalenessSec: 180,
    },
  },
  {
    id: 'confidence-weighted',
    name: 'Weighted Confidence',
    config: {
      mode: 'weighted_mean',
      outlierThresholdPercent: 2.0,
      minSources: 2,
      confidenceWeighting: true,
      maxStalenessSec: 600,
    },
  },
]

/** Defaults grouped to match the slices in `slices.ts`. */
export const DEFAULT_DATA_PREFERENCES: DataPreferences = {
  refreshInterval: 10000,
  chartTimeRange: '24h',
  staleThresholdMinutes: 5,
  sourcePriority: ['chainlink', 'redstone', 'band', 'reflector'],
  onChainDivergenceThresholdPercent: 1,
  backtestPresets: DEFAULT_BACKTEST_PRESETS,
}

export const DEFAULT_LAYOUT_PREFERENCES: LayoutPreferences = {
  dashboardView: 'card',
  cardOrder: [],
}

export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  reducedMotion: false,
  highContrast: false,
  largeText: false,
  rtlEnabled: false,
}

export const DEFAULT_PRIVACY_PREFERENCES: PrivacyPreferences = {
  analyticsOptOut: false,
  chartTimezone: 'UTC',
  formatLocale: 'auto',
  showExcludedSources: false,
} as const

export const MAX_UNDO_DEPTH = 20

/**
 * Flat composite of all default preference slices.
 * Consumed by PreferencesContext, the Zustand preferences store, and tests.
 */
export const DEFAULT_PREFERENCES: Preferences = {
  ...DEFAULT_DATA_PREFERENCES,
  ...DEFAULT_LAYOUT_PREFERENCES,
  ...DEFAULT_ACCESSIBILITY_PREFERENCES,
  ...DEFAULT_PRIVACY_PREFERENCES,
}

export const REFRESH_INTERVAL_OPTIONS = [
  { value: 5000, label: '5 seconds' },
  { value: 10000, label: '10 seconds' },
  { value: 30000, label: '30 seconds' },
  { value: 60000, label: '1 minute' },
] as const

export const CHART_RANGE_OPTIONS = [
  { value: '24h' as const, label: '24 Hours' },
  { value: '7d' as const, label: '7 Days' },
  { value: '30d' as const, label: '30 Days' },
] as const

export const STALE_THRESHOLD_OPTIONS = [
  { value: 1, label: '1 minute' },
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
] as const

export const DIVERGENCE_THRESHOLD_OPTIONS = [
  { value: 0.5, label: '0.5%' },
  { value: 1, label: '1%' },
  { value: 2, label: '2%' },
  { value: 5, label: '5%' },
] as const

export const CHART_TIMEZONE_OPTIONS = [
  { value: 'UTC' as const, label: 'UTC', abbr: 'UTC' },
  { value: 'Local' as const, label: 'Local', abbr: 'Local' },
  { value: 'America/New_York' as const, label: 'New York (ET)', abbr: 'ET' },
  { value: 'Europe/London' as const, label: 'London (GMT/BST)', abbr: 'London' },
  { value: 'Asia/Tokyo' as const, label: 'Tokyo (JST)', abbr: 'JST' },
] as const

export const FORMAT_LOCALE_OPTIONS: { value: LocaleCode; label: string; example: string }[] = [
  { value: 'auto', label: 'Auto (from language)', example: '1,234.56' },
  { value: 'en-US', label: 'English (US)', example: '1,234.56' },
  { value: 'de-DE', label: 'Deutsch (Deutschland)', example: '1.234,56' },
  { value: 'fr-FR', label: 'Français (France)', example: '1 234,56' },
  { value: 'ja-JP', label: '日本語 (日本)', example: '1,234.56' },
  { value: 'es-ES', label: 'Español (España)', example: '1.234,56' },
  { value: 'ar-SA', label: 'العربية (السعودية)', example: '١٬٢٣٤٫٥٦' },
  { value: 'pt-BR', label: 'Português (Brasil)', example: '1.234,56' },
] as const
