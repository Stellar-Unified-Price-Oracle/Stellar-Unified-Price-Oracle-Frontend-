/**
 * Service worker registration for the PWA (#361).
 *
 * Only runs in production builds — dev relies on Vite's own dev server (and,
 * when `VITE_USE_MOCK` is set, MSW's separate mock service worker), so a
 * caching service worker would only get in the way there.
 */

const SW_URL = `${import.meta.env.BASE_URL}sw.js`

/**
 * Registers the service worker and invokes `onUpdateAvailable` whenever a
 * new version has installed and is waiting to take over — the caller (see
 * `PwaUpdateBanner.tsx`) is responsible for prompting the user and calling
 * {@link applyServiceWorkerUpdate} once they agree to reload.
 */
export function registerServiceWorker(onUpdateAvailable: (registration: ServiceWorkerRegistration) => void): void {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(SW_URL, { scope: import.meta.env.BASE_URL })
      .then((registration) => {
        // A waiting worker already present on load (e.g. installed in a
        // previous session but not yet activated).
        if (registration.waiting) {
          onUpdateAvailable(registration)
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              onUpdateAvailable(registration)
            }
          })
        })
      })
      .catch(() => {
        /* registration failing should never break the app */
      })
  })
}

/** Tells the waiting service worker to activate, then reloads once it does. */
export function applyServiceWorkerUpdate(registration: ServiceWorkerRegistration): void {
  const waiting = registration.waiting
  if (!waiting) return

  navigator.serviceWorker.addEventListener(
    'controllerchange',
    () => {
      window.location.reload()
    },
    { once: true },
  )
  waiting.postMessage({ type: 'SKIP_WAITING' })
}
