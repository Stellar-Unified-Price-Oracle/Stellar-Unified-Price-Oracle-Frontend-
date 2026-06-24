import type { PriceData, PriceHistoryEntry } from '../types'

function isoTs(ts: number): string {
  return new Date(ts).toISOString()
}

export function toCsv(rows: Array<Record<string, unknown>>, headers: string[]): string {
  const escape = (v: unknown) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))]
  return lines.join('\n')
}

export function priceDataToCsvRows(prices: PriceData[]): { rows: Array<Record<string, unknown>>; headers: string[] } {
  const headers = ['assetPair', 'price', 'timestamp', 'confidence', 'sources']
  const rows = prices.map((p) => ({
    assetPair: p.assetPair,
    price: p.price,
    timestamp: isoTs(p.timestamp),
    confidence: p.confidence,
    sources: p.sources.join(';'),
  }))
  return { rows, headers }
}

export function historyToCsvRows(
  pair: string,
  history: PriceHistoryEntry[],
): { rows: Array<Record<string, unknown>>; headers: string[] } {
  const headers = ['assetPair', 'price', 'timestamp', 'confidence', 'sources']
  const rows = history.map((h) => ({
    assetPair: pair,
    price: h.price,
    timestamp: isoTs(h.timestamp),
    confidence: h.confidence,
    sources: h.sources.join(';'),
  }))
  return { rows, headers }
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportFilename(pair: string, format: 'csv' | 'json'): string {
  const safe = pair.replace(/\//g, '-')
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  return `${safe}_${ts}.${format}`
}
