/**
 * @file governanceParameterDiff
 *
 * Utilities for analyzing, diffing, and formatting proposed governance parameter
 * changes (#851).
 *
 * Rules:
 * - Never fabricate missing values. A null current value is rendered explicitly
 *   as "Not set" or "Unreported", not guessed as zero or empty.
 * - Numerical deltas are calculated safely; non-numeric values (e.g. JSON/addresses)
 *   gracefully return null for mathematical deltas.
 */
import type { ParameterDiffType, ProposedParameterChange } from '../types/governance'

export interface ParameterDeltaInfo {
  delta: number
  formattedDelta: string
  percentChange: number | null
  formattedPercent: string | null
  direction: 'increase' | 'decrease' | 'unchanged'
}

/**
 * Parses a string value into a clean number if possible.
 * Returns NaN if the string cannot be parsed as a finite number.
 */
function parseNumeric(val: string | null): number {
  if (val === null) return NaN
  const trimmed = val.trim()
  if (trimmed === '') return NaN
  // Strip trailing % or unit if present for parsing
  const clean = trimmed.replace(/%$/, '').trim()
  const n = Number(clean)
  return Number.isFinite(n) ? n : NaN
}

/**
 * Computes the numerical delta and percentage change between current and proposed values.
 * Returns null if either value is not a valid number.
 */
export function computeParameterDelta(
  currentVal: string | null,
  proposedVal: string | null,
): ParameterDeltaInfo | null {
  const currentNum = parseNumeric(currentVal)
  const proposedNum = parseNumeric(proposedVal)

  if (Number.isNaN(currentNum) || Number.isNaN(proposedNum)) {
    return null
  }

  const delta = proposedNum - currentNum
  const direction: ParameterDeltaInfo['direction'] =
    delta > 0 ? 'increase' : delta < 0 ? 'decrease' : 'unchanged'

  const sign = delta > 0 ? '+' : ''
  // Format delta based on whether numbers are integers or floats
  const isFloat = !Number.isInteger(currentNum) || !Number.isInteger(proposedNum)
  const formattedDelta = `${sign}${isFloat ? delta.toFixed(3).replace(/\.?0+$/, '') : delta}`

  let percentChange: number | null = null
  let formattedPercent: string | null = null

  if (currentNum !== 0) {
    percentChange = (delta / Math.abs(currentNum)) * 100
    const pctSign = percentChange > 0 ? '+' : ''
    formattedPercent = `${pctSign}${percentChange.toFixed(1)}%`
  }

  return {
    delta,
    formattedDelta,
    percentChange,
    formattedPercent,
    direction,
  }
}

/**
 * Formats a parameter value with optional unit suffix.
 * Handles null/empty values explicitly without guesswork.
 */
export function formatDiffValue(val: string | null | undefined, unit?: string | null): string {
  if (val === null || val === undefined) {
    return 'Not set / Unreported'
  }
  const str = String(val).trim()
  if (str === '') {
    return '(empty)'
  }
  if (unit && !str.endsWith(unit)) {
    return `${str} ${unit}`
  }
  return str
}

/**
 * Metadata for rendering diff type badges.
 */
export function getDiffBadgeMeta(diffType: ParameterDiffType): {
  label: string
  badgeStyle: string
  icon: string
  srLabel: string
} {
  switch (diffType) {
    case 'add':
      return {
        label: 'New Parameter',
        badgeStyle: 'bg-green-500/15 text-green-300 border-green-500/30',
        icon: '+',
        srLabel: 'Added new parameter',
      }
    case 'remove':
      return {
        label: 'Deprecating',
        badgeStyle: 'bg-red-500/15 text-red-300 border-red-500/30',
        icon: '−',
        srLabel: 'Deprecating parameter',
      }
    case 'modify':
    default:
      return {
        label: 'Modified',
        badgeStyle: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
        icon: 'Δ',
        srLabel: 'Modified parameter value',
      }
  }
}

/**
 * Checks whether a proposal has any proposed parameter changes.
 */
export function hasParameterChanges(
  proposal: { proposedParameterChanges?: readonly ProposedParameterChange[] | null } | null | undefined,
): boolean {
  return Array.isArray(proposal?.proposedParameterChanges) && proposal.proposedParameterChanges.length > 0
}

/**
 * Groups parameter changes by their category for structured presentation.
 */
export function groupParameterChangesByCategory(
  changes: readonly ProposedParameterChange[],
): Record<string, ProposedParameterChange[]> {
  const groups: Record<string, ProposedParameterChange[]> = {}
  for (const change of changes) {
    const cat = change.category || 'General'
    if (!groups[cat]) {
      groups[cat] = []
    }
    groups[cat].push(change)
  }
  return groups
}
