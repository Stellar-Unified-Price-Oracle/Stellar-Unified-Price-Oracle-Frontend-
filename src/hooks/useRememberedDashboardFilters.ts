import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { hasFilterParams, readRememberedFilters } from '../utils/dashboardFilterMemory'

/**
 * Applies remembered dashboard filters once per mount, when the URL carries none (#812).
 *
 * The URL always wins: a shared or bookmarked link with its own filters is left
 * alone. The ref guard stops the restore from firing again after the user clears
 * their filters, which would otherwise bring the remembered set straight back.
 */
export function useRestoreRememberedFilters(): void {
  const [searchParams, setSearchParams] = useSearchParams()
  const restoredRef = useRef(false)

  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    if (hasFilterParams(searchParams)) return

    const remembered = readRememberedFilters()
    if (!remembered || [...remembered.keys()].length === 0) return

    const next = new URLSearchParams(searchParams)
    remembered.forEach((value, key) => next.set(key, value))
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])
}
