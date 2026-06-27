import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'

const SIDEBAR_STORAGE_KEY = 'stellar-oracle-sidebar-collapsed'

function getSidebarInitialState(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(getSidebarInitialState)

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed))
    } catch {
      // localStorage unavailable
    }
  }, [collapsed])

  return { collapsed, toggle: () => setCollapsed((c) => !c) }
}

interface NavItem {
  path: string
  label: string
  section: string
  icon: React.ReactNode
}

function DashboardIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h6v6H3V7zm0 8h6v4H3v-4zm8-8h10v4H11V7zm0 6h10v6H11v-6z" />
    </svg>
  )
}

function PriceFeedsIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
  )
}

function HealthIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  )
}

function AlertsIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
    </svg>
  )
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { path: '/', label: 'Dashboard', section: 'overview', icon: <DashboardIcon /> },
      { path: '/feeds', label: 'Price Feeds', section: 'overview', icon: <PriceFeedsIcon /> },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { path: '/health', label: 'Health', section: 'monitoring', icon: <HealthIcon /> },
      { path: '/alerts', label: 'Alerts', section: 'monitoring', icon: <AlertsIcon /> },
    ],
  },
  {
    title: 'System',
    items: [
      { path: '/settings', label: 'Settings', section: 'system', icon: <SettingsIcon /> },
    ],
  },
]

interface SidebarProps {
  onSettingsOpen?: () => void
}

export function Sidebar({ onSettingsOpen }: SidebarProps) {
  const location = useLocation()
  const { collapsed, toggle } = useSidebarCollapsed()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <aside
      className={`hidden md:flex flex-col bg-gray-900 border-r border-gray-800 h-full sticky top-16 overflow-hidden transition-[width] duration-300 ease-in-out ${
        collapsed ? 'w-16' : 'w-56'
      }`}
      aria-label="Sidebar navigation"
    >
      {/* Collapse toggle */}
      <div className="flex items-center justify-end px-3 py-3 border-b border-gray-800">
        <button
          onClick={toggle}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          <CollapseIcon collapsed={collapsed} />
        </button>
      </div>

      {/* Nav sections */}
      <nav aria-label="Sidebar" className="flex-1 overflow-y-auto py-4 space-y-6">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="px-4 mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 select-none">
                {section.title}
              </p>
            )}
            <ul role="list" className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.path)
                // Settings opens a panel instead of navigating
                if (item.path === '/settings') {
                  return (
                    <li key={item.path}>
                      <button
                        type="button"
                        onClick={onSettingsOpen}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg mx-1 transition-colors ${
                          active
                            ? 'bg-gray-800 text-cyan-400'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                        }`}
                        aria-label={item.label}
                        title={collapsed ? item.label : undefined}
                      >
                        {item.icon}
                        {!collapsed && (
                          <span className="truncate transition-opacity duration-200">{item.label}</span>
                        )}
                        {active && !collapsed && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400" aria-hidden="true" />
                        )}
                      </button>
                    </li>
                  )
                }
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg mx-1 transition-colors ${
                        active
                          ? 'bg-gray-800 text-cyan-400'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                      }`}
                      aria-label={item.label}
                      aria-current={active ? 'page' : undefined}
                      title={collapsed ? item.label : undefined}
                    >
                      {item.icon}
                      {!collapsed && (
                        <span className="truncate transition-opacity duration-200">{item.label}</span>
                      )}
                      {active && !collapsed && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400" aria-hidden="true" />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}

/** Mobile slide-in nav drawer */
export function MobileSidebar({
  open,
  onClose,
  onSettingsOpen,
}: {
  open: boolean
  onClose: () => void
  onSettingsOpen?: () => void
}) {
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 md:hidden transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        role="presentation"
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 md:hidden transform transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-xs font-bold text-white">
              O
            </div>
            <span className="font-semibold text-white">Stellar Oracle</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav aria-label="Mobile navigation" className="py-4 space-y-5 overflow-y-auto h-[calc(100vh-65px)]">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="px-4 mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {section.title}
              </p>
              <ul role="list" className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.path)
                  if (item.path === '/settings') {
                    return (
                      <li key={item.path}>
                        <button
                          type="button"
                          onClick={() => { onClose(); onSettingsOpen?.() }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                            active ? 'text-cyan-400 bg-gray-800' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                          }`}
                        >
                          {item.icon}
                          {item.label}
                        </button>
                      </li>
                    )
                  }
                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        onClick={onClose}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                          active ? 'text-cyan-400 bg-gray-800' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                        }`}
                        aria-current={active ? 'page' : undefined}
                      >
                        {item.icon}
                        {item.label}
                        {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400" aria-hidden="true" />}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </>
  )
}
