/**
 * BudgetManager
 *
 * Tracks per-user, per-session differential privacy budget.
 * Budget is stored in localStorage and resets daily.
 *
 * - dailyEpsilon ≤ 1.0 (strong privacy per issue #118)
 * - delta ≤ 1e-5
 * - Composition tracked via simple sequential composition (conservative)
 */

import type { BudgetConfig, BudgetState, EventCategory } from '../types'

const STORAGE_KEY = 'dp_budget'

export const DEFAULT_CONFIG: BudgetConfig = {
  dailyEpsilon: 1.0,
  delta: 1e-5,
  epsilonPerCategory: {
    navigation: 0.05,
    price_view: 0.1,
    alert_interaction: 0.1,
    export: 0.2,
    search: 0.1,
  },
}

function dayStartMs(): number {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.getTime()
}

function emptyState(config: BudgetConfig): BudgetState {
  return {
    spentToday: 0,
    remaining: config.dailyEpsilon,
    spentPerCategory: {
      navigation: 0,
      price_view: 0,
      alert_interaction: 0,
      export: 0,
      search: 0,
    },
    resetAt: dayStartMs() + 86_400_000,
    optedOut: false,
  }
}

export class BudgetManager {
  private config: BudgetConfig
  private state: BudgetState

  constructor(config: BudgetConfig = DEFAULT_CONFIG) {
    this.config = config
    this.state = this.load()
  }

  /** Load from localStorage, resetting if the daily window has elapsed. */
  private load(): BudgetState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as BudgetState
        if (Date.now() < saved.resetAt) return saved
      }
    } catch {
      // ignore parse errors
    }
    return emptyState(this.config)
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch {
      // ignore quota errors
    }
  }

  getState(): Readonly<BudgetState> {
    return this.state
  }

  isOptedOut(): boolean {
    return this.state.optedOut
  }

  setOptOut(value: boolean): void {
    this.state.optedOut = value
    this.persist()
  }

  /**
   * Try to consume epsilon for a category.
   * Returns true if budget was available and consumed; false if exhausted or opted out.
   */
  consume(category: EventCategory): boolean {
    if (this.state.optedOut) return false

    const cost = this.config.epsilonPerCategory[category] ?? 0.1
    if (this.state.remaining < cost) return false

    this.state.spentToday += cost
    this.state.remaining -= cost
    this.state.spentPerCategory[category] = (this.state.spentPerCategory[category] ?? 0) + cost
    this.persist()
    return true
  }

  reset(): void {
    this.state = emptyState(this.config)
    this.persist()
  }
}
