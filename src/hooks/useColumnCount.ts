import { useState, useEffect } from 'react'

const BREAKPOINTS = [
  { minWidth: 1280, columns: 4 },
  { minWidth: 1024, columns: 3 },
  { minWidth: 640, columns: 2 },
  { minWidth: 0, columns: 1 },
] as const

export function useColumnCount(ref: React.RefObject<HTMLDivElement | null>): number {
  const [columns, setColumns] = useState(4)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0
      const match = BREAKPOINTS.find((bp) => width >= bp.minWidth)
      setColumns(match?.columns ?? 1)
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return columns
}
