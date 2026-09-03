/**
 * @file hmr.ts
 * 
 * Hot Module Replacement utilities for preserving component state and improving HMR reliability.
 * 
 * React Fast Refresh is good but has edge cases where it loses state:
 * - Components that re-render on mount (e.g., fetching data)
 * - Components with complex state machines
 * - Hook dependencies that change unpredictably
 * 
 * This module provides utilities to preserve state across HMR updates.
 */

/**
 * Persists component state to sessionStorage across HMR updates.
 * 
 * When a component unmounts during HMR, save its state. When it remounts,
 * restore it. This prevents losing state during fast saves.
 * 
 * @example
 * ```tsx
 * const [count, setCount] = useHmrState('counter', 0)
 * // State persists across saves
 * ```
 */
export function useHmrState<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = React.useState<T>(() => {
    if (!import.meta.hot) return initialValue
    try {
      const saved = sessionStorage.getItem(`hmr-${key}`)
      return saved ? JSON.parse(saved) : initialValue
    } catch {
      return initialValue
    }
  })

  React.useEffect(() => {
    if (!import.meta.hot) return
    try {
      sessionStorage.setItem(`hmr-${key}`, JSON.stringify(state))
    } catch {
      // Ignore storage errors (quota exceeded, private browsing, etc.)
    }
  }, [state, key])

  return [state, setState]
}

/**
 * Accepts HMR updates but prevents full page reload for certain components.
 * 
 * By default, if HMR can't update a component in-place, Vite does a full reload.
 * This hook tells HMR "if I change, refresh me locally but keep the rest of the app alive".
 * 
 * Useful for hooks and context providers that might lose their subscriptions.
 * 
 * @example
 * ```tsx
 * export const MyProvider = ({ children }) => {
 *   useHmrAccept()
 *   return <Context.Provider>{children}</Context.Provider>
 * }
 * ```
 */
export function useHmrAccept(
  onUpdate?: () => void,
): void {
  React.useEffect(() => {
    if (!import.meta.hot) return

    import.meta.hot.accept(() => {
      // Component updated; run cleanup if provided
      onUpdate?.()
      // Re-render this component without full page reload
    })

    return () => {
      // Cleanup on unmount
    }
  }, [onUpdate])
}

/**
 * Registers a full-page reload boundary.
 * 
 * Some state changes require the entire app to reload (e.g., context structure changes).
 * Wrap the root component in this to explicitly declare "I need a full reload if my HMR fails".
 * 
 * @example
 * ```tsx
 * if (import.meta.hot) {
 *   import.meta.hot.dispose(() => {
 *     useHmrFullReload('App structure changed')
 *   })
 * }
 * ```
 */
export function useHmrFullReload(
  reason: string,
): void {
  React.useEffect(() => {
    if (!import.meta.hot) return

    import.meta.hot.dispose(() => {
      console.log(`[HMR] Full reload: ${reason}`)
      window.location.reload()
    })
  }, [reason])
}

/**
 * Development-only hook to detect HMR updates for debugging.
 * 
 * Logs when a component receives an HMR update, useful for identifying
 * which components are triggering reloads.
 * 
 * @example
 * ```tsx
 * useHmrDebug('MyComponent')  // Logs "[HMR] Updated: MyComponent"
 * ```
 */
export function useHmrDebug(
  componentName: string,
): void {
  React.useEffect(() => {
    if (!import.meta.hot || !import.meta.env.DEV) return

    const onUpdate = () => {
      console.log(`[HMR] Updated: ${componentName}`)
    }

    import.meta.hot.on('vite:beforeUpdate', onUpdate)
    return () => {
      import.meta.hot?.off('vite:beforeUpdate', onUpdate)
    }
  }, [componentName])
}

/**
 * Clears HMR state from sessionStorage.
 * 
 * Useful when you want to reset to a clean state (e.g., after clicking "Clear All").
 */
export function clearHmrState(key?: string): void {
  if (key) {
    sessionStorage.removeItem(`hmr-${key}`)
  } else {
    // Clear all HMR state
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i)
      if (k?.startsWith('hmr-')) {
        sessionStorage.removeItem(k)
      }
    }
  }
}

/**
 * Development-only: Log when HMR fails and forces a full page reload.
 * 
 * This helps debug cases where HMR can't update the component in-place.
 */
if (import.meta.env.DEV && import.meta.hot) {
  import.meta.hot.on('vite:error', (payload) => {
    console.warn('[HMR] Error:', payload)
  })

  import.meta.hot.on('full-reload', (payload) => {
    console.log('[HMR] Full reload triggered:', payload)
  })
}

// Type declaration for React import
import React from 'react'
