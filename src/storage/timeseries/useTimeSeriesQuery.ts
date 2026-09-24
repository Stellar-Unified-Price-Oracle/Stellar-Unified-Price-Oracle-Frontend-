import { useCallback, useEffect, useState } from 'react'
import { timeSeries } from './engine'
import type { TsPoint, TsTier } from './types'

export interface UseTimeSeriesQueryOptions {
  /** Inclusive lower bound (ms). */
  from: number
  /** Inclusive upper bound (ms). */
  to: number
  /** Force a tier instead of letting the planner choose. */
  tier?: TsTier
  /** Soft point budget for the planner. */
  maxPoints?: number
}

export interface UseTimeSeriesQueryResult {
  points: TsPoint[]
  loading: boolean
  error: string | null
  /** Re-runs the query immediately (e.g. after an append). */
  refresh: () => void
}

/**
 * Range-queries a time-series and re-runs on writes to that series (local or
 * from another tab). Thin wrapper over {@link timeSeries.query}.
 */
export function useTimeSeriesQuery(series: string, options: UseTimeSeriesQueryOptions): UseTimeSeriesQueryResult {
  const { from, to, tier, maxPoints } = options
  const [points, setPoints] = useState<TsPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const refresh = useCallback(() => setVersion((value) => value + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    timeSeries
      .query({ series, from, to, tier, maxPoints })
      .then((result) => {
        if (cancelled) return
        setPoints(result)
        setError(null)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Failed to load time series')
        setLoading(false)
      })

    const unsubscribe = timeSeries.subscribe(series, refresh)

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [series, from, to, tier, maxPoints, version, refresh])

  return { points, loading, error, refresh }
}
