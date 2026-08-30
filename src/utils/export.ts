import type { AlertHistoryEntry, PriceData, PriceHistoryEntry, SourceHealth } from '../types'
import { EXPORT_COLUMNS, sanitizeColumns } from './exportColumns'
import { qualityExportFields } from './dataQualityScore'

function isoTs(ts: number): string {
  return new Date(ts).toISOString()
}

/** Human-readable summary of the condition that fired an {@link AlertHistoryEntry} (#309). */
function alertHistoryCondition(entry: AlertHistoryEntry): string {
  if (entry.percentageMode) {
    const dir = entry.percentageDirection ?? 'either'
    return `${dir} ${entry.percentageThreshold ?? 0}% in ${entry.percentageWindow ?? '1hr'}`
  }
  if (entry.upperThreshold !== null && entry.lowerThreshold !== null) {
    return `between ${entry.lowerThreshold} and ${entry.upperThreshold}`
  }
  if (entry.upperThreshold !== null) return `above ${entry.upperThreshold}`
  if (entry.lowerThreshold !== null) return `below ${entry.lowerThreshold}`
  return ''
}

/** Converts fired-alert history entries to CSV-ready rows (#309). */
export function alertHistoryToCsvRows(entries: AlertHistoryEntry[]): { rows: Array<Record<string, unknown>>; headers: string[] } {
  const headers = ['assetPair', 'triggeredAt', 'price', 'condition', 'alertType']
  const rows = entries.map((e) => ({
    assetPair: e.assetPair,
    triggeredAt: isoTs(e.triggeredAt),
    price: e.price,
    condition: alertHistoryCondition(e),
    alertType: e.triggerOnce ? 'one-time' : 'persistent',
  }))
  return { rows, headers }
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

/** Converts an array of {@link PriceData} to CSV-ready rows. Timestamps are serialised as ISO-8601 strings; sources joined with ";". Optionally restricts/reorders columns (#317). */
export function priceDataToCsvRows(
  prices: PriceData[],
  columns?: string[],
): { rows: Array<Record<string, unknown>>; headers: string[] } {
  const headers = sanitizeColumns(columns)
  const values: Record<string, (p: PriceData) => unknown> = {
    assetPair: (p) => p.assetPair,
    price: (p) => p.price,
    timestamp: (p) => isoTs(p.timestamp),
    confidence: (p) => p.confidence,
    sources: (p) => p.sources.join(';'),
  }
  const rows = prices.map((p) =>
    Object.fromEntries(headers.map((h) => [h, values[h](p)])),
  )
  return { rows, headers }
}

/** Restricts an array of {@link PriceData} to the given columns, for JSON export (#317). */
export function priceDataToJsonRows(prices: PriceData[], columns?: string[]): Array<Record<string, unknown>> {
  const { rows } = priceDataToCsvRows(prices, columns)
  return rows.map((r, i) => (columns === undefined ? { ...prices[i] } : r))
}

/** Converts a pair's {@link PriceHistoryEntry} array to CSV-ready rows, injecting the asset pair name into each row. */
export function historyToCsvRows(
  pair: string,
  history: PriceHistoryEntry[],
): { rows: Array<Record<string, unknown>>; headers: string[] } {
  const headers = [
    'assetPair',
    'price',
    'timestamp',
    'confidence',
    'sources',
    'qualityScore',
    'qualityLabel',
    'qualityFreshness',
    'qualityConfidence',
    'qualityDeviation',
    'qualitySourceCoverage',
  ]

  // Compute quality fields once for the full history window
  const latestTimestamp =
    history.length > 0
      ? history.reduce((max, e) => (e.timestamp > max ? e.timestamp : max), history[0].timestamp)
      : 0
  const quality = qualityExportFields(history, latestTimestamp)

  const rows = history.map((h) => ({
    assetPair: pair,
    price: h.price,
    timestamp: isoTs(h.timestamp),
    confidence: h.confidence,
    sources: h.sources.join(';'),
    ...quality,
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

/** Triggers a browser file download for binary data (Uint8Array). */
export function downloadBinaryFile(data: Uint8Array, filename: string, mimeType: string): void {
  // `.slice()` copies the view into a fresh ArrayBuffer so it satisfies the
  // BlobPart typing (Uint8Array<ArrayBufferLike> is otherwise rejected).
  const blob = new Blob([data.slice()], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Generates a safe export filename like `XLM-USD_2024-01-01T12-00-00.csv` for a given asset pair and format. */
export function exportFilename(pair: string, format: 'csv' | 'json' | 'xlsx'): string {
  const safe = pair.replace(/\//g, '-')
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  return `${safe}_${ts}.${format}`
}

// ── Minimal pure-JS .xlsx generator (#314) ────────────────────────────────────
// Implements a minimal OOXML Spreadsheet writer without any external dependencies.
// Produces a valid .xlsx file with a single worksheet, typed columns, and a
// styled header row (bold + background fill).

/** Escape special XML characters in cell string values. */
function xmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Convert a 1-based column index to Excel letter notation (1→A, 27→AA). */
function colLetter(n: number): string {
  let result = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    result = String.fromCharCode(65 + rem) + result
    n = Math.floor((n - 1) / 26)
  }
  return result
}

/** Cell address from 1-based col/row (e.g. col=1, row=2 → "A2"). */
function cellAddr(col: number, row: number): string {
  return `${colLetter(col)}${row}`
}

interface XlsxSheet {
  name: string
  headers: string[]
  rows: Array<Record<string, unknown>>
}

/**
 * Builds a minimal .xlsx binary (Uint8Array) from one or more sheets.
 *
 * The generated workbook:
 * - Uses inline strings (no shared string table) for simplicity.
 * - Applies bold + yellow background (#FFD700) to the header row.
 * - Formats number columns as numbers, string columns as text.
 * - Optimises file size by omitting unused OOXML parts.
 */
export function buildXlsx(sheets: XlsxSheet[]): Uint8Array {
  // Build each worksheet XML
  const worksheetXmls: string[] = sheets.map((sheet) => {
    const rows: string[] = []

    // Header row (row 1) — styled with cellStyle="1" (bold header)
    const headerCells = sheet.headers
      .map((h, ci) => {
        const addr = cellAddr(ci + 1, 1)
        return `<c r="${addr}" t="inlineStr" s="1"><is><t>${xmlEscape(h)}</t></is></c>`
      })
      .join('')
    rows.push(`<row r="1">${headerCells}</row>`)

    // Data rows
    sheet.rows.forEach((rowData, ri) => {
      const rowNum = ri + 2
      const cells = sheet.headers
        .map((h, ci) => {
          const val = rowData[h]
          const addr = cellAddr(ci + 1, rowNum)
          if (typeof val === 'number') {
            return `<c r="${addr}"><v>${val}</v></c>`
          }
          const str = String(val ?? '')
          return `<c r="${addr}" t="inlineStr"><is><t>${xmlEscape(str)}</t></is></c>`
        })
        .join('')
      rows.push(`<row r="${rowNum}">${cells}</row>`)
    })

    const lastCol = colLetter(sheet.headers.length)
    const lastRow = sheet.rows.length + 1
    const dimension = `A1:${lastCol}${lastRow}`

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dimension}"/>
  <sheetData>${rows.join('')}</sheetData>
</worksheet>`
  })

  // Styles XML — defines font/fill for header cells (styleIndex=1)
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFD700"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
</styleSheet>`

  // Workbook XML
  const sheetRefs = sheets.map((s, i) => `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetRefs}</sheets>
</workbook>`

  // Workbook relationships
  const sheetRelsEntries = sheets
    .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
    .join('')
  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRelsEntries}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

  // Root [Content_Types].xml
  const contentTypesEntries = sheets
    .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join('')
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${contentTypesEntries}
</Types>`

  // Root _rels/.rels
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

  // Build a minimal ZIP containing all OOXML parts
  const files: Array<{ name: string; content: string }> = [
    { name: '[Content_Types].xml', content: contentTypesXml },
    { name: '_rels/.rels', content: rootRelsXml },
    { name: 'xl/workbook.xml', content: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
    { name: 'xl/styles.xml', content: stylesXml },
    ...worksheetXmls.map((xml, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, content: xml })),
  ]

  return buildZip(files)
}

// ── Minimal ZIP builder ────────────────────────────────────────────────────────
// Implements just enough of the ZIP specification (PKZIP) to produce a valid
// .xlsx container: stored (uncompressed) entries + central directory + EOCD.

function encodeUtf8(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

function uint16LE(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff]
}

function uint32LE(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]
}

/** CRC-32 table (IEEE polynomial) */
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function buildZip(files: Array<{ name: string; content: string }>): Uint8Array {
  const parts: Uint8Array[] = []
  const centralDirEntries: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const nameBytes = encodeUtf8(file.name)
    const dataBytes = encodeUtf8(file.content)
    const crc = crc32(dataBytes)
    const size = dataBytes.length

    // Local file header
    const localHeader = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, // local file header sig
      ...uint16LE(20),         // version needed (2.0)
      ...uint16LE(0),          // flags
      ...uint16LE(0),          // compression (stored)
      ...uint16LE(0),          // mod time
      ...uint16LE(0),          // mod date
      ...uint32LE(crc),        // CRC-32
      ...uint32LE(size),       // compressed size
      ...uint32LE(size),       // uncompressed size
      ...uint16LE(nameBytes.length), // file name length
      ...uint16LE(0),          // extra field length
    ])

    const localEntry = new Uint8Array(localHeader.length + nameBytes.length + dataBytes.length)
    localEntry.set(localHeader, 0)
    localEntry.set(nameBytes, localHeader.length)
    localEntry.set(dataBytes, localHeader.length + nameBytes.length)
    parts.push(localEntry)

    // Central directory entry
    const cdEntry = new Uint8Array([
      0x50, 0x4b, 0x01, 0x02, // central dir sig
      ...uint16LE(20),         // version made by
      ...uint16LE(20),         // version needed
      ...uint16LE(0),          // flags
      ...uint16LE(0),          // compression
      ...uint16LE(0),          // mod time
      ...uint16LE(0),          // mod date
      ...uint32LE(crc),        // CRC-32
      ...uint32LE(size),       // compressed size
      ...uint32LE(size),       // uncompressed size
      ...uint16LE(nameBytes.length), // file name length
      ...uint16LE(0),          // extra field length
      ...uint16LE(0),          // file comment length
      ...uint16LE(0),          // disk number start
      ...uint16LE(0),          // int file attrs
      ...uint32LE(0),          // ext file attrs
      ...uint32LE(offset),     // relative offset
    ])
    const cdEntryFull = new Uint8Array(cdEntry.length + nameBytes.length)
    cdEntryFull.set(cdEntry, 0)
    cdEntryFull.set(nameBytes, cdEntry.length)
    centralDirEntries.push(cdEntryFull)

    offset += localEntry.length
  }

  // Central directory size and offset
  const cdSize = centralDirEntries.reduce((s, e) => s + e.length, 0)
  const cdOffset = offset

  // End of central directory record
  const eocd = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06, // EOCD sig
    ...uint16LE(0),           // disk number
    ...uint16LE(0),           // disk with CD
    ...uint16LE(files.length),// entries on disk
    ...uint16LE(files.length),// total entries
    ...uint32LE(cdSize),      // CD size
    ...uint32LE(cdOffset),    // CD offset
    ...uint16LE(0),           // comment length
  ])

  // Concatenate everything
  const totalSize = offset + cdSize + eocd.length
  const result = new Uint8Array(totalSize)
  let pos = 0
  for (const p of parts) {
    result.set(p, pos)
    pos += p.length
  }
  for (const e of centralDirEntries) {
    result.set(e, pos)
    pos += e.length
  }
  result.set(eocd, pos)

  return result
}

/** Converts an array of {@link PriceData} to a single-sheet .xlsx Uint8Array. Optionally restricts/reorders columns (#317). */
export function priceDataToXlsx(prices: PriceData[], columns?: string[]): Uint8Array {
  const keys = sanitizeColumns(columns)
  const labels = Object.fromEntries(EXPORT_COLUMNS.map((c) => [c.key, c.label]))
  const headers = keys.map((k) => labels[k])
  const values: Record<string, (p: PriceData) => unknown> = {
    assetPair: (p) => p.assetPair,
    price: (p) => p.price,
    timestamp: (p) => isoTs(p.timestamp),
    confidence: (p) => p.confidence,
    sources: (p) => p.sources.join(';'),
  }
  const rows = prices.map((p) =>
    Object.fromEntries(keys.map((k, i) => [headers[i], values[k](p)])),
  )
  return buildXlsx([{ name: 'Price Data', headers, rows }])
}

/** Converts a pair's price history to a single-sheet .xlsx Uint8Array. */
export function historyToXlsx(pair: string, history: PriceHistoryEntry[]): Uint8Array {
  const headers = ['Asset Pair', 'Price', 'Timestamp', 'Confidence', 'Sources']
  const rows = history.map((h) => ({
    'Asset Pair': pair,
    'Price': h.price,
    'Timestamp': isoTs(h.timestamp),
    'Confidence': h.confidence,
    'Sources': h.sources.join(';'),
  }))
  return buildXlsx([{ name: pair, headers, rows }])
}

// ── Source Reliability Leaderboard helpers (#481) ─────────────────────────────

/**
 * Computed reliability metrics for a single oracle source over a given time
 * window. Produced by {@link computeSourceMetrics} and consumed by
 * {@link ReliabilityLeaderboard} and {@link exportLeaderboardCsv}.
 */
export interface SourceReliabilityMetric {
  /** Oracle source identifier (e.g. 'chainlink'). */
  source: string
  /**
   * Percentage (0–100) of history entries within the time window where this
   * source was present in the `sources` array.
   */
  uptimePercent: number
  /**
   * Average measured latency in milliseconds as reported by {@link SourceHealth},
   * or `null` when no latency data is available.
   */
  meanLatencyMs: number | null
  /**
   * Milliseconds since {@link SourceHealth.lastUpdate}. A value of 0 is used
   * when `lastUpdate` is null (i.e. source has never reported).
   */
  stalenessMs: number
  /**
   * Direction of the uptime change comparing the current window against the
   * previous window of the same length.
   * - `'up'`   — uptime improved by > 1 pp
   * - `'down'` — uptime fell by > 1 pp
   * - `'stable'` — change is within ±1 pp or no prior-window data exists
   */
  trend: 'up' | 'down' | 'stable'
}

/**
 * Compute {@link SourceReliabilityMetric} for every source in `sourceHealths`.
 *
 * Uptime is derived from `priceHistory`: for each asset pair, we count how many
 * history entries in the window include the source. We then divide by the total
 * entries across all pairs for that source.
 *
 * Trend compares the current window's uptime against the preceding window of
 * equal duration (`windowMs`).
 *
 * @param sourceHealths  Live health records from the aggregator API.
 * @param priceHistory   Historical entries keyed by asset pair.
 * @param windowMs       Length of the analysis window in milliseconds.
 */
export function computeSourceMetrics(
  sourceHealths: SourceHealth[],
  priceHistory: Record<string, PriceHistoryEntry[]>,
  windowMs: number,
): SourceReliabilityMetric[] {
  const now = Date.now()
  const windowStart = now - windowMs
  const prevWindowStart = windowStart - windowMs

  // Flatten all history entries once so we iterate them only twice
  const allEntries = Object.values(priceHistory).flat()

  const currentEntries = allEntries.filter((e) => e.timestamp >= windowStart)
  const prevEntries = allEntries.filter(
    (e) => e.timestamp >= prevWindowStart && e.timestamp < windowStart,
  )

  const metrics: SourceReliabilityMetric[] = sourceHealths.map((sh) => {
    const src = sh.source as string

    // Uptime in current window
    const uptimePercent =
      currentEntries.length > 0
        ? (currentEntries.filter((e) => e.sources.includes(src)).length /
            currentEntries.length) *
          100
        : 0

    // Uptime in previous window (for trend)
    const prevUptimePercent =
      prevEntries.length > 0
        ? (prevEntries.filter((e) => e.sources.includes(src)).length /
            prevEntries.length) *
          100
        : null

    // Trend: threshold of 1 percentage point to avoid noise
    let trend: SourceReliabilityMetric['trend'] = 'stable'
    if (prevUptimePercent !== null) {
      const delta = uptimePercent - prevUptimePercent
      if (delta > 1) trend = 'up'
      else if (delta < -1) trend = 'down'
    }

    // Staleness
    const stalenessMs = sh.lastUpdate !== null ? Math.max(0, now - sh.lastUpdate) : 0

    return {
      source: src,
      uptimePercent,
      meanLatencyMs: sh.latency,
      stalenessMs,
      trend,
    }
  })

  // Sort descending by uptime, then ascending by staleness as tiebreaker
  metrics.sort((a, b) => {
    const diff = b.uptimePercent - a.uptimePercent
    if (diff !== 0) return diff
    return a.stalenessMs - b.stalenessMs
  })

  return metrics
}

/**
 * Triggers a browser CSV download for the reliability leaderboard.
 *
 * Filename: `reliability-leaderboard_<ISO-timestamp>.csv`
 *
 * @param metrics  Array produced by {@link computeSourceMetrics}.
 */
export function exportLeaderboardCsv(metrics: SourceReliabilityMetric[]): void {
  const headers = [
    'rank',
    'source',
    'uptimePercent',
    'meanLatencyMs',
    'stalenessMs',
    'trend',
  ]

  const rows: Array<Record<string, unknown>> = metrics.map((m, i) => ({
    rank: i + 1,
    source: m.source,
    uptimePercent: parseFloat(m.uptimePercent.toFixed(2)),
    meanLatencyMs: m.meanLatencyMs ?? '',
    stalenessMs: m.stalenessMs,
    trend: m.trend,
  }))

  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  const filename = `reliability-leaderboard_${ts}.csv`
  downloadFile(toCsv(rows, headers), filename, 'text/csv')
}
