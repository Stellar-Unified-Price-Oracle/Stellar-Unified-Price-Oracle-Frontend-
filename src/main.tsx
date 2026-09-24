import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PriceProvider } from './context/PriceContext'
import { afterFirstPaint, markBoot, markStage } from './perf/startup'
import App from './App'
import './index.css'

// Stage 0: boot clock starts before any React work so every stage is measured
// against the real entry-point cost, not against first render.
markBoot()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <PriceProvider>
        <App />
      </PriceProvider>
    </ErrorBoundary>
  </StrictMode>,
)

// Stage 1 (shell): nav + skeletons are on screen after the first paint.
afterFirstPaint(() => markStage('shell'))

