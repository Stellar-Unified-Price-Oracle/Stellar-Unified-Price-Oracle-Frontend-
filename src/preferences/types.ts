import type { BacktestPreset } from '../utils/backtest'

export type ChartTimeRange = '24h' | '7d' | '30d'
export type RefreshInterval = 5000 | 10000 | 30000 | 60000
export type DashboardView = 'card' | 'table'
export type ChartTimezone = 'UTC' | 'Local' | 'America/New_York' | 'Europe/London' | 'Asia/Tokyo'
export type LocaleCode = 'auto' | 'en-US' | 'de-DE' | 'fr-FR' | 'ja-JP' | 'es-ES' | 'ar-SA' | 'pt-BR'

/** How often and over what window price data is fetched and judged stale. */
export interface DataPreferences {
  refreshInterval: RefreshInterval
  chartTimeRange: ChartTimeRange
  staleThresholdMinutes: number
  /** Priority order of oracle sources to prefer as the "active" source for a feed. */
  sourcePriority: string[]
  /** Percentage divergence between off-chain and on-chain price that flags a pair as breached. */
  onChainDivergenceThresholdPercent: number
  /** User-saved presets for aggregation parameter backtesting (#464). */
  backtestPresets?: BacktestPreset[]
}

/** How the dashboard arranges what it shows. */
export interface LayoutPreferences {
  dashboardView: DashboardView
  cardOrder: string[]
}

/** Presentation overrides for users with accessibility needs. */
export interface AccessibilityPreferences {
  reducedMotion: boolean
  highContrast: boolean
  largeText: boolean
  /** Force RTL layout regardless of detected language, for testing / preference override. */
  rtlEnabled: boolean
}

/** User choices about data collection. */
export interface PrivacyPreferences {
  analyticsOptOut?: boolean
  chartTimezone: ChartTimezone
  formatLocale: LocaleCode
}

/**
 * The full preference set, flattened from the slices above.
 *
 * Kept flat so consumers read `preferences.refreshInterval` rather than
 * `preferences.data.refreshInterval`. The slices exist to give each concern an owner —
 * see `slices.ts` for the reducers that enforce it.
 */
export interface Preferences
  extends DataPreferences,
    LayoutPreferences,
    AccessibilityPreferences,
    PrivacyPreferences {}
