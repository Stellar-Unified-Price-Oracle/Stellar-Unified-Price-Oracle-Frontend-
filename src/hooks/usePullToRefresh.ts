import { useCallback, useEffect, useRef, useState } from 'react'

export interface PullToRefreshOptions {
  /** Distance in px the user must pull before a refresh is triggered. Defaults to 80. */
  threshold?: number
  /** Maximum visual pull distance in px. Defaults to 120. */
  maxPull?: number
  /** Called when the pull distance exceeds the threshold and the user releases. */
  onRefresh: () => void | Promise<void>
  /** Whether the gesture is disabled (e.g. already refreshing, or reducedMotion). */
  disabled?: boolean
}

export interface PullToRefreshState {
  /** Current pull distance in pixels (0 = no pull). */
  pullDistance: number
  /** Whether the user has pulled far enough to trigger on release. */
  readyToRefresh: boolean
  /** Whether an async refresh is in progress. */
  refreshing: boolean
}

export interface PullToRefreshHandlers {
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
}

/**
 * Implements pull-to-refresh behaviour for a scrollable container.
 *
 * Only fires when the target element is scrolled to the top (scrollTop === 0),
 * so normal scrolling still works.
 *
 * Usage:
 * ```tsx
 * const { state, handlers } = usePullToRefresh({ onRefresh: refetch })
 * return (
 *   <div {...handlers}>
 *     {state.pullDistance > 0 && <PullIndicator {...state} />}
 *     {children}
 *   </div>
 * )
 * ```
 */
export function usePullToRefresh(
  containerRef: React.RefObject<HTMLElement | null>,
  options: PullToRefreshOptions,
): { state: PullToRefreshState; handlers: PullToRefreshHandlers } {
  const { threshold = 80, maxPull = 120, onRefresh, disabled = false } = options

  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const startYRef = useRef<number | null>(null)
  const isPullingRef = useRef(false)

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || refreshing) return
      const el = containerRef.current
      // Only start a pull when the container is scrolled to the very top
      if (el && el.scrollTop > 0) return
      startYRef.current = e.touches[0].clientY
      isPullingRef.current = false
    },
    [disabled, refreshing, containerRef],
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || refreshing || startYRef.current === null) return

      const dy = e.touches[0].clientY - startYRef.current
      if (dy <= 0) {
        // User scrolling up, not pulling down
        setPullDistance(0)
        isPullingRef.current = false
        return
      }

      isPullingRef.current = true
      // Apply resistance: slower pull as distance increases
      const resistance = 0.4
      const clamped = Math.min(dy * resistance, maxPull)
      setPullDistance(clamped)

      // Prevent default page scroll when actively pulling
      if (clamped > 10) {
        e.preventDefault()
      }
    },
    [disabled, refreshing, maxPull],
  )

  const onTouchEnd = useCallback(async () => {
    if (!isPullingRef.current || startYRef.current === null) {
      startYRef.current = null
      return
    }

    startYRef.current = null
    isPullingRef.current = false

    if (pullDistance >= threshold) {
      setRefreshing(true)
      setPullDistance(0)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
      }
    } else {
      setPullDistance(0)
    }
  }, [pullDistance, threshold, onRefresh])

  // Reset when disabled externally
  useEffect(() => {
    if (disabled) {
      setPullDistance(0)
      startYRef.current = null
      isPullingRef.current = false
    }
  }, [disabled])

  return {
    state: {
      pullDistance,
      readyToRefresh: pullDistance >= threshold,
      refreshing,
    },
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd: onTouchEnd as unknown as (e: React.TouchEvent) => void,
    },
  }
}
