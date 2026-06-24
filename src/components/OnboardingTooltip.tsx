import { useState, useRef, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: ReactNode
  /** Controls whether the tooltip is shown */
  visible?: boolean
  /** Position relative to the anchor */
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** Dismiss callback */
  onDismiss?: () => void
  children: ReactNode
}

export function OnboardingTooltip({
  content,
  visible = false,
  placement = 'bottom',
  onDismiss,
  children,
}: TooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!visible || !anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const GAP = 8
    let top = 0
    let left = 0

    switch (placement) {
      case 'top':
        top = rect.top - GAP
        left = rect.left + rect.width / 2
        break
      case 'bottom':
        top = rect.bottom + GAP
        left = rect.left + rect.width / 2
        break
      case 'left':
        top = rect.top + rect.height / 2
        left = rect.left - GAP
        break
      case 'right':
        top = rect.top + rect.height / 2
        left = rect.right + GAP
        break
    }
    setPos({ top, left })
  }, [visible, placement])

  if (!visible) return <span ref={anchorRef}>{children}</span>

  const transformMap: Record<string, string> = {
    top: 'translate(-50%, -100%)',
    bottom: 'translate(-50%, 0)',
    left: 'translate(-100%, -50%)',
    right: 'translate(0, -50%)',
  }

  return (
    <>
      <span ref={anchorRef}>{children}</span>
      {createPortal(
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            transform: transformMap[placement],
            zIndex: 10000,
          }}
          className="max-w-xs bg-gray-900 border border-cyan-500/40 rounded-xl shadow-2xl p-3 text-sm text-gray-200 animate-in fade-in"
        >
          <div className="mb-2">{content}</div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
            >
              Got it
            </button>
          )}
        </div>,
        document.body,
      )}
    </>
  )
}
