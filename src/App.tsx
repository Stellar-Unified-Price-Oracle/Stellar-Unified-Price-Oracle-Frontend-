import { lazy, type ReactElement } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { RouteSuspense } from './components/Skeletons/RouteSuspense'
import { DashboardSkeleton } from './components/Skeletons/DashboardSkeleton'
import { PriceDetailSkeleton } from './components/PriceDetailSkeleton'
import { ApiDocsSkeleton } from './components/Skeletons/ApiDocsSkeleton'
import { NotFoundSkeleton } from './components/Skeletons/NotFoundSkeleton'
import { AlertsProvider } from './hooks/useAlerts'
import { ToastProvider } from './context/ToastContext'
import { PreferencesProvider } from './preferences/PreferencesContext'
import { useWebVitals } from './hooks/useWebVitals'
import { useAccessibility } from './hooks/useAccessibility'
import { initAnalytics, trackPageview } from './hooks/useAnalytics'

const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const PriceDetail = lazy(() => import('./pages/PriceDetail').then((m) => ({ default: m.PriceDetail })))
const ApiDocs = lazy(() => import('./pages/ApiDocs').then((m) => ({ default: m.ApiDocs })))
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })))

const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '')

export function AppContent(): ReactElement {
  const location = useLocation()
  useAccessibility()
  trackPageview(location.pathname)
  return (
    <ErrorBoundary key={location.key}>
      <AlertsProvider>
        <Layout>
          <Routes>
            <Route
              path="/"
              element={
                <RouteSuspense fallback={<DashboardSkeleton />}>
                  <Dashboard />
                </RouteSuspense>
              }
            />
            <Route
              path="/prices/:pair"
              element={
                <RouteSuspense fallback={<PriceDetailSkeleton />}>
                  <PriceDetail />
                </RouteSuspense>
              }
            />
            <Route
              path="/price/:pair"
              element={
                <RouteSuspense fallback={<PriceDetailSkeleton />}>
                  <PriceDetail />
                </RouteSuspense>
              }
            />
            <Route
              path="/api-docs"
              element={
                <RouteSuspense fallback={<ApiDocsSkeleton />}>
                  <ApiDocs />
                </RouteSuspense>
              }
            />
            <Route
              path="*"
              element={
                <RouteSuspense fallback={<NotFoundSkeleton />}>
                  <NotFound />
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
  initAnalytics()

  return (
    <BrowserRouter basename={BASENAME}>
      <PreferencesProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </PreferencesProvider>
    </BrowserRouter>
  )
}
