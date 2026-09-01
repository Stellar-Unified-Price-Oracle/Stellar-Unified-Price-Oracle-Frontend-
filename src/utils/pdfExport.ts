import { jsPDF } from 'jspdf'
import type { PriceHistoryEntry } from '../types'
import type { RasterizedChart } from './chartExport'

export interface ExportPriceHistoryPdfOptions {
  pair: string
  history: PriceHistoryEntry[]
  chart: RasterizedChart | null
  filename: string
}

const MARGIN = 12
const ROW_HEIGHT = 6
const TABLE_TOP = 26

function isoTs(ts: number): string {
  return new Date(ts).toISOString()
}

function drawTableHeader(doc: jsPDF, pair: string, colX: Record<string, number>): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.setFontSize(14)
  doc.setTextColor(20)
  doc.text(`${pair} Price Report`, MARGIN, 14)
  doc.setFontSize(8)
  doc.setTextColor(110)
  doc.text(`Generated ${new Date().toLocaleString()} · Source: Stellar Unified Price Oracle`, MARGIN, 20)

  doc.setFontSize(9)
  doc.setTextColor(60)
  doc.setFont('helvetica', 'bold')
  doc.text('Asset Pair', colX.assetPair, TABLE_TOP)
  doc.text('Price', colX.price, TABLE_TOP)
  doc.text('Timestamp (UTC)', colX.timestamp, TABLE_TOP)
  doc.text('Confidence', colX.confidence, TABLE_TOP)
  doc.text('Sources', colX.sources, TABLE_TOP)
  doc.setFont('helvetica', 'normal')
  doc.setDrawColor(210)
  doc.line(MARGIN, TABLE_TOP + 2, pageWidth - MARGIN, TABLE_TOP + 2)
}

function addFootersAndPageNumbers(doc: jsPDF, label: string): void {
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const width = doc.internal.pageSize.getWidth()
    const height = doc.internal.pageSize.getHeight()
    doc.setFontSize(8)
    doc.setTextColor(130)
    doc.text(`Page ${i} of ${pageCount}`, width - MARGIN, height - 6, { align: 'right' })
    doc.text(label, MARGIN, height - 6)
  }
}

/**
 * Builds a PDF report combining a paginated price data table (landscape) with
 * an embedded chart image (portrait), and triggers a download (#316).
 */
export function exportPriceHistoryPdf({ pair, history, chart, filename }: ExportPriceHistoryPdfOptions): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.setProperties({
    title: `${pair} Price Report`,
    subject: 'Stellar Unified Price Oracle price data export',
    author: 'Stellar Unified Price Oracle',
    creator: 'Stellar Unified Price Oracle',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const colX = {
    assetPair: MARGIN,
    price: MARGIN + 55,
    timestamp: MARGIN + 100,
    confidence: MARGIN + 175,
    sources: MARGIN + 215,
  }
  const sourcesColWidth = pageWidth - MARGIN - colX.sources

  drawTableHeader(doc, pair, colX)
  let y = TABLE_TOP + ROW_HEIGHT + 2
  doc.setFontSize(8)
  doc.setTextColor(40)

  for (const entry of history) {
    if (y > pageHeight - MARGIN - 4) {
      doc.addPage('a4', 'landscape')
      drawTableHeader(doc, pair, colX)
      y = TABLE_TOP + ROW_HEIGHT + 2
    }
    doc.text(pair, colX.assetPair, y)
    doc.text(String(entry.price), colX.price, y)
    doc.text(isoTs(entry.timestamp), colX.timestamp, y)
    doc.text(`${(entry.confidence * 100).toFixed(1)}%`, colX.confidence, y)
    doc.text(entry.sources.join('; '), colX.sources, y, { maxWidth: sourcesColWidth })
    y += ROW_HEIGHT
  }

  if (history.length === 0) {
    doc.setTextColor(130)
    doc.text('No price history available for this range.', MARGIN, y)
  }

  if (chart) {
    doc.addPage('a4', 'portrait')
    const pw = doc.internal.pageSize.getWidth()
    const ph = doc.internal.pageSize.getHeight()
    doc.setFontSize(14)
    doc.setTextColor(20)
    doc.text(`${pair} Price Chart`, MARGIN, 14)

    const maxWidth = pw - MARGIN * 2
    const maxHeight = ph - 24 - MARGIN
    const aspect = chart.width / chart.height
    let imgWidth = maxWidth
    let imgHeight = imgWidth / aspect
    if (imgHeight > maxHeight) {
      imgHeight = maxHeight
      imgWidth = imgHeight * aspect
    }
    doc.addImage(chart.dataUrl, 'PNG', MARGIN, 22, imgWidth, imgHeight)
  }

  addFootersAndPageNumbers(doc, `${pair} · Stellar Unified Price Oracle`)
  doc.save(filename)
}
