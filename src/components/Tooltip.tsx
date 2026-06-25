import { useState, useRef, useEffect, type ReactNode } from 'react'

interface TooltipProps {
  content: string
  children: ReactNode
}

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!visible) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false)
    }
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setVisible(false)
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [visible])

  return (
    <span ref={ref} className="relative inline-flex items-center">
      <span
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        tabIndex={0}
        role="button"
        aria-describedby={visible ? 'tooltip-popup' : undefined}
        className="cursor-help focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500 rounded"
      >
        {children}
      </span>
      {visible && (
        <span
          id="tooltip-popup"
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-xs text-gray-200 shadow-xl pointer-events-none"
        >
          {content}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-700" />
        </span>
      )}
    </span>
  )
}
