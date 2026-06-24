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

const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '')

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
        <AppContent />
        <ToastContainer />
      </ToastProvider>
    </BrowserRouter>
  )
}
