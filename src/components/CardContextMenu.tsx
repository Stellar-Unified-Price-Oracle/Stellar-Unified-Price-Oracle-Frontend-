import { useEffect, useRef, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../context/ToastContext'
import { formatPrice } from '../utils/format'

export interface CardContextMenuAction {
  onSetAlert: () => void
  onAddToCompare?: () => void
}

interface ContextMenuProps {
  x: number
  y: number
  pair: string
  price: number
  onClose: () => void
  actions: CardContextMenuAction
}

function ContextMenuPopup({ x, y, pair, price, onClose, actions }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [focused, setFocused] = useState(0)

  const menuItems = [
    {
      label: 'View Detail',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      action: () => {
        navigate(`/price/${encodeURIComponent(pair)}`)
        onClose()
      },
    },
    {
      label: 'Set Alert',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
      action: () => {
        actions.onSetAlert()
        onClose()
      },
    },
    {
      label: 'Copy Price',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      action: () => {
        navigator.clipboard.writeText(formatPrice(price)).then(() => {
          addToast({ type: 'success', message: `Copied $${formatPrice(price)} to clipboard` })
        }).catch(() => {
          addToast({ type: 'error', message: 'Failed to copy price' })
        })
        onClose()
      },
    },
    {
      label: 'Export',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      ),
      action: () => {
        const csv = `pair,price\n${pair},${price}`
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${pair.replace('/', '-')}-price.csv`
        a.click()
        URL.revokeObjectURL(url)
        addToast({ type: 'success', message: `Exported ${pair} price` })
        onClose()
      },
    },
  ]

  // Dismiss on outside click or Escape
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocused((prev) => (prev + 1) % menuItems.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocused((prev) => (prev - 1 + menuItems.length) % menuItems.length)
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        menuItems[focused]?.action()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, focused])

  // Focus first item on mount
  useEffect(() => {
    const items = ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
    items?.[focused]?.focus()
  }, [focused])

  // Adjust position so menu stays within viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(y, window.innerHeight - 210),
    left: Math.min(x, window.innerWidth - 200),
    zIndex: 9999,
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`Actions for ${pair}`}
      style={style}
      className="w-48 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl py-1 overflow-hidden"
    >
      <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 border-b border-gray-800 mb-1">
        {pair}
      </div>
      {menuItems.map((item, i) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          tabIndex={focused === i ? 0 : -1}
          onClick={item.action}
          onMouseEnter={() => setFocused(i)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left ${
            focused === i
              ? 'bg-gray-800 text-white'
              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  )
}

interface UseCardContextMenuReturn {
  contextMenuProps: { onContextMenu: (e: React.MouseEvent) => void }
  overflowButtonProps: { onClick: (e: React.MouseEvent) => void; 'aria-label': string }
  menuElement: React.ReactNode
}

export function useCardContextMenu(
  pair: string,
  price: number,
  actions: CardContextMenuAction,
): UseCardContextMenuReturn {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  const openAt = useCallback((x: number, y: number) => {
    setMenu({ x, y })
  }, [])

  const close = useCallback(() => setMenu(null), [])

  const contextMenuProps = {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault()
      openAt(e.clientX, e.clientY)
    },
  }

  const overflowButtonProps = {
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation()
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      openAt(rect.left, rect.bottom + 4)
    },
    'aria-label': `More actions for ${pair}`,
  }

  const menuElement = menu ? (
    <ContextMenuPopup
      x={menu.x}
      y={menu.y}
      pair={pair}
      price={price}
      onClose={close}
      actions={actions}
    />
  ) : null

  return { contextMenuProps, overflowButtonProps, menuElement }
}
