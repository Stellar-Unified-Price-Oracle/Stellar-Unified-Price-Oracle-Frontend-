import type { DashboardDensity } from '../preferences/types'

export const DASHBOARD_DENSITIES: readonly DashboardDensity[] = ['compact', 'comfortable', 'spacious']

export const DEFAULT_DASHBOARD_DENSITY: DashboardDensity = 'comfortable'

export const DENSITY_OPTIONS: ReadonlyArray<{ value: DashboardDensity; label: string }> = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'spacious', label: 'Spacious' },
]

const GRID_GAP_CLASS: Record<DashboardDensity, string> = {
  compact: 'gap-2',
  comfortable: 'gap-4',
  spacious: 'gap-6',
}

/** Narrows an untrusted value (e.g. a persisted preference) to a known density. */
export function toDashboardDensity(value: unknown): DashboardDensity {
  return DASHBOARD_DENSITIES.includes(value as DashboardDensity)
    ? (value as DashboardDensity)
    : DEFAULT_DASHBOARD_DENSITY
}

/** Tailwind gap utility for the dashboard tile grid at the given density. */
export function densityGridGapClass(density: DashboardDensity): string {
  return GRID_GAP_CLASS[toDashboardDensity(density)]
}
