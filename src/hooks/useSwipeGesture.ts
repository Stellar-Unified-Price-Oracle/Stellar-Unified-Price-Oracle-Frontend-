import { useCallback, useRef } from 'react'

export type SwipeDirection = 'left' | 'right' | 'up' | 'down'

export interface SwipeGestureOptions {
  /** Minimum distance in pixels to count as a swipe. Defaults to 50. */
  threshold?: number
  /** Maximum allowed perpendicular movement as a ratio (0–1). Defaults to 0.5. */
  directionLock?: number
  /** Whether touch events are disabled (e.g. reducedMotion). Defaults to false. */
  disabled?: boolean
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
}

export interface SwipeGestureHandlers {
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
}

/**
 * Returns touch event handlers that detect swipe gestures on an element.
 *
 * Usage:
 * ```tsx
 * const handlers = useSwipeGesture({ onSwipeLeft: () => navigate(-1) })
 * return <div {...handlers}>…</div>
 * ```
 */
export function useSwipeGesture(options: SwipeGestureOptions): SwipeGestureHandlers {
  const {
    threshold = 50,
    directionLock = 0.5,
    disabled = false,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
  } = options

  const startRef = useRef<{ x: number; y: number } | null>(null)

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return
      const touch = e.changedTouches[0]
      startRef.current = { x: touch.clientX, y: touch.clientY }
    },
    [disabled],
  )

  const onTouchMove = useCallback(
    (_e: React.TouchEvent) => {
      // No-op: we only need start + end points
    },
    [],
  )

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || !startRef.current) return

      const touch = e.changedTouches[0]
      const dx = touch.clientX - startRef.current.x
      const dy = touch.clientY - startRef.current.y
      startRef.current = null

      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      // Neither axis meets the threshold — too short, ignore
      if (absDx < threshold && absDy < threshold) return

      if (absDx >= absDy) {
        // Horizontal swipe
        const lockRatio = absDx > 0 ? absDy / absDx : 1
        if (lockRatio > directionLock) return // too diagonal
        if (dx < 0) {
          onSwipeLeft?.()
        } else {
          onSwipeRight?.()
        }
      } else {
        // Vertical swipe
        const lockRatio = absDy > 0 ? absDx / absDy : 1
        if (lockRatio > directionLock) return
        if (dy < 0) {
          onSwipeUp?.()
        } else {
          onSwipeDown?.()
        }
      }
    },
    [disabled, threshold, directionLock, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown],
  )

  return { onTouchStart, onTouchMove, onTouchEnd }
}
