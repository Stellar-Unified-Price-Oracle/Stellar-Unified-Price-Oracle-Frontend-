import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PriceProvider } from './context/PriceContext'
import App from './App'
import './index.css'

async function bootstrap() {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    const { worker } = await import('./mocks/browser')
    await worker.start({ onUnhandledRequest: 'bypass' })
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <PriceProvider>
          <App />
        </PriceProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}

bootstrap()
