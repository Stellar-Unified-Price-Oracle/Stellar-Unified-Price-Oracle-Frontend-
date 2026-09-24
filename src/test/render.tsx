import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement, ReactNode } from 'react'
import { ToastProvider } from '../context/ToastContext'
import { PreferencesProvider } from '../preferences/PreferencesContext'
import { AlertsProvider } from '../hooks/useAlerts'

export interface RenderWithProvidersOptions {
  /** Initial route for MemoryRouter. Defaults to '/'. */
  route?: string | string[]
  /**
   * Wrap children in AlertsProvider. Only enable when the test supplies a
   * usable PriceContext (e.g. a module-level mock of usePriceContext),
   * because AlertsProvider reads live prices from it.
   */
  withAlerts?: boolean
  /**
   * Wrap children with additional providers. Applied inside the standard
   * provider stack, directly around the rendered element.
   */
  wrap?: (children: ReactNode) => ReactNode
}

/**
 * Renders `ui` inside the app's standard provider stack:
 * MemoryRouter → ToastProvider → PreferencesProvider (→ AlertsProvider).
 *
 * Many components call `usePreferences` (which throws outside its provider),
 * so unit tests that render them directly need this wrapper.
 */
export function renderWithProviders(ui: ReactElement, options: RenderWithProvidersOptions = {}) {
  const { route = '/', withAlerts = false, wrap } = options
  const initialEntries = Array.isArray(route) ? route : [route]

  function Wrapper({ children }: { children: ReactNode }) {
    let tree: ReactNode = children
    if (wrap) tree = wrap(tree)
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <ToastProvider>
          <PreferencesProvider>{withAlerts ? <AlertsProvider>{tree}</AlertsProvider> : tree}</PreferencesProvider>
        </ToastProvider>
      </MemoryRouter>
    )
  }

  return render(ui, { wrapper: Wrapper })
}
