import { useEffect } from 'react'

/**
 * Asks the browser to confirm before the page is closed or reloaded while
 * `isDirty` is true (#820).
 *
 * Covers tab close, reload and address-bar navigation. In-app route changes are
 * not covered: the app uses `BrowserRouter`, which has no navigation blocker, so
 * callers must also offer an explicit apply/discard control.
 */
export function useUnsavedChangesWarning(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])
}
