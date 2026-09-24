/**
 * @file Alert digest payload + render (#489).
 *
 * A periodic (daily/weekly) summary of fired alerts and active conditions, for
 * users who don't watch real-time notifications. `buildAlertDigest` is a pure
 * windowing/aggregation pass over the existing alert history log and current
 * alert list (see `services/alertHistory.ts`, `types/index.ts`); `renderDigest*`
 * turns that payload into the "shareable render" delivered over the existing
 * email channel (`dispatchEmailChannel` in `useAlerts.tsx` posts to the same
 * `/api/notifications/email` endpoint used here).
 *
 * Kept side-effect free so the window math and HTML escaping are unit-testable
 * without a DOM or storage — `useAlertDigest` wires this to real data, scheduling,
 * and delivery.
 */
import type { Alert, AlertHistoryEntry } from '../types'

export type DigestFrequency = 'daily' | 'weekly'

const DIGEST_FREQUENCY_MS: Record<DigestFrequency, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
}

/** Next run timestamp for `frequency`, `from` (default now). Mirrors `useScheduledExports.computeNextRun`. */
export function computeNextDigestRun(frequency: DigestFrequency, from = Date.now()): number {
  return from + DIGEST_FREQUENCY_MS[frequency]
}

/** One fired-alert line in the digest. */
export interface DigestFiredEntry {
  alertId: string
  assetPair: string
  price: number
  triggeredAt: number
}

/** One still-active-condition line in the digest. */
export interface DigestActiveEntry {
  alertId: string
  assetPair: string
  conditionSummary: string
}

export interface AlertDigestPayload {
  frequency: DigestFrequency
  windowStart: number
  windowEnd: number
  fired: DigestFiredEntry[]
  active: DigestActiveEntry[]
}

/** Human-readable condition summary for the digest's "active alerts" section. */
export function summarizeCondition(alert: Alert): string {
  if (alert.percentageMode) {
    const dir = alert.percentageDirection ?? 'either'
    const arrow = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '↕'
    return `${arrow} ${alert.percentageThreshold ?? 0}% in ${alert.percentageWindow ?? '1hr'}`
  }
  if (alert.upperThreshold !== null && alert.lowerThreshold !== null) {
    return `between $${alert.lowerThreshold} and $${alert.upperThreshold}`
  }
  if (alert.upperThreshold !== null) return `above $${alert.upperThreshold}`
  if (alert.lowerThreshold !== null) return `below $${alert.lowerThreshold}`
  return 'no threshold'
}

/**
 * Builds the digest payload for the window `[now - frequency, now]`: every
 * history entry that fired in that window, and every currently-active alert
 * (regardless of when it last fired) — the "right subset" per #489's acceptance
 * criteria.
 */
export function buildAlertDigest(
  history: AlertHistoryEntry[],
  alerts: Alert[],
  frequency: DigestFrequency,
  now = Date.now(),
): AlertDigestPayload {
  const windowStart = now - DIGEST_FREQUENCY_MS[frequency]

  const fired = history
    .filter((h) => h.triggeredAt >= windowStart && h.triggeredAt <= now)
    .sort((a, b) => b.triggeredAt - a.triggeredAt)
    .map((h) => ({ alertId: h.alertId, assetPair: h.assetPair, price: h.price, triggeredAt: h.triggeredAt }))

  const active = alerts
    .filter((a) => a.active)
    .map((a) => ({ alertId: a.id, assetPair: a.assetPair, conditionSummary: summarizeCondition(a) }))

  return { frequency, windowStart, windowEnd: now, fired, active }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Renders the digest as a self-contained, shareable HTML fragment (#489) —
 * suitable both as an email body and for saving/forwarding standalone.
 * `unsubscribeUrl`, when given, appends an unsubscribe link/footer.
 */
export function renderDigestHtml(payload: AlertDigestPayload, unsubscribeUrl?: string): string {
  const range = `${new Date(payload.windowStart).toLocaleString()} – ${new Date(payload.windowEnd).toLocaleString()}`
  const firedRows = payload.fired.length
    ? payload.fired
        .map(
          (f) =>
            `<tr><td>${escapeHtml(f.assetPair)}</td><td>$${f.price}</td><td>${new Date(f.triggeredAt).toLocaleString()}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="3">No alerts fired in this window.</td></tr>'

  const activeRows = payload.active.length
    ? payload.active
        .map((a) => `<tr><td>${escapeHtml(a.assetPair)}</td><td>${escapeHtml(a.conditionSummary)}</td></tr>`)
        .join('')
    : '<tr><td colspan="2">No active alerts.</td></tr>'

  const footer = unsubscribeUrl
    ? `<p style="font-size:12px;color:#888;margin-top:24px;">Getting this too often? <a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a> from the digest.</p>`
    : ''

  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
  <h2>Alert digest — ${payload.frequency === 'daily' ? 'Daily' : 'Weekly'}</h2>
  <p style="color:#666;">${range}</p>
  <h3>Fired (${payload.fired.length})</h3>
  <table style="width:100%;border-collapse:collapse;"><thead><tr><th>Pair</th><th>Price</th><th>When</th></tr></thead><tbody>${firedRows}</tbody></table>
  <h3>Active conditions (${payload.active.length})</h3>
  <table style="width:100%;border-collapse:collapse;"><thead><tr><th>Pair</th><th>Condition</th></tr></thead><tbody>${activeRows}</tbody></table>
  ${footer}
</div>`.trim()
}

/** Plain-text fallback of the same digest, for clients/services that need it. */
export function renderDigestText(payload: AlertDigestPayload): string {
  const range = `${new Date(payload.windowStart).toLocaleString()} - ${new Date(payload.windowEnd).toLocaleString()}`
  const lines = [
    `Alert digest (${payload.frequency}) — ${range}`,
    '',
    `Fired (${payload.fired.length}):`,
    ...(payload.fired.length
      ? payload.fired.map((f) => `  - ${f.assetPair} @ $${f.price} (${new Date(f.triggeredAt).toLocaleString()})`)
      : ['  none']),
    '',
    `Active conditions (${payload.active.length}):`,
    ...(payload.active.length ? payload.active.map((a) => `  - ${a.assetPair}: ${a.conditionSummary}`) : ['  none']),
  ]
  return lines.join('\n')
}
