/**
 * Privacy-preserving analytics pipeline (local DP).
 *
 * Flow:
 *  1. Event captured
 *  2. Budget check (enough epsilon remaining?)
 *  3. Laplace noise applied to the count contribution (always 1)
 *  4. Noised event queued for (future) transmission
 *
 * In this frontend-only implementation the queue is held in memory and
 * exposed so the caller can flush it to any analytics endpoint.
 */

import { BudgetManager, DEFAULT_CONFIG } from '../budget/BudgetManager'
import { laplace } from '../mechanisms/noise'
import type { EventCategory, NoisedEvent } from '../types'

export class PrivacyPipeline {
  private budget: BudgetManager
  private queue: NoisedEvent[] = []

  constructor(budget?: BudgetManager) {
    this.budget = budget ?? new BudgetManager(DEFAULT_CONFIG)
  }

  /** Record an event, applying local DP noise. Returns true if recorded. */
  record(category: EventCategory): boolean {
    if (!this.budget.consume(category)) return false

    const epsilon = DEFAULT_CONFIG.epsilonPerCategory[category] ?? 0.1
    // Sensitivity=1 for a binary contribution (did-event: 0 or 1)
    const noisedValue = laplace(1, 1, epsilon)

    this.queue.push({ category, noisedValue, epsilon, timestamp: Date.now() })
    return true
  }

  /** Flush and return all queued noised events, clearing the queue. */
  flush(): NoisedEvent[] {
    const batch = this.queue.splice(0)
    return batch
  }

  getBudgetManager(): BudgetManager {
    return this.budget
  }
}
