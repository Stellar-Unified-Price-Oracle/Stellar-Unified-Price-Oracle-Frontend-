/** Placeholder shown in place of every hidden character. */
const MASK = '••••'

/**
 * Masks a credential for display, keeping only its last `visible` characters.
 *
 * Values no longer than `visible` are fully hidden, so a short secret is never
 * shown in its entirety. The output is always `MASK` plus at most `visible`
 * characters, regardless of the input length, so the mask does not leak the
 * secret's length.
 */
export function maskSecret(value: string, visible = 4): string {
  if (!value) return ''
  if (value.length <= visible) return MASK
  // `slice(-0)` is `slice(0)`, which would expose the whole value when visible is 0.
  return `${MASK}${value.slice(value.length - visible)}`
}

/**
 * Summarizes a notification condition into a short, human-readable label.
 *
 * Accepts either a plain string or a structured condition object and returns
 * a compact description suitable for rendering in the channels modal.
 */
export function summarizeCondition(
  condition: string | { field?: string; operator?: string; value?: unknown } | null | undefined,
): string {
  if (condition == null) return ''
  if (typeof condition === 'string') return condition
  const { field, operator, value } = condition
  const parts = [field, operator, value]
    .filter((part) => part !== undefined && part !== null && part !== '')
    .map((part) => String(part))
  return parts.join(' ')
}
