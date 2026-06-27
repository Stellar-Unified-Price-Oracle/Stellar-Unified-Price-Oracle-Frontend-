type Provider = 'plausible' | 'umami' | undefined

const provider = (import.meta.env.VITE_ANALYTICS_PROVIDER as Provider) || undefined
const id = (import.meta.env.VITE_ANALYTICS_ID as string) || undefined

export function shouldCollect() {
  try {
    if (typeof navigator !== 'undefined' && (navigator as Navigator & { doNotTrack?: string }).doNotTrack === '1') return false
  } catch { /* ignore */ }
  if (typeof window === 'undefined') return false
  if (!provider || !id) return false
  if (localStorage.getItem('analyticsOptOut') === '1') return false
  return true
}

export function initAnalytics() {
  if (!shouldCollect()) return

  if (provider === 'plausible' && id) {
    const s = document.createElement('script')
    s.setAttribute('defer', 'true')
    s.setAttribute('data-domain', String(id))
    s.src = `https://plausible.io/js/plausible.js`
    document.head.appendChild(s)
  }

  if (provider === 'umami' && id) {
    const s = document.createElement('script')
    s.setAttribute('defer', 'true')
    s.setAttribute('data-website-id', String(id))
    s.src = `https://umami.example.com/umami.js`
    document.head.appendChild(s)
  }
}

type WindowWithAnalytics = Window & {
  plausible?: (event: string, opts?: { props?: Record<string, unknown> }) => void
  umami?: { trackEvent?: (name: string, props?: Record<string, unknown>) => void; trackView?: (path?: string) => void }
}

export function trackEvent(name: string, props?: Record<string, unknown>) {
  if (!shouldCollect()) return
  try {
    const w = window as WindowWithAnalytics
    if (w.plausible) {
      w.plausible(name, { props: props || {} })
    } else if (w.umami) {
      w.umami.trackEvent?.(name, props)
    }
  } catch { /* swallow */ }
}

export function trackPageview(path?: string) {
  if (!shouldCollect()) return
  try {
    const w = window as WindowWithAnalytics
    if (w.plausible) {
      w.plausible('pageview')
    } else if (w.umami) {
      w.umami.trackView?.(path || location.pathname)
    }
  } catch { /* swallow */ }
}

export default function useAnalytics() {
  // no-op hook, helpers exported
}
