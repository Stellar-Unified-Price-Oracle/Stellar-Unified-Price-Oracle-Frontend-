/**
 * Captures Content-Security-Policy violations directly in the browser via the
 * `securitypolicyviolation` event, which fires for both enforced and
 * Report-Only policies regardless of whether a server-side report endpoint is
 * configured. This is the primary source of truth for the in-app
 * `CspViolationsPanel` dashboard.
 *
 * Violations are also mirrored through `console.warn` so they show up in the
 * existing console aggregator (src/utils/consoleAggregator.ts) for anyone
 * already watching that panel.
 */

export interface CspViolation {
  directive: string
  blockedUri: string
  documentUri: string
  disposition: 'enforce' | 'report'
  sourceFile?: string
  lineNumber?: number
  timestamp: number
}

const MAX_ENTRIES = 200
const violations: CspViolation[] = []
const directiveCounts = new Map<string, number>()
type Listener = (violations: CspViolation[]) => void
const listeners = new Set<Listener>()

let installed = false

function notify() {
  listeners.forEach((l) => l([...violations]))
}

function record(v: CspViolation) {
  violations.unshift(v)
  if (violations.length > MAX_ENTRIES) violations.length = MAX_ENTRIES
  directiveCounts.set(v.directive, (directiveCounts.get(v.directive) ?? 0) + 1)

  console.warn(
    `[CSP ${v.disposition === 'report' ? 'report-only' : 'blocked'}] ${v.directive} — blocked ${v.blockedUri}`,
  )
  notify()
}

/** Best-effort POST to a same-origin collector; never throws, never blocks. */
function reportToServer(event: SecurityPolicyViolationEvent) {
  try {
    const endpoint = '/api/csp-report'
    const body = JSON.stringify({
      'csp-report': {
        'document-uri': event.documentURI,
        'violated-directive': event.violatedDirective,
        'effective-directive': event.effectiveDirective,
        'blocked-uri': event.blockedURI,
        disposition: event.disposition,
        'source-file': event.sourceFile,
        'line-number': event.lineNumber,
      },
    })
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/csp-report' }))
    } else {
      void fetch(endpoint, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/csp-report' } })
    }
  } catch {
    // Reporting must never affect the app; swallow any failure.
  }
}

export function installCspReporting(): void {
  if (installed || typeof document === 'undefined') return
  installed = true

  document.addEventListener('securitypolicyviolation', (event) => {
    record({
      directive: event.violatedDirective || event.effectiveDirective || 'unknown',
      blockedUri: event.blockedURI || '(inline)',
      documentUri: event.documentURI,
      disposition: (event.disposition as 'enforce' | 'report') || 'enforce',
      sourceFile: event.sourceFile || undefined,
      lineNumber: event.lineNumber || undefined,
      timestamp: Date.now(),
    })
    reportToServer(event)
  })
}

export function getCspViolations(): CspViolation[] {
  return [...violations]
}

/** Directive → violation count, sorted descending, for the "top violating directives" view. */
export function getTopDirectives(): Array<{ directive: string; count: number }> {
  return Array.from(directiveCounts.entries())
    .map(([directive, count]) => ({ directive, count }))
    .sort((a, b) => b.count - a.count)
}

export function clearCspViolations(): void {
  violations.length = 0
  directiveCounts.clear()
  notify()
}

export function subscribeCspViolations(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function exportCspViolations(): string {
  return JSON.stringify(violations, null, 2)
}
