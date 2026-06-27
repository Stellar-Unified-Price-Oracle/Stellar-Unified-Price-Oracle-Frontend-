import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PriceProvider } from './context/PriceContext'
import App from './App'
import './index.css'
import { installConsoleAggregator } from './utils/consoleAggregator'

installConsoleAggregator()

async function prepare() {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    const { worker } = await import('./mocks/browser')
    return worker.start({ onUnhandledRequest: 'bypass' })
  }
}

prepare().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <PriceProvider>
        <App />
      </PriceProvider>
    </StrictMode>,
  )
})
