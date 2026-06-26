import type { PriceData, PriceHistoryEntry } from '../types'

function isoTs(ts: number): string {
  return new Date(ts).toISOString()
}

/** Serialises an array of plain objects to a CSV string. Values containing commas, quotes, or newlines are quoted and escaped. */
export function toCsv(rows: Array<Record<string, unknown>>, headers: string[]): string {
  const escape = (v: unknown): string => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))]
  return lines.join('\n')
}

/** Converts an array of {@link PriceData} to CSV-ready rows. Timestamps are serialised as ISO-8601 strings; sources joined with ";". */
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

/** Converts a pair's {@link PriceHistoryEntry} array to CSV-ready rows, injecting the asset pair name into each row. */
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

/** Triggers a browser file download for the given content string. Creates and immediately revokes an object URL. */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Generates a safe export filename like `XLM-USD_2024-01-01T12-00-00.csv` for a given asset pair and format. */
export function exportFilename(pair: string, format: 'csv' | 'json'): string {
  const safe = pair.replace(/\//g, '-')
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  return `${safe}_${ts}.${format}`
}
