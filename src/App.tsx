import { useEffect, type ReactElement } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { RouteSuspense } from './components/Skeletons/RouteSuspense'
import { DashboardSkeleton } from './components/Skeletons/DashboardSkeleton'
import { PriceDetailSkeleton } from './components/PriceDetailSkeleton'
import { ApiDocsSkeleton } from './components/Skeletons/ApiDocsSkeleton'
import { NotFoundSkeleton } from './components/Skeletons/NotFoundSkeleton'
import { PriceProvider } from './context/PriceContext'
import { AlertsProvider } from './hooks/useAlerts'
import { ToastProvider } from './context/ToastContext'
import { PreferencesProvider } from './preferences/PreferencesContext'
import { ErrorReporterProvider } from './context/ErrorReporterContext'
import { WalletProvider } from './wallet/WalletContext'
import { ApiKeysProvider } from './context/ApiKeysContext'
import { ApiKeysPage } from './pages/ApiKeysPage'
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
import {
  LazyApiDocs,
  LazyDashboard,
  LazyLanding,
  LazyNotFound,
  LazyPriceDetail,
  preloadDashboard,
  preloadPriceDetail,
} from './utils/chunks'
import { scheduleIdlePreload } from './utils/preloadCache'

const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '')

export function AppContent(): ReactElement {
  const location = useLocation()
  useAccessibility()
  useAnalyticsRouting()

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
            {/* #457 – Developer portal / API key management */}
            <Route path="/developer" element={<ApiKeysPage />} />
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
      <ErrorReporterProvider>
        <PreferencesProvider>
          <ToastProvider>
            <WalletProvider>
              <PriceProvider>
                <ApiKeysProvider>
                  <AppContent />
                  {import.meta.env.DEV && <PerformanceOverlay />}
                </ApiKeysProvider>
              </PriceProvider>
            </WalletProvider>
          </ToastProvider>
        </PreferencesProvider>
      </ErrorReporterProvider>
    </BrowserRouter>
  )
}
