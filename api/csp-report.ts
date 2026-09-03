/**
 * Vercel serverless function that collects Content-Security-Policy violation
 * reports sent via the `report-to`/`report-uri` directives in vercel.json, and
 * the browser's Reporting API (`Reporting-Endpoints` header).
 *
 * This repo has no persistent backend, so reports are simply logged to the
 * function's structured logs (visible in the Vercel dashboard / `vercel logs`)
 * rather than stored. The primary, always-available violation surface is the
 * client-side capture in src/utils/cspReporting.ts, which does not depend on
 * this endpoint. Wire `console.log` output here into a real log sink (e.g.
 * forward to the existing error-reporting pipeline) if longer-term retention
 * is needed later.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end()
    return
  }

  let body = ''
  for await (const chunk of req) body += chunk

  try {
    const parsed = JSON.parse(body)
    // Support both the legacy `csp-report` shape and the newer Reporting API
    // array-of-reports shape.
    const reports = Array.isArray(parsed) ? parsed : [parsed]
    for (const report of reports) {
      console.log(JSON.stringify({ type: 'csp-violation', receivedAt: new Date().toISOString(), report }))
    }
  } catch {
    console.log(JSON.stringify({ type: 'csp-violation', receivedAt: new Date().toISOString(), raw: body.slice(0, 2000) }))
  }

  res.statusCode = 204
  res.end()
}
