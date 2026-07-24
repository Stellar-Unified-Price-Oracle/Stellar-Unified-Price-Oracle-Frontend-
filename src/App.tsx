import { lazy, Suspense, type ReactElement } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PageSkeleton } from './components/PageSkeleton'
import { AlertsProvider } from './hooks/useAlerts'

// Route-level code splitting: each page becomes its own chunk.
// All four pages use named exports, so we re-export them as `default`
// inside the .then() callback so React.lazy can consume them.
const Dashboard = lazy(() =>
  import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })),
)
const PriceDetail = lazy(() =>
  import('./pages/PriceDetail').then((m) => ({ default: m.PriceDetail })),
)
const ApiDocs = lazy(() =>
  import('./pages/ApiDocs').then((m) => ({ default: m.ApiDocs })),
)
const NotFound = lazy(() =>
  import('./pages/NotFound').then((m) => ({ default: m.NotFound })),
)

const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '')

function AppContent(): ReactElement {
  const location = useLocation()
  return (
    <ErrorBoundary key={location.key}>
      <AlertsProvider>
        <Layout>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/prices/:pair" element={<PriceDetail />} />
              <Route path="/api-docs" element={<ApiDocs />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Layout>
      </AlertsProvider>
    </ErrorBoundary>
  )
}

export default function App(): ReactElement {
  return (
    <BrowserRouter basename={BASENAME}>
      <AppContent />
    </BrowserRouter>
  )
}
