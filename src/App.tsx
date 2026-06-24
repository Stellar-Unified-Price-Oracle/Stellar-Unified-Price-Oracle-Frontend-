import { Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Dashboard } from './pages/Dashboard'
import { NotFound } from './pages/NotFound'
import { AlertsProvider } from './hooks/useAlerts'

const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '')

function AppContent() {
  const location = useLocation()
  return (
    <ErrorBoundary key={location.key}>
      <AlertsProvider>
        <Layout>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Layout>
      </AlertsProvider>
    </ErrorBoundary>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={BASENAME}>
      <AppContent />
    </BrowserRouter>
  )
}
