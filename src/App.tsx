import { useEffect, useRef, type ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { RouteSuspense } from './components/Skeletons/RouteSuspense'
import { DashboardSkeleton } from './components/Skeletons/DashboardSkeleton'
import { PriceDetailSkeleton } from './components/PriceDetailSkeleton'
import { ApiDocsSkeleton } from './components/Skeletons/ApiDocsSkeleton'
import { NotFoundSkeleton } from './components/Skeletons/NotFoundSkeleton'
import { PriceProvider } from './context/PriceContext'
import { KeyboardShortcutsProvider } from './context/KeyboardShortcutsContext'
import { AlertsProvider } from './hooks/useAlerts'
import { ToastProvider } from './context/ToastContext'
import { PreferencesProvider } from './preferences/PreferencesContext'
import { ErrorReporterProvider } from './context/ErrorReporterContext'
import { WalletProvider } from './wallet/WalletContext'
import { AuthProvider } from './auth/AuthContext'
import { AuthCallback } from './pages/AuthCallback'
import { useWebVitals } from './hooks/useWebVitals'
import { useAccessibility } from './hooks/useAccessibility'
import { initAnalytics } from './hooks/useAnalytics'
import { useAnalyticsRouting } from './utils/analyticsRouting'
import { usePerformanceMonitor } from './hooks/usePerformanceMonitor'
import { useInitApiVersion } from './hooks/useApiVersion'
import { PerformanceOverlay } from './components/PerformanceOverlay'
import { ApiVersionBanner } from './components/ApiVersionBanner'
import { InstallPrompt } from './components/InstallPrompt'
import { PwaUpdateBanner } from './components/PwaUpdateBanner'
import { Webhooks } from './pages/Webhooks'
import {
  LazyApiDocs,
  LazyDashboard,
  LazyLanding,
  LazyNotFound,
  LazyPriceDetail,
  LazySecurity,
  preloadDashboard,
  preloadPriceDetail,
} from './utils/chunks'
import { scheduleIdlePreload } from './utils/preloadCache'

const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '')

// React Query provider for PriceContext (and any other data hooks). Without it
// the Dashboard throws "No QueryClient set" (regression from #ab91b30, which
// moved to code splitting but dropped the provider).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: 3,
    },
  },
})

export function AppContent(): ReactElement {
  const location = useLocation()
  useAccessibility()
  useAnalyticsRouting()

  // Route-change focus management: move focus to the main content region so
  // keyboard/screen-reader users don't lose their place when navigating.
  // (#501 — focus must not silently drop to <body> between routes.)
  const isFirstRender = useRef(true)
  useEffect(() => {
    // Never steal focus on the initial paint — that would defeat the
    // skip-to-content link. Only manage focus on actual navigations.
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const main = document.getElementById('main-content')
    // Only move focus when focus actually fell back to <body> (e.g. the
    // clicked nav link unmounted) — never yank it from an interactive element.
    if (main && document.activeElement === document.body) {
      main.focus({ preventScroll: true })
    }
  }, [location.pathname])

  useEffect(() => {
    if (location.pathname === '/') {
      return scheduleIdlePreload(() => void preloadDashboard())
    }
    if (location.pathname === '/dashboard') {
      return scheduleIdlePreload(() => void preloadPriceDetail())
    }
    return undefined
  }, [location.pathname])

  return (
    <ErrorBoundary key={location.key}>
      <AlertsProvider>
        <ApiVersionBanner />
        <InstallPrompt />
        <PwaUpdateBanner />
        <Layout>
          <Routes>
            <Route
              path="/"
              element={
                <RouteSuspense fallback={<DashboardSkeleton />}>
                  <LazyLanding />
                </RouteSuspense>
              }
            />
            <Route
              path="/dashboard"
              element={
                <RouteSuspense fallback={<DashboardSkeleton />}>
                  <LazyDashboard />
                </RouteSuspense>
              }
            />
            <Route
              path="/prices/:pair"
              element={
                <RouteSuspense fallback={<PriceDetailSkeleton />}>
                  <LazyPriceDetail />
                </RouteSuspense>
              }
            />
            <Route
              path="/price/:pair"
              element={
                <RouteSuspense fallback={<PriceDetailSkeleton />}>
                  <LazyPriceDetail />
                </RouteSuspense>
              }
            />
            <Route
              path="/api-docs"
              element={
                <RouteSuspense fallback={<ApiDocsSkeleton />}>
                  <LazyApiDocs />
                </RouteSuspense>
              }
            />
            <Route path="/webhooks" element={<Webhooks />} />
            <Route
              path="/security"
              element={
                <RouteSuspense fallback={<NotFoundSkeleton />}>
                  <LazySecurity />
                </RouteSuspense>
              }
            />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route
              path="*"
              element={
                <RouteSuspense fallback={<NotFoundSkeleton />}>
                  <LazyNotFound />
                </RouteSuspense>
              }
            />
          </Routes>
        </Layout>
      </AlertsProvider>
    </ErrorBoundary>
  )
}

export default function App(): ReactElement {
  useWebVitals()
  usePerformanceMonitor()
  useInitApiVersion()
  initAnalytics()

  return (
    <BrowserRouter basename={BASENAME}>
      <QueryClientProvider client={queryClient}>
        <ErrorReporterProvider>
          <PreferencesProvider>
            <ToastProvider>
              <AuthProvider>
                <WalletProvider>
                  <PriceProvider>
                    <KeyboardShortcutsProvider>
                      <AppContent />
                      {import.meta.env.DEV && <PerformanceOverlay />}
                    </KeyboardShortcutsProvider>
                  </PriceProvider>
                </WalletProvider>
              </AuthProvider>
            </ToastProvider>
          </PreferencesProvider>
        </ErrorReporterProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}
