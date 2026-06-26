/**
 * usePrivacyAnalytics
 *
 * React hook wrapping PrivacyPipeline.  Provides:
 *  - record(category)  – record an event with local DP noise
 *  - optOut / optIn    – granular per-session opt-out (takes effect immediately)
 *  - budgetState       – live snapshot of remaining epsilon budget
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { PrivacyPipeline } from '../privacy/pipeline/PrivacyPipeline'
import type { BudgetState, EventCategory } from '../privacy/types'

let sharedPipeline: PrivacyPipeline | null = null

function getPipeline(): PrivacyPipeline {
  if (!sharedPipeline) sharedPipeline = new PrivacyPipeline()
  return sharedPipeline
}

export function usePrivacyAnalytics() {
  const pipeline = useRef(getPipeline())
  const [budgetState, setBudgetState] = useState<BudgetState>(() =>
    pipeline.current.getBudgetManager().getState() as BudgetState,
  )

  // Refresh state snapshot after each mutation
  const refresh = useCallback(() => {
    setBudgetState({ ...pipeline.current.getBudgetManager().getState() } as BudgetState)
  }, [])

  const record = useCallback(
    (category: EventCategory) => {
      pipeline.current.record(category)
      refresh()
    },
    [refresh],
  )

  const optOut = useCallback(() => {
    pipeline.current.getBudgetManager().setOptOut(true)
    refresh()
  }, [refresh])

  const optIn = useCallback(() => {
    pipeline.current.getBudgetManager().setOptOut(false)
    refresh()
  }, [refresh])

  // Re-sync if another tab mutates localStorage
  useEffect(() => {
    const handler = () => refresh()
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [refresh])

  return { budgetState, record, optOut, optIn }
}
