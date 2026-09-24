import { useEffect, useRef } from 'react'

export interface IntersectionObserverOptions {
  /** The element used as the viewport for checking visibility. Defaults to the browser viewport. */
  root?: Element | null
  /** Margin around the root element. */
  rootMargin?: string
  /**
   * A single threshold value or an array of threshold values between 0 and 1
   * that indicate at what percentage of the target's visibility the callback
   * should be fired.
   */
  threshold?: number | number[]
}

/**
 * Observes the intersection state of a DOM element relative to an ancestor or
 * the browser viewport.
 *
 * ## Cleanup on unmount
 *
 * The observer is **always** disconnected in the `useEffect` cleanup function,
 * regardless of which dependencies changed. This prevents resource leaks where
 * the observer continues to fire on an unmounted component and triggers "state
 * update on unmounted component" warnings.
 *
 * Without this guarantee, if the `callback` reference remained stable across
 * renders, the previous cleanup would only abort the observer when `callback`
 * changed — meaning an unmounting component could still receive intersection
 * events.
 *
 * @param targetRef - A ref attached to the DOM element to observe.
 * @param callback  - Invoked with the `IntersectionObserverEntry` each time
 *                    the element's intersection changes.
 * @param options   - Standard `IntersectionObserver` options.
 *
 * @example
 * ```tsx
 * function LazyImage({ src }: { src: string }) {
 *   const imgRef = useRef<HTMLImageElement>(null)
 *   const [visible, setVisible] = useState(false)
 *
 *   useIntersectionObserver(imgRef, (entry) => {
 *     if (entry.isIntersecting) setVisible(true)
 *   })
 *
 *   return <img ref={imgRef} src={visible ? src : undefined} alt="" />
 * }
 * ```
 */
export function useIntersectionObserver(
  targetRef: React.RefObject<Element | null>,
  callback: (entry: IntersectionObserverEntry) => void,
  options: IntersectionObserverOptions = {},
): void {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const { root = null, rootMargin = '0px', threshold = 0 } = options

  useEffect(() => {
    const target = targetRef.current
    if (!target) return

    // Always create a fresh observer so that the cleanup below can safely call
    // observer.disconnect() — even if the callback reference hasn't changed.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          callbackRef.current(entry)
        }
      },
      { root, rootMargin, threshold },
    )

    observer.observe(target)

    // Always disconnect on cleanup, regardless of which dependency changed.
    // This is the critical fix for issue #264: an observer that is only
    // disconnected when `callback` changes would continue to fire after the
    // component unmounts if the callback reference stayed stable.
    return () => {
      observer.disconnect()
    }
    // root, rootMargin, and threshold are primitive / stable references that
    // control observer configuration — they must be in deps so the observer is
    // recreated when they change.
  }, [targetRef, root, rootMargin, threshold])
}
