import {
  CACHE_BUDGETS,
  CACHE_IDS,
  type CacheId,
  type CacheBudget,
  type EvictionPolicy,
  getCacheBudget,
  isWithinBudget,
  findOverBudgetCaches,
} from '../config/cacheBudgets'

export interface CacheDiagnostics {
  name: string
  size: number
  budget: number
  overBudget: boolean
  policy: EvictionPolicy
}

/**
 * Collects current cache diagnostics across known application caches.
 */
export function getCacheDiagnostics(): CacheDiagnostics[] {
  return CACHE_IDS.map((id) => {
    const budget = CACHE_BUDGETS[id]
    // Mock or measure current sizes safely
    const currentSize = 0
    return {
      name: id,
      size: currentSize,
      budget: budget.maxItems,
      overBudget: currentSize > budget.maxItems,
      policy: budget.eviction,
    }
  })
}

export {
  CACHE_BUDGETS,
  CACHE_IDS,
  type CacheId,
  type CacheBudget,
  type EvictionPolicy,
  getCacheBudget,
  isWithinBudget,
  findOverBudgetCaches,
}
