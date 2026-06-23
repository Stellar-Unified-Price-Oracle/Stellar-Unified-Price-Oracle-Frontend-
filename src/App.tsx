import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Dashboard } from './pages/Dashboard'
import { NotFound } from './pages/NotFound'

const PriceDetail = lazy(() =>
  import('./pages/PriceDetail').then((m) => ({ default: m.PriceDetail })),
)

function PriceDetailLoader() {
  return (
    <div className="flex items-center justify-center py-32" role="status" aria-label="Loading page">
      <div className="animate-spin w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full" />
    </div>
  )
}

const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '')

export default function App() {
  return (
    <BrowserRouter basename={BASENAME}>
      <ErrorBoundary>
        <Layout>
          <Suspense fallback={<PriceDetailLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/price/:pair" element={<PriceDetail />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Layout>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
