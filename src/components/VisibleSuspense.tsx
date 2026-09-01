import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'

interface VisibleSuspenseProps {
  children: ReactNode
  fallback: ReactNode
  /** Begin loading slightly before the component scrolls into view. */
  rootMargin?: string
  className?: string
  ariaLabel?: string
}

/**
 * Defers mounting a lazy component until its boundary approaches the viewport.
 * Browsers without IntersectionObserver render immediately as a safe fallback.
 */
export function VisibleSuspense({
  children,
  fallback,
  rootMargin = '160px',
  className,
  ariaLabel,
}: VisibleSuspenseProps): ReactElement {
  const boundaryRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(
    () => typeof window === 'undefined' || !('IntersectionObserver' in window),
  )

  useEffect(() => {
    if (visible || typeof IntersectionObserver === 'undefined') return

    const boundary = boundaryRef.current
    if (!boundary) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )

    observer.observe(boundary)
    return () => observer.disconnect()
  }, [rootMargin, visible])

  return (
    <div ref={boundaryRef} className={className} aria-label={ariaLabel}>
      {visible ? <Suspense fallback={fallback}>{children}</Suspense> : fallback}
    </div>
  )
}
