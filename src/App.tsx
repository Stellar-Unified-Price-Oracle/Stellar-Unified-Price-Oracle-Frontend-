import { Suspense, type ReactElement } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Dashboard } from './pages/Dashboard'
import { PriceDetail } from './pages/PriceDetail'
import { ApiDocs } from './pages/ApiDocs'
import { NotFound } from './pages/NotFound'
import { AlertsProvider } from './hooks/useAlerts'
import { PriceProvider } from './context/PriceContext'
import { ToastProvider } from './context/ToastContext'
import { PreferencesProvider } from './preferences/PreferencesContext'
import { useWebVitals } from './hooks/useWebVitals'
import { useAccessibility } from './hooks/useAccessibility'
import { initAnalytics, trackPageview } from './hooks/useAnalytics'

const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '')

function AppContent(): ReactElement {
  const location = useLocation()
  useAccessibility()
  trackPageview(location.pathname)
  return (
    <ErrorBoundary key={location.key}>
      <PriceProvider>
        <AlertsProvider>
          <Layout>
            <Suspense fallback={null}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/prices/:pair" element={<PriceDetail />} />
                <Route path="/api-docs" element={<ApiDocs />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </Layout>
        </AlertsProvider>
      </PriceProvider>
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
