import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Dashboard } from './pages/Dashboard'
import { PriceDetail } from './pages/PriceDetail'
import { NotFound } from './pages/NotFound'
import { useWebVitals } from './hooks/useWebVitals'
import { useAccessibility } from './hooks/useAccessibility'
import { AlertsProvider } from './hooks/useAlerts'
import { PreferencesProvider } from './preferences/PreferencesContext'
import { ToastProvider } from './context/ToastContext'
import { ToastContainer } from './components/ToastContainer'
import { AnalyticsProvider } from './context/AnalyticsContext'
import { AnalyticsConsentBanner } from './components/AnalyticsConsentBanner'
import { AnalyticsCollector } from './utils/analytics'
import { config } from './config'

const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '')

// Initialize analytics on module load
if (config.analyticsEndpoint) {
  AnalyticsCollector.init(config.analyticsEndpoint)
}

function AppContent() {
  const location = useLocation()
  return (
    <ErrorBoundary key={location.key}>
      <PreferencesProvider>
        <AlertsProvider>
          <AccessibilityAwareLayout />
        </AlertsProvider>
      </PreferencesProvider>
    </ErrorBoundary>
  )
}

function AccessibilityAwareLayout() {
  useAccessibility()
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/price/:pair" element={<PriceDetail />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  useWebVitals()

  return (
    <BrowserRouter basename={BASENAME}>
      <ToastProvider>
        <AnalyticsProvider endpoint={config.analyticsEndpoint}>
          <AppContent />
          <ToastContainer />
          <AnalyticsConsentBanner />
        </AnalyticsProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
