/**
 * @file Tooltip
 *
 * A lightweight accessible tooltip that appears above its trigger element on
 * hover and keyboard focus, and dismisses on `Escape` or outside click.
 *
 * @example Basic usage
 * ```tsx
 * <Tooltip content="Oracle confidence is calculated as the weighted mean deviation">
 *   <span className="underline decoration-dotted">confidence</span>
 * </Tooltip>
 * ```
 *
 * @example Wrapping an icon button
 * ```tsx
 * <Tooltip content="Export price data">
 *   <button type="button" aria-label="Export">
 *     <DownloadIcon />
 *   </button>
 * </Tooltip>
 * ```
 *
 * ## Props table
 * | prop       | type        | required | description                              |
 * |------------|-------------|----------|------------------------------------------|
 * | `content`  | `string`    | yes      | Text shown inside the tooltip popup      |
 * | `children` | `ReactNode` | yes      | The element the tooltip is anchored to   |
 *
 * ## Edge cases
 * - **Long content** — the popup is fixed at `w-56` (14 rem). Content that overflows
 *   wraps naturally; no scroll is added.
 * - **Near viewport edge** — the popup centres above the trigger. When the trigger
 *   is near the left/right edge the popup may overflow; callers should position the
 *   trigger away from edges or override with CSS if needed.
 * - **Empty string** — renders a visible but empty popup. Prefer omitting the
 *   `Tooltip` wrapper altogether when there is no content to show.
 *
 * ## Accessibility
 * - The trigger child is wrapped in a `<span>` with `tabIndex={0}`, making it
 *   keyboard-focusable even when the child is not interactive.
 * - `aria-describedby` links the trigger to the popup while it is visible.
 * - The popup has `role="tooltip"`.
 * - Pressing `Escape` closes the popup from keyboard users.
 * - `pointer-events-none` on the popup prevents it from stealing hover/focus.
 */
import { memo, useState, useRef, useEffect, type ReactNode } from 'react'

interface TooltipProps {
  content: string
  children: ReactNode
}

export const Tooltip = memo(function Tooltip({ content, children }: TooltipProps) {
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
})
