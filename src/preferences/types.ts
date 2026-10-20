import type { BacktestPreset } from '../utils/backtest'
import type { AnalyticsConsent } from '../utils/analyticsConsent'

export type ChartTimeRange = '24h' | '7d' | '30d'
export type RefreshInterval = 5000 | 10000 | 30000 | 60000 | 300000
export type ChartHistoryPageSize = 50 | 100 | 250
export type DashboardView = 'card' | 'table'
/** Spacing between dashboard tiles: tighter to show more pairs, looser to read each one. */
export type DashboardDensity = 'compact' | 'comfortable' | 'spacious'
export type ChartTimezone = 'UTC' | 'Local' | 'America/New_York' | 'Europe/London' | 'Asia/Tokyo'
/**
 * When a dismissed inline explanation may show again (#822).
 * `never` keeps it hidden for good, `weekly` brings it back after seven days, and
 * `always` ignores dismissals.
 */
export type ExplanationReappearPolicy = 'never' | 'weekly' | 'always'
export type LocaleCode = 'auto' | 'en-US' | 'de-DE' | 'fr-FR' | 'ja-JP' | 'es-ES' | 'ar-SA' | 'he' | 'pt-BR'
/** `auto` keeps the scale-based precision of `formatPrice`; a number fixes the decimal places. */
export type PricePrecision = 'auto' | 2 | 4 | 6 | 8
/** Table columns the user can hide. Pair, price, and the alert action always show. */
export type ToggleableTableColumn = 'confidence' | 'sources' | 'timestamp'

/** How often and over what window price data is fetched and judged stale. */
export interface DataPreferences {
  refreshInterval: RefreshInterval
  chartTimeRange: ChartTimeRange
  /** Maximum history points fetched in each chart page. */
  chartHistoryPageSize: ChartHistoryPageSize
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
  density: DashboardDensity
  cardOrder: string[]
  /** Decimal places used when displaying prices on the dashboard and tables. */
  pricePrecision: PricePrecision
  /** Table columns hidden by the user (#813). */
  hiddenTableColumns: ToggleableTableColumn[]
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
  /** Granular opt-in/opt-out preferences for product analytics (#847) */
  analyticsConsent?: AnalyticsConsent
  chartTimezone: ChartTimezone
  formatLocale: LocaleCode
  /** #461 – Whether to render excluded-outlier source ticks on the price chart. */
  showExcludedSources: boolean
}

/**
 * The full preference set, flattened from the slices above.
 *
 * Kept flat so consumers read `preferences.refreshInterval` rather than
 * `preferences.data.refreshInterval`. The slices exist to give each concern an owner —
 * see `slices.ts` for the reducers that enforce it.
 */
export interface Preferences extends DataPreferences, LayoutPreferences, AccessibilityPreferences, PrivacyPreferences {}
