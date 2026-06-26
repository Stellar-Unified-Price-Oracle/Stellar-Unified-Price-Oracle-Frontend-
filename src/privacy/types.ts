/** Privacy-related TypeScript types */

export type EventCategory = 'navigation' | 'price_view' | 'alert_interaction' | 'export' | 'search'

export interface BudgetConfig {
  /** Maximum total epsilon per day (strong privacy: ≤1.0) */
  dailyEpsilon: number
  /** Negligible failure probability (≤1e-5) */
  delta: number
  /** Epsilon cost per category */
  epsilonPerCategory: Record<EventCategory, number>
}

export interface BudgetState {
  spentToday: number
  remaining: number
  spentPerCategory: Record<EventCategory, number>
  resetAt: number  // unix ms
  optedOut: boolean
}

export interface NoisedEvent {
  category: EventCategory
  noisedValue: number
  epsilon: number
  timestamp: number
}
