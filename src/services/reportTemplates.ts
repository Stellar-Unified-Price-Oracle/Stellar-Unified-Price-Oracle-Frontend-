import type { PriceData, SourceHealth, AlertHistoryEntry } from '../types'
import { toCsv, alertHistoryToCsvRows } from '../utils/export'
import { jsPDF } from 'jspdf'

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

export type ReportTemplateId = 'feed-health' | 'top-movers' | 'alert-digest'

export interface ReportTemplate {
  id: ReportTemplateId
  label: string
  description: string
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'feed-health',
    label: 'Feed Health',
    description: 'Current health status, latency, and last-update time for each oracle source.',
  },
  {
    id: 'top-movers',
    label: 'Top Movers',
    description: 'Asset pairs ranked by price, with percentage change where history is available.',
  },
  {
    id: 'alert-digest',
    label: 'Alert Digest',
    description: 'History of fired alerts including asset pair, trigger price, and condition.',
  },
]

// ---------------------------------------------------------------------------
// Report data shape
// ---------------------------------------------------------------------------

export interface ReportData {
  prices: PriceData[]
  sourceHealths: SourceHealth[]
  alertHistory?: AlertHistoryEntry[]
}

// ---------------------------------------------------------------------------
// CSV generation helpers
// ---------------------------------------------------------------------------

function feedHealthCsv(data: ReportData): string {
  const headers = ['source', 'status', 'latency', 'lastUpdate']
  const rows = data.sourceHealths.map((s) => ({
    source: s.source,
    status: s.status,
    latency: s.latency !== null ? s.latency : '',
    lastUpdate: s.lastUpdate !== null ? new Date(s.lastUpdate).toISOString() : '',
  }))
  return toCsv(rows, headers)
}

function topMoversCsv(data: ReportData): string {
  const headers = ['pair', 'price', 'change%']
  const rows = data.prices.map((p) => ({
    pair: p.assetPair,
    price: p.price,
    'change%': 0,
  }))
  return toCsv(rows, headers)
}

function alertDigestCsv(data: ReportData): string {
  const entries = data.alertHistory ?? []
  const { rows } = alertHistoryToCsvRows(entries)
  // Restrict to the four columns required by the spec
  const specHeaders = ['assetPair', 'triggeredAt', 'price', 'condition']
  const filteredRows = rows.map((r) =>
    Object.fromEntries(specHeaders.map((h) => [h, r[h]])),
  )
  return toCsv(filteredRows, specHeaders)
}

/**
 * Generates a CSV string for the given report template and data.
 *
 * - feed-health: source, status, latency, lastUpdate
 * - top-movers: pair, price, change%
 * - alert-digest: assetPair, triggeredAt, price, condition
 */
export function generateReportCsv(templateId: ReportTemplateId, data: ReportData): string {
  switch (templateId) {
    case 'feed-health':
      return feedHealthCsv(data)
    case 'top-movers':
      return topMoversCsv(data)
    case 'alert-digest':
      return alertDigestCsv(data)
  }
}

// ---------------------------------------------------------------------------
// PDF generation helpers
// ---------------------------------------------------------------------------

/** Resolve a human-readable title for a template. */
function templateTitle(templateId: ReportTemplateId): string {
  return REPORT_TEMPLATES.find((t) => t.id === templateId)?.label ?? templateId
}

/** Render a simple table into a jsPDF document starting at (x, y). Returns the y position after the last row. */
function renderTable(
  doc: jsPDF,
  headers: string[],
  rows: Array<Record<string, unknown>>,
  startX: number,
  startY: number,
  colWidth: number,
  rowHeight: number,
): number {
  let y = startY

  // Header row
  doc.setFont('helvetica', 'bold')
  headers.forEach((h, i) => {
    doc.text(h, startX + i * colWidth, y)
  })
  y += rowHeight

  // Data rows
  doc.setFont('helvetica', 'normal')
  for (const row of rows) {
    // Start a new page if we're near the bottom
    if (y > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage()
      y = 20
    }
    headers.forEach((h, i) => {
      doc.text(String(row[h] ?? ''), startX + i * colWidth, y)
    })
    y += rowHeight
  }

  return y
}

/** Build rows/headers for PDF output, mirroring the CSV logic. */
function buildPdfTableData(
  templateId: ReportTemplateId,
  data: ReportData,
): { headers: string[]; rows: Array<Record<string, unknown>> } {
  switch (templateId) {
    case 'feed-health': {
      const headers = ['source', 'status', 'latency', 'lastUpdate']
      const rows = data.sourceHealths.map((s) => ({
        source: s.source,
        status: s.status,
        latency: s.latency !== null ? String(s.latency) : 'N/A',
        lastUpdate: s.lastUpdate !== null ? new Date(s.lastUpdate).toISOString() : 'N/A',
      }))
      return { headers, rows }
    }
    case 'top-movers': {
      const headers = ['pair', 'price', 'change%']
      const rows = data.prices.map((p) => ({
        pair: p.assetPair,
        price: String(p.price),
        'change%': '0',
      }))
      return { headers, rows }
    }
    case 'alert-digest': {
      const entries = data.alertHistory ?? []
      const { rows } = alertHistoryToCsvRows(entries)
      const specHeaders = ['assetPair', 'triggeredAt', 'price', 'condition']
      const filteredRows = rows.map((r) =>
        Object.fromEntries(specHeaders.map((h) => [h, r[h]])),
      )
      return { headers: specHeaders, rows: filteredRows }
    }
  }
}

/**
 * Generates a PDF report as a `Uint8Array` for the given template and data.
 *
 * The PDF contains:
 * - A bold title (template label)
 * - A "Generated: <ISO timestamp>" subtitle
 * - A plain-text table with headers and data rows
 */
export function generateReportPdfBlob(templateId: ReportTemplateId, data: ReportData): Uint8Array {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const title = templateTitle(templateId)
  const generated = `Generated: ${new Date().toISOString()}`

  // Title
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 40, 40)

  // Subtitle
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(generated, 40, 58)

  // Separator line
  doc.setLineWidth(0.5)
  doc.line(40, 64, doc.internal.pageSize.getWidth() - 40, 64)

  // Table
  doc.setFontSize(9)
  const { headers, rows } = buildPdfTableData(templateId, data)
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 40
  const colWidth = Math.max(60, (pageWidth - marginX * 2) / Math.max(headers.length, 1))
  renderTable(doc, headers, rows, marginX, 80, colWidth, 14)

  // Output as Uint8Array
  const pdfOutput = doc.output('arraybuffer')
  return new Uint8Array(pdfOutput)
}
