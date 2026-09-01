import { useEffect, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { useAnnounce, type Announcement } from '../hooks/useAnnounce'

/**
 * LiveRegionContainer renders ARIA live regions for screen reader announcements.
 *
 * Creates two hidden regions for polite and assertive announcements.
 *
 * Place this component once at the app shell level (in Layout.tsx):
 *
 * ```
 * function Layout() {
 *   return (
 *     <div>
 *       <LiveRegionContainer />
 *     </div>
 *   )
 * }
 * ```
 *
 * Regions are visually hidden but remain accessible to screen readers.
 * Announcements are automatically cleaned up after 1000ms to prevent stale text.
 */
export function LiveRegionContainer(): ReactElement {
  const { subscribe } = useAnnounce()
  const politeRef = useRef<HTMLDivElement>(null)
  const assertiveRef = useRef<HTMLDivElement>(null)
  const [politeMessage, setPoliteMessage] = useState('')
  const [assertiveMessage, setAssertiveMessage] = useState('')
  const politeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>()
  const assertiveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>()

  useEffect(() => {
    const unsubscribe = subscribe((announcement: Announcement) => {
      // Update the appropriate region
      if (announcement.priority === 'polite') {
        setPoliteMessage(announcement.message)
        // Clear after delay to prevent stale announcements
        clearTimeout(politeTimeoutRef.current)
        politeTimeoutRef.current = setTimeout(() => {
          setPoliteMessage('')
        }, 1000)
      } else {
        setAssertiveMessage(announcement.message)
        // Clear after delay
        clearTimeout(assertiveTimeoutRef.current)
        assertiveTimeoutRef.current = setTimeout(() => {
          setAssertiveMessage('')
        }, 1000)
      }
    })

    return () => {
      unsubscribe()
      clearTimeout(politeTimeoutRef.current)
      clearTimeout(assertiveTimeoutRef.current)
    }
  }, [subscribe])

  return createPortal(
    <>
      {/* Polite region: waits for speech pause */}
      <div
        ref={politeRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-relevant="additions"
        className="sr-only"
        data-testid="live-region-polite"
      >
        {politeMessage}
      </div>

      {/* Assertive region: interrupts speech immediately */}
      <div
        ref={assertiveRef}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        aria-relevant="additions"
        className="sr-only"
        data-testid="live-region-assertive"
      >
        {assertiveMessage}
      </div>
    </>,
    document.body,
  )
}
