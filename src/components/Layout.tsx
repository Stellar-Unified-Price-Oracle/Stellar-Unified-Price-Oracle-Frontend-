import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAlerts } from '../hooks/useAlerts'
import { AlertPanel } from './AlertPanel'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard' },
]

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const { activeCount, togglePanel } = useAlerts()

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950 transition-colors duration-200">
      <nav aria-label="Main navigation" className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50 h-16">
        <div className="px-4 sm:px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(true)}
              className="md:hidden p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <Link to="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-xs font-bold text-white">
                O
              </div>
              <span className="font-semibold text-lg hidden sm:block text-gray-900 dark:text-white">
                Stellar Oracle
              </span>
            </Link>

            <div className="hidden sm:flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'bg-gray-100 dark:bg-gray-800 text-cyan-600 dark:text-cyan-400'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={togglePanel}
              className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle price alerts"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {activeCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-cyan-500 rounded-full animate-pulse border border-white dark:border-gray-900" />
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="sm:hidden pb-3">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'bg-gray-100 dark:bg-gray-800 text-cyan-600 dark:text-cyan-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      <div className="flex flex-1">
        <main className="flex-1 px-6 py-6 overflow-auto">
          {children}
        </main>
      </div>

      <footer className="border-t border-gray-200 dark:border-gray-800 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
        Stellar Unified Price Oracle &middot; Developer Portal &amp; Analytics Dashboard
      </footer>
      <AlertPanel />
    </div>
  )
}
