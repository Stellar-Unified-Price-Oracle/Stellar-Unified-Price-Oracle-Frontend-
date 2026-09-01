import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { getMissingRequiredEnvVars } from './config/validateEnv'
import { installConsoleAggregator } from './utils/consoleAggregator'
import { installCspReporting } from './utils/cspReporting'
import { checkStorageSizeWarning } from './utils/storage'

installConsoleAggregator()
installCspReporting()
// Warn in dev if localStorage usage is approaching the quota limit
checkStorageSizeWarning()

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

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found')

const missingEnvVars = getMissingRequiredEnvVars(import.meta.env)

if (missingEnvVars.length > 0) {
  createRoot(root).render(
    <StrictMode>
      <main role="alert" className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <section className="w-full max-w-xl rounded-lg border border-red-500/50 bg-slate-900 p-6 shadow-xl">
          <h1 className="text-2xl font-semibold text-red-400">Configuration error</h1>
          <p className="mt-3">The application cannot start because these required environment variables are missing:</p>
          <ul className="mt-3 list-inside list-disc font-mono text-sm text-red-300">
            {missingEnvVars.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-slate-300">
            Set them in your environment or copy <code>.env.example</code> to <code>.env</code>, then restart the
            application.
          </p>
        </section>
      </main>
    </StrictMode>,
  )
} else {
  prepare().then(() => {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
}
