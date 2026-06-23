export type ChartTimeRange = '24h' | '7d' | '30d'
export type RefreshInterval = 5000 | 10000 | 30000 | 60000

export interface Preferences {
  refreshInterval: RefreshInterval
  chartTimeRange: ChartTimeRange
  staleThresholdMinutes: number
}
