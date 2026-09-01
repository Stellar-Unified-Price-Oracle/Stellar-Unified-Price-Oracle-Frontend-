import { Suspense, useState, type ReactNode, type ReactElement } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAlerts } from '../hooks/useAlerts'
import {
  LazyAlertPanel,
  LazySettingsPanel,
  preloadAlertPanel,
  preloadApiDocs,
  preloadDashboard,
  preloadLanding,
  preloadSettingsPanel,
} from '../utils/chunks'
import { QueuedRequestsBadge } from './QueuedRequestsBadge'
import { SkipNavLink } from './SkipNavLink'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? 'bg-gray-100 dark:bg-gray-800 text-cyan-600 dark:text-cyan-400'
      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/50'
  }`

/** Mobile bottom nav tab */
function BottomTab({
  to,
  label,
  icon,
  exact = false,
  badge,
  preload,
}: {
  to: string
  label: string
  icon: React.ReactNode
  exact?: boolean
  badge?: number
  preload?: () => unknown
}) {
  const location = useLocation()
  const isActive = exact ? location.pathname === to : location.pathname.startsWith(to)

  return (
    <NavLink
      to={to}
      end={exact}
      onMouseEnter={preload}
      onFocus={preload}
      className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 relative transition-colors ${
        isActive
          ? 'text-cyan-500'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
      }`}
      aria-current={isActive ? 'page' : undefined}
    >
      <span className="relative">
        {icon}
        {badge != null && badge > 0 && (
          // Use -top-1 on both axes and rtl-badge-flip handles the inline-end flip
          <span className="absolute -top-1 -right-1 rtl-badge-flip w-2.5 h-2.5 bg-cyan-500 rounded-full border border-white dark:border-gray-950 animate-pulse" />
        )}
      </span>
      <span className="text-[10px] font-medium leading-none">{label}</span>
      {isActive && (
        // left-1/2 + -translate-x-1/2 is symmetric — fine in both directions
        <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-cyan-500 rounded-b-full" />
      )}
    </NavLink>
  )
}

export function Layout({ children }: { children: ReactNode }): ReactElement {
  const { activeCount, togglePanel, isPanelOpen } = useAlerts()
  const { t } = useTranslation()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const NAV_ITEMS = [
    { path: '/', label: t('nav.home'), preload: preloadLanding },
    { path: '/dashboard', label: t('nav.dashboard'), preload: preloadDashboard },
    { path: '/api-docs', label: t('nav.apiDocs'), preload: preloadApiDocs },
    { path: '/webhooks', label: 'Webhooks' },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-950 transition-colors duration-200">
      {/*
       * Skip-to-content: use `focus:start-2` (inline-start logical) instead of
       * `focus:left-2` so the link appears at the visual start in both LTR and RTL.
       * Tailwind v4 supports `start-*` and `end-*` logical utilities.
       */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:start-2 focus:px-4 focus:py-2 focus:bg-cyan-600 focus:text-white focus:rounded-lg focus:outline-none"
      >
        Skip to main content
      </a>

      {/* ── Top navigation bar ─────────────────────────────────────── */}
      <nav
        aria-label="Main navigation"
        className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50 h-16"
      >
        <div className="px-4 sm:px-6 h-full flex items-center justify-between">
          {/* Brand + desktop nav links */}
          <div className="flex items-center gap-3">
            <NavLink to="/" end className="flex items-center gap-3 min-h-[44px]">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-xs font-bold text-white">
                O
              </div>
              <span className="font-semibold text-lg hidden sm:block text-gray-900 dark:text-white">
                {t('nav.appName')}
              </span>
            </NavLink>

            {/* Desktop nav links (hidden on mobile — bottom bar handles it) */}
            <div className="hidden sm:flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end
                  onMouseEnter={item.preload}
                  onFocus={item.preload}
                  className={navClass}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>

          {/* Right actions — in RTL these will naturally appear on the left */}
          <div className="flex items-center gap-2">
            {/* Client-side outbound back-pressure (#330). Renders nothing unless
                requests are queued or the server asked us to pause. */}
            <QueuedRequestsBadge />
            <WalletButton />
            <button
              onClick={() => setSettingsOpen(true)}
              onMouseEnter={preloadSettingsPanel}
              onFocus={preloadSettingsPanel}
              className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label={t('settings.title')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={togglePanel}
              onMouseEnter={preloadAlertPanel}
              onFocus={preloadAlertPanel}
              className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label={t('nav.toggleAlerts')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {activeCount > 0 && (
                /*
                 * Badge dot: use `top-1.5 end-1.5` (logical inline-end) instead of
                 * `top-1.5 right-1.5` so it appears at the visual trailing corner in
                 * both LTR and RTL without extra CSS overrides.
                 */
                <span className="absolute top-1.5 end-1.5 w-2.5 h-2.5 bg-cyan-500 rounded-full animate-pulse border border-white dark:border-gray-900" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Page content ───────────────────────────────────────────── */}
      <div className="flex flex-1">
        <main
          id="main-content"
          className="flex-1 px-6 py-6 overflow-auto pb-20 sm:pb-6"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>

      {/* ── Footer (desktop only) ──────────────────────────────────── */}
      <footer className="hidden sm:block border-t border-gray-200 dark:border-gray-800 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
        {t('footer.text')}
        <span aria-hidden="true"> · </span>
        <NavLink to="/security" className="underline underline-offset-2 hover:text-cyan-500 dark:hover:text-cyan-400">
          {t('footer.securityLink')}
        </NavLink>
      </footer>

      {/* ── Mobile bottom navigation bar ──────────────────────────── */}
      {/*
       * `inset-x-0` = left:0 right:0, which is already correct for both
       * directions (the bar spans the full width regardless of text direction).
       */}
      <nav
        aria-label="Mobile navigation"
        className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 flex items-stretch safe-area-inset-bottom"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <BottomTab
          to="/"
          exact
          preload={preloadLanding}
          label={t('nav.dashboard')}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          }
        />

        <BottomTab
          to="/api-docs"
          preload={preloadApiDocs}
          label={t('nav.apiDocs')}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />

        {/* Alerts tab */}
        <button
          type="button"
          onClick={togglePanel}
          onMouseEnter={preloadAlertPanel}
          onFocus={preloadAlertPanel}
          aria-label={t('nav.toggleAlerts')}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 relative text-gray-500 dark:text-gray-400 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors"
        >
          <span className="relative">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {activeCount > 0 && (
              <span className="absolute -top-1 -end-1 w-2.5 h-2.5 bg-cyan-500 rounded-full border border-white dark:border-gray-950 animate-pulse" />
            )}
          </span>
          <span className="text-[10px] font-medium leading-none">{t('dashboard.alerts.title')}</span>
        </button>
      </nav>

      {settingsOpen && (
        <Suspense
          fallback={
            <div
              className="fixed inset-0 z-50 bg-black/50"
              role="status"
              aria-label={t('settings.title')}
            />
          }
        >
          <LazySettingsPanel onClose={() => setSettingsOpen(false)} />
        </Suspense>
      )}
      {isPanelOpen && (
        <Suspense fallback={null}>
          <LazyAlertPanel />
        </Suspense>
      )}
      <div id="price-announcer" role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
    </div>
  )
}
