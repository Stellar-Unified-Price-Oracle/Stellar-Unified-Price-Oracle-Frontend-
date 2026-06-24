/**
 * Advanced search parser supporting operators:
 *   source:chainlink
 *   confidence:>95
 *   price:<1000
 *   updated:<5m
 *   (plain text matches assetPair name)
 */

export interface ParsedSearch {
  text: string
  source: string | null
  /** e.g. { op: '>', value: 95 } */
  confidence: { op: '>' | '<' | '='; value: number } | null
  /** e.g. { op: '>', value: 1000 } */
  price: { op: '>' | '<' | '='; value: number } | null
  /** age in seconds, e.g. { op: '<', value: 300 } */
  updated: { op: '>' | '<' | '='; value: number } | null
}

const OPS = /^([><]?)(\d+(?:\.\d+)?)(m|s|h)?$/

function parseNumericOp(raw: string): { op: '>' | '<' | '='; value: number; unit?: string } | null {
  // strip wrapping operator from front if present
  const match = raw.match(/^([><]?)(.+)$/)
  if (!match) return null
  const op = (match[1] as '>' | '<') || '='
  const rest = match[2]
  const num = parseFloat(rest)
  if (Number.isNaN(num)) return null
  return { op, value: num }
}

function parseTimeOp(raw: string): { op: '>' | '<' | '='; value: number } | null {
  const match = raw.match(/^([><]?)(\d+(?:\.\d+)?)(m|s|h)?$/)
  if (!match) return null
  const op = (match[1] as '>' | '<') || '='
  let value = parseFloat(match[2])
  const unit = match[3]
  if (unit === 'm' || !unit) value *= 60
  else if (unit === 'h') value *= 3600
  return { op, value }
}

export function parseSearch(query: string): ParsedSearch {
  const result: ParsedSearch = {
    text: '',
    source: null,
    confidence: null,
    price: null,
    updated: null,
  }

  // Split on whitespace but keep quoted strings together
  const tokens = query.match(/\S+/g) ?? []
  const textParts: string[] = []

  for (const token of tokens) {
    const colonIdx = token.indexOf(':')
    if (colonIdx > 0) {
      const key = token.slice(0, colonIdx).toLowerCase()
      const val = token.slice(colonIdx + 1)

      if (key === 'source') {
        result.source = val.toLowerCase()
        continue
      }
      if (key === 'confidence') {
        result.confidence = parseNumericOp(val)
        continue
      }
      if (key === 'price') {
        result.price = parseNumericOp(val)
        continue
      }
      if (key === 'updated') {
        result.updated = parseTimeOp(val)
        continue
      }
    }
    textParts.push(token)
  }

  result.text = textParts.join(' ').trim()
  return result
}

export interface FilterablePriceData {
  assetPair: string
  price: number
  confidence: number
  sources: string[]
  timestamp: number
}

export function matchesParsedSearch(item: FilterablePriceData, parsed: ParsedSearch): boolean {
  const { text, source, confidence, price, updated } = parsed

  if (text && !item.assetPair.toLowerCase().includes(text.toLowerCase())) {
    return false
  }

  if (source && !item.sources.some((s) => s.toLowerCase() === source)) {
    return false
  }

  if (confidence) {
    const pct = item.confidence * 100
    if (confidence.op === '>' && !(pct > confidence.value)) return false
    if (confidence.op === '<' && !(pct < confidence.value)) return false
    if (confidence.op === '=' && !(Math.round(pct) === Math.round(confidence.value))) return false
  }

  if (price) {
    if (price.op === '>' && !(item.price > price.value)) return false
    if (price.op === '<' && !(item.price < price.value)) return false
    if (price.op === '=' && !(item.price === price.value)) return false
  }

  if (updated) {
    const ageSeconds = (Date.now() - item.timestamp) / 1000
    if (updated.op === '<' && !(ageSeconds < updated.value)) return false
    if (updated.op === '>' && !(ageSeconds > updated.value)) return false
  }

  return true
}

/** Autocomplete suggestions for operator prefixes */
export const OPERATOR_SUGGESTIONS = [
  { label: 'source:chainlink', hint: 'Filter by Chainlink source' },
  { label: 'source:redstone', hint: 'Filter by Redstone source' },
  { label: 'source:band', hint: 'Filter by Band source' },
  { label: 'source:reflector', hint: 'Filter by Reflector source' },
  { label: 'confidence:>95', hint: 'Confidence above 95%' },
  { label: 'confidence:>80', hint: 'Confidence above 80%' },
  { label: 'confidence:<50', hint: 'Confidence below 50%' },
  { label: 'price:<1000', hint: 'Price below 1000' },
  { label: 'price:>1000', hint: 'Price above 1000' },
  { label: 'updated:<5m', hint: 'Updated within 5 minutes' },
  { label: 'updated:<1m', hint: 'Updated within 1 minute' },
]

export function getAutocompleteSuggestions(input: string): typeof OPERATOR_SUGGESTIONS {
  if (!input) return []
  const lower = input.toLowerCase()
  return OPERATOR_SUGGESTIONS.filter(
    (s) => s.label.startsWith(lower) && s.label !== lower
  ).slice(0, 6)
}
