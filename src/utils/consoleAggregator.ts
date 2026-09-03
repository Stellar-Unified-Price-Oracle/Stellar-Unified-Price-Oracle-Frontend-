export interface AggregatedWarning {
  pattern: string
  count: number
  lastSeen: number
  level: 'warn' | 'error'
}

type Listener = (warnings: AggregatedWarning[]) => void

const MAX_ENTRIES = 200
const suppressedPatterns: RegExp[] = []
const warnings = new Map<string, AggregatedWarning>()
const listeners = new Set<Listener>()

let installed = false
const _origWarn = console.warn.bind(console)
const _origError = console.error.bind(console)

function normalise(args: unknown[]): string {
  return args
    .map((a) => (typeof a === 'string' ? a : String(a)))
    .join(' ')
    .slice(0, 200)
}

function notify() {
  const snapshot = Array.from(warnings.values()).sort((a, b) => b.lastSeen - a.lastSeen)
  listeners.forEach((l) => l(snapshot))
}

function record(level: 'warn' | 'error', args: unknown[]) {
  const pattern = normalise(args)
  if (suppressedPatterns.some((r) => r.test(pattern))) return
  const existing = warnings.get(pattern)
  if (existing) {
    existing.count++
    existing.lastSeen = Date.now()
  } else {
    if (warnings.size >= MAX_ENTRIES) {
      // Remove oldest
      const oldest = Array.from(warnings.entries()).sort((a, b) => a[1].lastSeen - b[1].lastSeen)[0]
      warnings.delete(oldest[0])
    }
    warnings.set(pattern, { pattern, count: 1, lastSeen: Date.now(), level })
  }
  notify()
}

export function installConsoleAggregator() {
  if (installed) return
  installed = true
  console.warn = (...args: unknown[]) => {
    record('warn', args)
    _origWarn(...args)
  }
  console.error = (...args: unknown[]) => {
    record('error', args)
    _origError(...args)
  }
}

export function suppressPattern(pattern: RegExp) {
  suppressedPatterns.push(pattern)
}

export function clearWarnings() {
  warnings.clear()
  notify()
}

export function getWarnings(): AggregatedWarning[] {
  return Array.from(warnings.values()).sort((a, b) => b.lastSeen - a.lastSeen)
}

export function subscribeWarnings(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function exportWarnings(): string {
  return JSON.stringify(getWarnings(), null, 2)
}
