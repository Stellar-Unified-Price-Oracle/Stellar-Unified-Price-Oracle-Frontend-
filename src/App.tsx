import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Dashboard } from './pages/Dashboard'
import { NotFound } from './pages/NotFound'
import { useWebVitals } from './hooks/useWebVitals'
import { PreferencesProvider } from './preferences/PreferencesContext'
import { ToastProvider } from './context/ToastContext'
import { ToastContainer } from './components/ToastContainer'
import { OnboardingProvider, OnboardingTourOverlay } from './components/OnboardingTour'

const PriceDetail = lazy(() =>
  import('./pages/PriceDetail').then((m) => ({ default: m.PriceDetail })),
)

const SourceHealth = lazy(() =>
  import('./pages/SourceHealth').then((m) => ({ default: m.SourceHealth })),
)

function PriceDetailLoader() {
  return (
    <div className="flex items-center justify-center py-32" role="status" aria-label="Loading page">
      <div className="animate-spin w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full" />
    </div>
  )
}

const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '')

function AppContent() {
  const location = useLocation()
  return (
    <ErrorBoundary key={location.key}>
      <PreferencesProvider>
        <Layout>
          <Suspense fallback={<PriceDetailLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/price/:pair" element={<PriceDetail />} />
              <Route path="/sources" element={<SourceHealth />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Layout>
      </PreferencesProvider>
    </ErrorBoundary>
  )
}

export default function App() {
  useWebVitals()

  return (
    <BrowserRouter basename={BASENAME}>
      <ToastProvider>
        <OnboardingProvider>
          <AppContent />
          <ToastContainer />
          <OnboardingTourOverlay />
        </OnboardingProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
