import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Dashboard } from './pages/Dashboard'
import { NotFound } from './pages/NotFound'
import { useWebVitals } from './hooks/useWebVitals'
import { useAccessibility } from './hooks/useAccessibility'
import { PreferencesProvider } from './preferences/PreferencesContext'
import { FeatureFlagsProvider } from './features/FeatureFlagsContext'
import { ToastProvider } from './context/ToastContext'
import { ToastContainer } from './components/ToastContainer'

const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '')

function AppContent() {
  const location = useLocation()
  useAccessibility()
  return (
    <ErrorBoundary key={location.key}>
      <FeatureFlagsProvider>
        <PreferencesProvider>
          <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </PreferencesProvider>
    </FeatureFlagsProvider>
    </ErrorBoundary>
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
