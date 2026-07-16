import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { installConsoleAggregator } from './utils/consoleAggregator'

installConsoleAggregator()

async function prepare(): Promise<void> {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    try {
      const { worker } = await import('./mocks/browser')
      await worker.start({ onUnhandledRequest: 'bypass' })
    } catch (err) {
      console.warn('MSW worker failed to start, continuing without mocks:', err)
    }
  }
}

prepare().then(() => {
  const root = document.getElementById('root')
  if (!root) throw new Error('Root element #root not found')
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
