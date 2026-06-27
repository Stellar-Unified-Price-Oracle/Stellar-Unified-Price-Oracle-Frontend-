export type ChartTimeRange = '24h' | '7d' | '30d'
export type RefreshInterval = 5000 | 10000 | 30000 | 60000
export type DashboardView = 'card' | 'table'

export interface Preferences {
  refreshInterval: RefreshInterval
  chartTimeRange: ChartTimeRange
  staleThresholdMinutes: number
  dashboardView: DashboardView
  cardOrder: string[]
  reducedMotion: boolean
  highContrast: boolean
  largeText: boolean
  analyticsOptOut?: boolean
}
